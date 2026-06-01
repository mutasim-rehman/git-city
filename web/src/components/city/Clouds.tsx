"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seededRng } from "@/components/city/utils/seededRng";

// ─── Clouds ───────────────────────────────────────────────────────────────────

interface CloudGroupData {
  id: number; x: number; y: number; z: number;
  scale: number; speed: number;
  blobs: { ox: number; oy: number; oz: number; r: number }[];
}

function buildCloudBlobs(seed: number) {
  const count = 6 + Math.floor(seededRng(seed) * 6);
  const blobs = [{ ox: 0, oy: 0, oz: 0, r: 55 + seededRng(seed + 10) * 30 }];
  for (let i = 1; i < count; i++) {
    const angle = seededRng(seed + i * 17) * Math.PI * 2;
    const dist  = 30 + seededRng(seed + i * 31) * 70;
    blobs.push({ ox: Math.cos(angle) * dist, oy: (seededRng(seed + i * 7) - 0.4) * 20, oz: Math.sin(angle) * dist * 0.5, r: 28 + seededRng(seed + i * 43) * 38 });
  }
  return blobs;
}

function Cloud({ data }: { data: CloudGroupData }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.position.x += data.speed * delta;
      if (groupRef.current.position.x > 3500) groupRef.current.position.x = -3500;
    }
  });
  return (
    <group ref={groupRef} position={[data.x, data.y, data.z]} scale={[data.scale, data.scale * 0.55, data.scale]}>
      {data.blobs.map((blob, i) => (
        <mesh key={i} position={[blob.ox, blob.oy, blob.oz]}>
          <sphereGeometry args={[blob.r, 10, 8]} />
          <meshStandardMaterial color="#dff0fa" roughness={1} metalness={0} emissive="#c8e8f5" emissiveIntensity={0.14} transparent opacity={0.82} />
        </mesh>
      ))}
    </group>
  );
}

export function Clouds({ extent }: { extent: number }) {
  const cloudData = useMemo<CloudGroupData[]>(() => {
    const clouds: CloudGroupData[] = [];
    const baseR = extent + 400;
    for (let i = 0; i < 40; i++) {
      const angle  = seededRng(i * 3) * Math.PI * 2;
      const radius = baseR + seededRng(i * 7) * 2200;
      const isHigh = seededRng(i * 11) > 0.6;
      const y      = isHigh ? 900 + seededRng(i * 13) * 320 : 580 + seededRng(i * 17) * 200;
      const scale  = (isHigh ? 0.7 : 1.0) + seededRng(i * 19) * 0.8;
      clouds.push({ id: i, x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, scale, speed: (seededRng(i * 23) * 6 + 3) * (seededRng(i * 29) > 0.5 ? 1 : -1), blobs: buildCloudBlobs(i * 37) });
    }
    return clouds;
  }, [extent]);
  return <group>{cloudData.map(d => <Cloud key={d.id} data={d} />)}</group>;
}
