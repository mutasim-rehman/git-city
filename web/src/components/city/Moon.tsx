"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

export const MOON_LIGHT_LAYER = 10;
const MOON_ROTATION_DEG: [number, number, number] = [180, -40, 180];

export function EnableMoonLayerOnCamera({ layer }: { layer: number }) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    camera.layers.enable(layer);
  }, [camera, layer]);
  return null;
}

export function MoonOnlyAmbient({
  layer,
  intensity,
  color,
}: {
  layer: number;
  intensity: number;
  color: string;
}) {
  const ref = useRef<THREE.AmbientLight>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.layers.set(layer);
  }, [layer]);
  return <ambientLight ref={ref} intensity={intensity} color={color} />;
}

export function MoonBeamFromCity({
  moonPosition,
  layer,
}: {
  moonPosition: [number, number, number];
  layer: number;
}) {
  const ref = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  useLayoutEffect(() => {
    const light = ref.current;
    if (!light) return;
    light.layers.set(layer);
    light.target.position.set(moonPosition[0], moonPosition[1], moonPosition[2]);
    scene.add(light.target);
    return () => {
      scene.remove(light.target);
    };
  }, [scene, moonPosition, layer]);

  return (
    <directionalLight
      ref={ref}
      position={[0, 260, 0]}
      intensity={5.2}
      color="#fff4e6"
      castShadow={false}
    />
  );
}

export function Moon({ position }: { position: [number, number, number] }) {
  const gltf = useGLTF("/models/moon_nasa.glb");
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const moonRotRad = useMemo(() => {
    const D = Math.PI / 180;
    return [
      MOON_ROTATION_DEG[0] * D,
      MOON_ROTATION_DEG[1] * D,
      MOON_ROTATION_DEG[2] * D,
    ] as [number, number, number];
  }, []);

  useMemo(() => {
    const pink = new THREE.Color("#ec4899");
    scene.traverse((obj) => {
      const o = obj as THREE.Object3D;
      o.layers.set(MOON_LIGHT_LAYER);
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!mat) continue;
        const mAny = mat as THREE.Material & { fog?: boolean };
        mAny.fog = false;
        if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const m = mat as THREE.MeshStandardMaterial;
          m.metalness = 0;
          m.roughness = 0.92;
          m.emissive = new THREE.Color(0xf0e8ff).lerp(pink, 0.12);
          m.emissiveIntensity = 0.05;
          m.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  return (
    <primitive object={scene} position={position} rotation={moonRotRad} scale={500.0} />
  );
}
