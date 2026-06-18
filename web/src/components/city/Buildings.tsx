"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PositionedBuilding, BuildingColors } from "@/lib/types";
import { FIELD_STYLE_META } from "@/lib/city/buildingFieldStyles";
import { WINDOW_ATLAS_CONSTANTS } from "@/lib/city/windowAtlas";

const {
  ATLAS_COLS,
  ATLAS_BAND_ROWS,
} = WINDOW_ATLAS_CONSTANTS;

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0);
const _scale = new THREE.Vector3(1, 1, 1);

const vertexShader = /* glsl */ `
  attribute vec4 aUvFront;
  attribute vec4 aUvSide;
  attribute vec3 aFacadeColor;
  attribute float aPulseFlag;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec4 vUvFront;
  varying vec4 vUvSide;
  varying vec3 vViewPos;
  varying vec3 vFacadeColor;
  varying float vPulseFlag;

  void main() {
    vUv = uv;
    vNormal = normalize(mat3(instanceMatrix) * normal);
    vUvFront = aUvFront;
    vUvSide = aUvSide;
    vFacadeColor = aFacadeColor;
    vPulseFlag = aPulseFlag;

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
  uniform float uPulseTime;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec4 vUvFront;
  varying vec4 vUvSide;
  varying vec3 vViewPos;
  varying vec3 vFacadeColor;
  varying float vPulseFlag;

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

    float pulse = 0.5 + 0.5 * sin(uPulseTime * 4.8);
    color = mix(color, vec3(1.0), pulse * vPulseFlag * 0.82);

    float fogFactor = smoothstep(uFogNear, uFogFar, fogDepth);
    color = mix(color, uFogColor, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

interface InstancedBuildingsProps {
  buildings: PositionedBuilding[];
  atlasTexture: THREE.CanvasTexture;
  colors: BuildingColors;
  pulseBuildingId?: string | null;
  onHover?: (building: PositionedBuilding | null) => void;
  meshRef?: RefObject<THREE.InstancedMesh | null>;
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
  pulseBuildingId = null,
  onHover,
  meshRef: externalMeshRef,
}: InstancedBuildingsProps) {
  const internalMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const meshRef = externalMeshRef ?? internalMeshRef;
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
        uPulseTime: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      // Invisible pick mesh — field props provide the visuals.
      colorWrite: false,
      depthWrite: false,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    material.uniforms.uAtlas.value = atlasTexture;
    material.uniforms.uRoofColor.value.set(colors.roof);
    material.needsUpdate = true;
  }, [material, atlasTexture, colors.roof]);

  const { uvFrontData, uvSideData, facadeData, pulseData } = useMemo(() => {
    const uvF = new Float32Array(count * 4);
    const uvS = new Float32Array(count * 4);
    const facade = new Float32Array(count * 3);
    const pulse = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const b = buildings[i]!;
      const meta = FIELD_STYLE_META[b.fieldStyle];
      const base = new THREE.Color(meta.facade);
      const accent = new THREE.Color(meta.accent);
      const seed = usernameSeed(b.username);
      const mix = 0.12 + (seed % 7) * 0.04;
      base.lerp(accent, mix);
      facade[i * 3 + 0] = base.r;
      facade[i * 3 + 1] = base.g;
      facade[i * 3 + 2] = base.b;
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
      pulse[i] = b.id === pulseBuildingId ? 1 : 0;
    }

    return { uvFrontData: uvF, uvSideData: uvS, facadeData: facade, pulseData: pulse };
  }, [buildings, count, pulseBuildingId]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < count; i++) {
      const b = buildings[i];
      _position.set(b.x, b.height / 2, b.z);
      _scale.set(b.width, b.height, b.depth);
      const rotY = (b as { rotationY?: number }).rotationY;
      if (typeof rotY === "number") {
        _euler.y = rotY;
        _quaternion.setFromEuler(_euler);
      } else {
        _quaternion.identity();
      }
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
    const pulseAttr = new THREE.InstancedBufferAttribute(pulseData, 1);
    mesh.geometry.setAttribute("aUvFront", uvFrontAttr);
    mesh.geometry.setAttribute("aUvSide", uvSideAttr);
    mesh.geometry.setAttribute("aFacadeColor", facadeAttr);
    mesh.geometry.setAttribute("aPulseFlag", pulseAttr);

    mesh.count = count;
  }, [buildings, count, meshRef, uvFrontData, uvSideData, facadeData, pulseData]);

  const lastFogNear = useRef(0);
  const lastFogFar = useRef(0);
  useFrame(({ scene }) => {
    if (!material.uniforms) return;
    const fog = scene.fog as THREE.Fog | null;
    material.uniforms.uPulseTime.value += 1 / 60;
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
      frustumCulled
      castShadow={false}
      receiveShadow={false}
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

function createBuildingSignTexture(username: string) {
  const label = username.startsWith("@") ? username : `@${username}`;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "rgba(10,10,18,0.96)");
  gradient.addColorStop(1, "rgba(36,10,48,0.96)");
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "rgba(236,72,153,0.92)";
  ctx.lineWidth = 14;

  const radius = 34;
  ctx.beginPath();
  ctx.moveTo(radius, 20);
  ctx.lineTo(canvas.width - radius, 20);
  ctx.quadraticCurveTo(canvas.width - 20, 20, canvas.width - 20, 20 + radius);
  ctx.lineTo(canvas.width - 20, canvas.height - 20 - radius);
  ctx.quadraticCurveTo(canvas.width - 20, canvas.height - 20, canvas.width - 20 - radius, canvas.height - 20);
  ctx.lineTo(radius, canvas.height - 20);
  ctx.quadraticCurveTo(20, canvas.height - 20, 20, canvas.height - 20 - radius);
  ctx.lineTo(20, 20 + radius);
  ctx.quadraticCurveTo(20, 20, radius, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255,244,181,0.98)";
  ctx.font = "700 108px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = 18;
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 8, canvas.width - 100);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function BuildingSignBoards({
  buildings,
  activeBuildingId,
}: {
  buildings: PositionedBuilding[];
  activeBuildingId?: string | null;
}) {
  const taggedBuildings = useMemo(() => {
    if (!activeBuildingId) return [];
    return buildings.filter((b) => b.id === activeBuildingId);
  }, [buildings, activeBuildingId]);

  const signData = useMemo(() => {
    return taggedBuildings.map((b) => {
      const texture = createBuildingSignTexture(b.username);

      // "Banner size" is the in-world sign plate + housing.
      // Halve the original proportions.
      const baseSignWidth = THREE.MathUtils.clamp(Math.max(b.width, b.depth) * 1.05, 34, 82);
      const baseSignHeight = THREE.MathUtils.clamp(baseSignWidth * 0.24, 10, 18);
      const signWidth = baseSignWidth * 0.5;
      const signHeight = baseSignHeight * 0.5;

      const mountY = THREE.MathUtils.clamp(18, 16, Math.max(20, b.height * 0.3));
      const frontOffset = b.depth / 2 + 4.2;
      const sideOffset = b.width / 2 + 4.2;

      return {
        id: b.id,
        x: b.x,
        z: b.z,
        rotationY: b.rotationY ?? 0,
        texture,
        signWidth,
        signHeight,
        mountY,
        frontOffset,
        sideOffset,
      };
    });
  }, [taggedBuildings]);

  useEffect(() => {
    return () => {
      for (const sign of signData) {
        sign.texture?.dispose();
      }
    };
  }, [signData]);

  if (signData.length === 0) return null;

  return (
    <group>
      {signData.map((sign) => {
        if (!sign.texture) return null;
        return (
          <group key={`sign-${sign.id}`} position={[sign.x, 0, sign.z]} rotation-y={sign.rotationY}>
            {[
              { key: "front", pos: [0, sign.mountY, sign.frontOffset] as [number, number, number], rot: 0 },
              { key: "back", pos: [0, sign.mountY, -sign.frontOffset] as [number, number, number], rot: Math.PI },
              { key: "left", pos: [-sign.sideOffset, sign.mountY, 0] as [number, number, number], rot: Math.PI / 2 },
              { key: "right", pos: [sign.sideOffset, sign.mountY, 0] as [number, number, number], rot: -Math.PI / 2 },
            ].map((face) => (
              <group key={face.key} position={face.pos} rotation-y={face.rot} renderOrder={20}>
                <mesh position={[0, 0, -0.24]} renderOrder={20}>
                  <planeGeometry args={[sign.signWidth + 2, sign.signHeight + 1.5]} />
                  <meshStandardMaterial
                    color="#120814"
                    emissive="#3b0764"
                    emissiveIntensity={0.35}
                    roughness={0.45}
                    metalness={0.22}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                    depthTest={false}
                  />
                </mesh>
                <mesh renderOrder={21}>
                  <planeGeometry args={[sign.signWidth, sign.signHeight]} />
                  <meshBasicMaterial
                    map={sign.texture}
                    transparent
                    toneMapped={false}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                    depthTest={false}
                  />
                </mesh>
                <mesh position={[0, -(sign.signHeight / 2 + 1.4), -0.3]} renderOrder={19}>
                  <boxGeometry args={[0.55, 2.3, 0.35]} />
                  <meshStandardMaterial color="#1f2937" metalness={0.42} roughness={0.56} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

export function PulseTargetBuilding({ building }: { building: PositionedBuilding | null }) {
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useFrame(({ clock }) => {
    if (!materialRef.current || !building) return;
    const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 4.6);
    materialRef.current.opacity = 0.08 + pulse * 0.45;
    materialRef.current.emissiveIntensity = 0.15 + pulse * 0.85;
    materialRef.current.color.setScalar(0.82 + pulse * 0.18);
    materialRef.current.emissive.setScalar(0.55 + pulse * 0.45);
  });

  if (!building) return null;

  return (
    <mesh
      position={[building.x, building.height / 2, building.z]}
      rotation-y={building.rotationY ?? 0}
      renderOrder={18}
    >
      <boxGeometry args={[building.width + 4, building.height + 4, building.depth + 4]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#ffffff"
        emissive="#ffffff"
        transparent
        opacity={0.28}
        depthWrite={false}
        metalness={0}
        roughness={0.22}
      />
    </mesh>
  );
}
