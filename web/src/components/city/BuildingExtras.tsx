"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PositionedBuilding } from "@/lib/types";

function createBuildingSignTexture(username: string) {
  const label = username.startsWith("@") ? username : `@${username}`;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(10,15,10,0.96)";
  ctx.strokeStyle = "rgba(34,197,94,0.92)";
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

  ctx.fillStyle = "rgba(126,231,135,0.98)";
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
