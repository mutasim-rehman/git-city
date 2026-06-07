"use client";

/** Base ground plane under the city — edit color via props from theme. */
export function GroundPlane({ color }: { color: string }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -3, 0]} receiveShadow renderOrder={-10}>
      <planeGeometry args={[20000, 20000]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.08}
        roughness={0.96}
      />
    </mesh>
  );
}
