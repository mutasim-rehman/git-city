"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
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
  const meshRef = useRef<THREE.Mesh>(null);

  useLayoutEffect(() => {
    if (meshRef.current) {
      meshRef.current.layers.set(MOON_LIGHT_LAYER);
    }
  }, []);

  const moonRotRad = useMemo(() => {
    const D = Math.PI / 180;
    return [
      MOON_ROTATION_DEG[0] * D,
      MOON_ROTATION_DEG[1] * D,
      MOON_ROTATION_DEG[2] * D,
    ] as [number, number, number];
  }, []);

  const emissiveColor = useMemo(() => {
    const base = new THREE.Color("#f0e8ff");
    const pink = new THREE.Color("#ec4899");
    return base.lerp(pink, 0.12);
  }, []);

  return (
    <mesh ref={meshRef} position={position} rotation={moonRotRad} scale={500.0}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        color="#f0e8ff"
        emissive={emissiveColor}
        emissiveIntensity={0.05}
        metalness={0}
        roughness={0.92}
        fog={false}
      />
    </mesh>
  );
}

