"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { PositionedBuilding, BuildingColors } from "@/lib/types";
import { WINDOW_ATLAS_CONSTANTS } from "@/lib/city/windowAtlas";

const {
  ATLAS_COLS,
  ATLAS_BAND_ROWS,
} = WINDOW_ATLAS_CONSTANTS;

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);

const vertexShader = /* glsl */ `
  attribute vec4 aUvFront;
  attribute vec4 aUvSide;
  attribute vec3 aFacadeColor;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec4 vUvFront;
  varying vec4 vUvSide;
  varying vec3 vViewPos;
  varying vec3 vFacadeColor;

  void main() {
    vUv = uv;
    vNormal = normalize(mat3(instanceMatrix) * normal);
    vUvFront = aUvFront;
    vUvSide = aUvSide;
    vFacadeColor = aFacadeColor;

    vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vViewPos = mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uRoofColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec4 vUvFront;
  varying vec4 vUvSide;
  varying vec3 vViewPos;
  varying vec3 vFacadeColor;

  void main() {
    float fogDepth = length(vViewPos);
    if (fogDepth > uFogFar) discard;

    vec3 absN = abs(vNormal);
    float isRoof = step(0.5, absN.y);

    bool isFrontBack = absN.z > absN.x;
    vec4 uvParams = isFrontBack ? vUvFront : vUvSide;
    vec2 atlasUv = uvParams.xy + vUv * uvParams.zw;

    vec4 atlasSample = texture2D(uAtlas, atlasUv);
    vec3 wall = mix(vFacadeColor, atlasSample.rgb, atlasSample.a);
    vec3 roof = uRoofColor;

    vec3 color = mix(wall, roof, isRoof);

    vec3 lightDir = normalize(vec3(0.3, 1.0, 0.5));
    float diffuse = max(dot(normalize(vNormal), lightDir), 0.0) * 0.4 + 0.6;
    color *= diffuse;

    float fogFactor = smoothstep(uFogNear, uFogFar, fogDepth);
    color = mix(color, uFogColor, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

interface InstancedBuildingsProps {
  buildings: PositionedBuilding[];
  atlasTexture: THREE.CanvasTexture;
  colors: BuildingColors;
  onHover?: (building: PositionedBuilding | null) => void;
}

function usernameSeed(username: string): number {
  let s = 0;
  for (let i = 0; i < username.length; i++) s += username.charCodeAt(i);
  return s;
}

export const InstancedBuildings = memo(function InstancedBuildings({
  buildings,
  atlasTexture,
  colors,
  onHover,
}: InstancedBuildingsProps) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const count = buildings.length;

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: atlasTexture },
        uRoofColor: { value: new THREE.Color(colors.roof) },
        uFogColor: { value: new THREE.Color("#020617") },
        uFogNear: { value: 400 },
        uFogFar: { value: 2500 },
      },
      vertexShader,
      fragmentShader,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    material.uniforms.uAtlas.value = atlasTexture;
    material.uniforms.uRoofColor.value.set(colors.roof);
    material.needsUpdate = true;
  }, [material, atlasTexture, colors.roof]);

  const { uvFrontData, uvSideData, facadeData } = useMemo(() => {
    const uvF = new Float32Array(count * 4);
    const uvS = new Float32Array(count * 4);
    const facade = new Float32Array(count * 3);

    // Muted architectural facade palette.
    const palette = [
      "#9ca3af", // cool grey
      "#94a3b8", // slate
      "#a5b4fc", // light blue
      "#cbd5e1", // light concrete
      "#d6d3d1", // warm stone
      "#e7e5e4", // off-white
      "#d4c5a8", // sand/beige
      "#b0b9c6", // steel
    ].map((hex) => new THREE.Color(hex));

    // Determine grid coordinates and "block" grouping so adjacent buildings can be differentiated.
    // Layout snaps to a strict GRID_STEP; derive cell coords from positions.
    const GRID_STEP = 95;
    const BLOCK_CELLS = 4; // ~ one block between major roads (380 / 95 ≈ 4)

    type Key = string;
    const cellKey = (cx: number, cz: number) => `${cx},${cz}` as Key;
    const assigned = new Map<Key, number>(); // cell -> palette index

    // Stable ordering so color assignment is deterministic.
    const order = Array.from({ length: count }, (_, i) => i).sort((ai, bi) => {
      const a = buildings[ai];
      const b = buildings[bi];
      const acx = Math.round(a.x / GRID_STEP);
      const acz = Math.round(a.z / GRID_STEP);
      const bcx = Math.round(b.x / GRID_STEP);
      const bcz = Math.round(b.z / GRID_STEP);

      const abx = Math.floor(acx / BLOCK_CELLS);
      const abz = Math.floor(acz / BLOCK_CELLS);
      const bbx = Math.floor(bcx / BLOCK_CELLS);
      const bbz = Math.floor(bcz / BLOCK_CELLS);

      return abx - bbx || abz - bbz || acx - bcx || acz - bcz;
    });

    for (const i of order) {
      const b = buildings[i];
      const cx = Math.round(b.x / GRID_STEP);
      const cz = Math.round(b.z / GRID_STEP);
      const bx = Math.floor(cx / BLOCK_CELLS);
      const bz = Math.floor(cz / BLOCK_CELLS);

      const neighbors: Key[] = [
        cellKey(cx - 1, cz),
        cellKey(cx + 1, cz),
        cellKey(cx, cz - 1),
        cellKey(cx, cz + 1),
      ];

      const forbidden = new Set<number>();
      for (const nk of neighbors) {
        const c = assigned.get(nk);
        if (typeof c === "number") forbidden.add(c);
      }

      // Only enforce adjacency within the same block.
      const inSameBlock = (ncx: number, ncz: number) =>
        Math.floor(ncx / BLOCK_CELLS) === bx && Math.floor(ncz / BLOCK_CELLS) === bz;

      const neighborCells: [number, number][] = [
        [cx - 1, cz],
        [cx + 1, cz],
        [cx, cz - 1],
        [cx, cz + 1],
      ];
      forbidden.clear();
      for (const [ncx, ncz] of neighborCells) {
        if (!inSameBlock(ncx, ncz)) continue;
        const c = assigned.get(cellKey(ncx, ncz));
        if (typeof c === "number") forbidden.add(c);
      }

      const seed = usernameSeed(b.username);
      const start = seed % palette.length;
      let chosen = start;
      for (let tries = 0; tries < palette.length; tries++) {
        const idx = (start + tries) % palette.length;
        if (!forbidden.has(idx)) {
          chosen = idx;
          break;
        }
      }

      assigned.set(cellKey(cx, cz), chosen);
      const c = palette[chosen];
      facade[i * 3 + 0] = c.r;
      facade[i * 3 + 1] = c.g;
      facade[i * 3 + 2] = c.b;
    }

    for (let i = 0; i < count; i++) {
      const b = buildings[i];
      const seed =
        b.username.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 137;

      const bandIndex = Math.min(
        5,
        Math.max(0, Math.round(b.litPercentage * 5)),
      );
      const bandRowOffset = bandIndex * ATLAS_BAND_ROWS;

      const frontCols = Math.max(1, b.windowsPerFloor);
      const sideCols = Math.max(1, b.sideWindowsPerFloor);

      const frontColStart = Math.abs(seed % Math.max(1, ATLAS_COLS - frontCols));
      uvF[i * 4 + 0] = frontColStart / ATLAS_COLS;
      uvF[i * 4 + 1] = bandRowOffset / ATLAS_COLS;
      uvF[i * 4 + 2] = frontCols / ATLAS_COLS;
      uvF[i * 4 + 3] = b.floors / ATLAS_COLS;

      const sideColStart = Math.abs(
        (seed + 7919) % Math.max(1, ATLAS_COLS - sideCols),
      );
      uvS[i * 4 + 0] = sideColStart / ATLAS_COLS;
      uvS[i * 4 + 1] = bandRowOffset / ATLAS_COLS;
      uvS[i * 4 + 2] = sideCols / ATLAS_COLS;
      uvS[i * 4 + 3] = b.floors / ATLAS_COLS;
    }

    return { uvFrontData: uvF, uvSideData: uvS, facadeData: facade };
  }, [buildings, count]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < count; i++) {
      const b = buildings[i];
      _position.set(b.x, b.height / 2, b.z);
      _scale.set(b.width, b.height, b.depth);
      _matrix.compose(_position, _quaternion, _scale);
      mesh.setMatrixAt(i, _matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Bounding sphere that clearly encloses the city; avoids NaN issues
    let maxDist = 0;
    let maxHeight = 0;
    for (let i = 0; i < count; i++) {
      const b = buildings[i];
      const d = Math.sqrt(b.x * b.x + b.z * b.z);
      if (d > maxDist) maxDist = d;
      if (b.height > maxHeight) maxHeight = b.height;
    }
    const radius = Math.sqrt(maxDist * maxDist + maxHeight * maxHeight) + 200;
    mesh.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, maxHeight / 2, 0),
      radius,
    );

    const uvFrontAttr = new THREE.InstancedBufferAttribute(uvFrontData, 4);
    const uvSideAttr = new THREE.InstancedBufferAttribute(uvSideData, 4);
    const facadeAttr = new THREE.InstancedBufferAttribute(facadeData, 3);
    mesh.geometry.setAttribute("aUvFront", uvFrontAttr);
    mesh.geometry.setAttribute("aUvSide", uvSideAttr);
    mesh.geometry.setAttribute("aFacadeColor", facadeAttr);

    mesh.count = count;
  }, [buildings, count, uvFrontData, uvSideData, facadeData]);

  const lastFogNear = useRef(0);
  const lastFogFar = useRef(0);
  useFrame(({ scene }) => {
    if (!material.uniforms) return;
    const fog = scene.fog as THREE.Fog | null;
    if (!fog) return;
    if (fog.near !== lastFogNear.current || fog.far !== lastFogFar.current) {
      material.uniforms.uFogColor.value.copy(fog.color);
      material.uniforms.uFogNear.value = fog.near;
      material.uniforms.uFogFar.value = fog.far;
      lastFogNear.current = fog.near;
      lastFogFar.current = fog.far;
    }
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      castShadow
      receiveShadow
      onPointerMove={(e) => {
        e.stopPropagation();
        if (typeof e.instanceId === "number" && buildings[e.instanceId]) {
          onHover?.(buildings[e.instanceId]);
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover?.(null);
        document.body.style.cursor = "auto";
      }}
    />
  );
});

