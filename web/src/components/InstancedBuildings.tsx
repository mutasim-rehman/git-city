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

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec4 vUvFront;
  varying vec4 vUvSide;
  varying vec3 vViewPos;

  void main() {
    vUv = uv;
    vNormal = normalize(mat3(instanceMatrix) * normal);
    vUvFront = aUvFront;
    vUvSide = aUvSide;

    vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vViewPos = mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uRoofColor;
  uniform vec3 uFaceColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec4 vUvFront;
  varying vec4 vUvSide;
  varying vec3 vViewPos;

  void main() {
    float fogDepth = length(vViewPos);
    if (fogDepth > uFogFar) discard;

    vec3 absN = abs(vNormal);
    float isRoof = step(0.5, absN.y);

    bool isFrontBack = absN.z > absN.x;
    vec4 uvParams = isFrontBack ? vUvFront : vUvSide;
    vec2 atlasUv = uvParams.xy + vUv * uvParams.zw;

    vec3 wall = texture2D(uAtlas, atlasUv).rgb;
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
        uFaceColor: { value: new THREE.Color(colors.face) },
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
    material.uniforms.uFaceColor.value.set(colors.face);
    material.needsUpdate = true;
  }, [material, atlasTexture, colors.roof, colors.face]);

  const { uvFrontData, uvSideData } = useMemo(() => {
    const uvF = new Float32Array(count * 4);
    const uvS = new Float32Array(count * 4);

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

    return { uvFrontData: uvF, uvSideData: uvS };
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
    mesh.geometry.setAttribute("aUvFront", uvFrontAttr);
    mesh.geometry.setAttribute("aUvSide", uvSideAttr);

    mesh.count = count;
  }, [buildings, count, uvFrontData, uvSideData]);

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

