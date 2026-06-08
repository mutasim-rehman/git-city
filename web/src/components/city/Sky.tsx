"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { seededRng } from "@/components/city/utils/seededRng";

// ─── Sky Dome ─────────────────────────────────────────────────────────────────

export function SkyDome({ stops }: { stops: [number, string][] }) {
  const material = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;
    // Blocky sky bands — hard color steps, no smooth gradient
    for (let i = 0; i < stops.length; i++) {
      const [stop, color] = stops[i];
      const nextStop = i < stops.length - 1 ? stops[i + 1][0] : 1;
      const yStart = Math.floor(stop * 1024);
      const yEnd = Math.ceil(nextStop * 1024);
      ctx.fillStyle = color;
      ctx.fillRect(0, yStart, 4, yEnd - yStart);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
  }, [stops]);

  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[3800, 32, 48]} />
    </mesh>
  );
}

// ─── Stars ────────────────────────────────────────────────────────────────────

export function Stars() {
  const points = useMemo(() => {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = seededRng(i * 991) * Math.PI * 2;
      const phi = Math.acos(seededRng(i * 577) * 0.62 + 0.38);
      const r = 3600 + seededRng(i * 313) * 200;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return positions;
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(points, 3));
    return g;
  }, [points]);

  return (
    <points geometry={geo}>
      <pointsMaterial color="#7ee787" size={3.5} sizeAttenuation fog={false} transparent opacity={0.55} />
    </points>
  );
}

/** Sun disc in the sky — edit colors/sizes here. */
export function SunDisc({ position }: { position: [number, number, number] }) {
  return (
    <>
      <mesh position={position}>
        <sphereGeometry args={[65, 24, 24]} />
        <meshBasicMaterial color="#7ee787" fog={false} />
      </mesh>
      <mesh position={position}>
        <sphereGeometry args={[120, 18, 18]} />
        <meshBasicMaterial
          color="#22c55e"
          transparent
          opacity={0.12}
          fog={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}
