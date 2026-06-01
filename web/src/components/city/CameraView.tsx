"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
// ─── Camera Focus ─────────────────────────────────────────────────────────────

export function CameraFocus({
  focusPosition,
  controlsRef,
}: {
  focusPosition: [number, number, number] | null;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const currentTarget = useRef<THREE.Vector3 | null>(null);
  const target = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!focusPosition) {
      target.current = null;
      currentTarget.current = null;
      return;
    }

    target.current = new THREE.Vector3(...focusPosition);

    if (!currentTarget.current) {
      currentTarget.current = target.current.clone();
      camera.lookAt(currentTarget.current);
      const c = controlsRef.current;
      if (c) {
        c.target.copy(currentTarget.current);
        c.update();
      }
    }
  }, [focusPosition, camera, controlsRef]);

  useFrame(() => {
    if (!target.current || !currentTarget.current) return;
    currentTarget.current.lerp(target.current, 0.08);
    const c = controlsRef.current;
    if (c) {
      c.target.copy(currentTarget.current);
      c.update();
    }
  });

  return null;
}

export function OrbitCityCamera({
  focusPosition,
  controlsRef,
}: {
  focusPosition: [number, number, number] | null;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.1}
        minDistance={250}
        maxDistance={3200}
        enableDamping
        dampingFactor={0.06}
      />
      <CameraFocus focusPosition={focusPosition} controlsRef={controlsRef} />
    </>
  );
}
