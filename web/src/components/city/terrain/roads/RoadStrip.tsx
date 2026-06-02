"use client";

import type { RoadSegment } from "@/lib/city/layout";
import { LANE_WIDTH, MEDIAN_WIDTH } from "@/lib/city/layout";
import { ROAD_COLORS } from "@/components/city/theme/roadColors";

export function RoadStrip({
  seg,
  sidewalkColor,
  markingColor,
}: {
  seg: RoadSegment;
  sidewalkColor: string;
  markingColor: string;
}) {
  const len = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
  if (len < 1) return null;

  const cx = (seg.x1 + seg.x2) / 2;
  const cz = (seg.z1 + seg.z2) / 2;
  const angle = Math.atan2(seg.z2 - seg.z1, seg.x2 - seg.x1);
  const isArterial = seg.kind === "arterial";
  const laneW = isArterial ? LANE_WIDTH : seg.width * 0.42;
  const medianW = isArterial ? MEDIAN_WIDTH : 0;
  const totalW = isArterial ? seg.width : seg.width;

  return (
    <group position={[cx, 0.02, cz]} rotation-y={-angle}>
      <mesh receiveShadow>
        <boxGeometry args={[len + 2, 0.12, totalW + 4]} />
        <meshStandardMaterial color={sidewalkColor} roughness={0.92} />
      </mesh>
      {isArterial && (
        <>
          <mesh position={[0, 0.08, -(laneW / 2 + medianW / 4)]} receiveShadow>
            <boxGeometry args={[len, 0.1, laneW]} />
            <meshStandardMaterial color={ROAD_COLORS.arterialLane} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.08, laneW / 2 + medianW / 4]} receiveShadow>
            <boxGeometry args={[len, 0.1, laneW]} />
            <meshStandardMaterial color={ROAD_COLORS.arterialLane} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.06, 0]} receiveShadow>
            <boxGeometry args={[len, 0.08, medianW]} />
            <meshStandardMaterial color={ROAD_COLORS.median} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[len * 0.4, 0.02, 0.35]} />
            <meshStandardMaterial color={markingColor} />
          </mesh>
        </>
      )}
      {!isArterial && (
        <mesh position={[0, 0.07, 0]} receiveShadow>
          <boxGeometry args={[len, 0.09, totalW * 0.85]} />
          <meshStandardMaterial color={ROAD_COLORS.localLane} roughness={0.88} />
        </mesh>
      )}
    </group>
  );
}