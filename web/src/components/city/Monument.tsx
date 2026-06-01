"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
// ─── Monument (central park) ──────────────────────────────────────────────────

const MONUMENT_CONFIG = {
  height: 0,
  offsetX: -10,
  offsetZ: 10,
  yaw: -90,
  pitch: 90,
  roll: 0,
  scale: 0.05,
  brightness: 1.0,
  emissiveColor: "#88ffcc",
  lightColor: "#88ffcc",
  lightIntensity: 2.0,
  lightDistance: 300,
};

export function Monument({ position }: { position: [number, number, number] }) {
  const gltf = useGLTF("/models/v-cruiser.glb");
  const cfg = MONUMENT_CONFIG;
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useMemo(() => {
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        const m = mat as THREE.MeshStandardMaterial;
        if (!m.isMeshStandardMaterial) return;
        m.emissive = new THREE.Color(cfg.emissiveColor);
        m.emissiveIntensity = Math.max(0, cfg.brightness - 1);
        m.needsUpdate = true;
      });
    });
  }, [scene, cfg.brightness, cfg.emissiveColor]);

  const groundOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    return -box.min.y * cfg.scale;
  }, [scene, cfg.scale]);

  const D = Math.PI / 180;

  return (
    <group position={[position[0] + cfg.offsetX, groundOffset + cfg.height, position[2] + cfg.offsetZ]}>
      {cfg.lightIntensity > 0 && (
        <pointLight
          color={cfg.lightColor}
          intensity={cfg.lightIntensity}
          distance={cfg.lightDistance}
        />
      )}
      <primitive
        object={scene}
        scale={cfg.scale}
        rotation={[cfg.pitch * D, cfg.yaw * D, cfg.roll * D]}
      />
    </group>
  );
}
