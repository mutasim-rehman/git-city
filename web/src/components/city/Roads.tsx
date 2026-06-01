"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { RoadSegment } from "@/lib/city/layout";
import { LANE_WIDTH, MEDIAN_WIDTH } from "@/lib/city/layout";

/** Road surface colors — edit here to change lane/median appearance. */
export const ROAD_COLORS = {
  arterialLane: "#1e293b",
  localLane: "#334155",
  median: "#14532d",
} as const;

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _euler = new THREE.Euler(0, 0, 0);

function appendOrientedBox(
  bucket: THREE.BufferGeometry[],
  cx: number,
  cy: number,
  cz: number,
  rotY: number,
  lx: number,
  ly: number,
  lz: number,
  w: number,
  h: number,
  d: number,
) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const sin = Math.sin(rotY);
  const cos = Math.cos(rotY);
  const wx = cx + lx * cos - lz * sin;
  const wy = cy + ly;
  const wz = cz + lx * sin + lz * cos;
  _euler.y = rotY;
  _quaternion.setFromEuler(_euler);
  _position.set(wx, wy, wz);
  _matrix.compose(_position, _quaternion, _scale);
  geo.applyMatrix4(_matrix);
  bucket.push(geo);
}

function mergeBucket(bucket: THREE.BufferGeometry[]) {
  if (bucket.length === 0) return new THREE.BufferGeometry();
  const merged = mergeGeometries(bucket, false);
  for (const g of bucket) g.dispose();
  return merged ?? new THREE.BufferGeometry();
}

type BatchedRoadMeshes = {
  sidewalk: THREE.BufferGeometry;
  localLane: THREE.BufferGeometry;
  arterialLane: THREE.BufferGeometry;
  median: THREE.BufferGeometry;
  marking: THREE.BufferGeometry;
};

function buildBatchedRoadGeometries(roads: RoadSegment[]): BatchedRoadMeshes {
  const sidewalks: THREE.BufferGeometry[] = [];
  const localLanes: THREE.BufferGeometry[] = [];
  const arterialLanes: THREE.BufferGeometry[] = [];
  const medians: THREE.BufferGeometry[] = [];
  const markings: THREE.BufferGeometry[] = [];

  for (const seg of roads) {
    const len = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
    if (len < 1) continue;

    const cx = (seg.x1 + seg.x2) / 2;
    const cz = (seg.z1 + seg.z2) / 2;
    const angle = Math.atan2(seg.z2 - seg.z1, seg.x2 - seg.x1);
    const isArterial = seg.kind === "arterial";
    const laneW = isArterial ? LANE_WIDTH : seg.width * 0.42;
    const medianW = isArterial ? MEDIAN_WIDTH : 0;
    const totalW = isArterial ? seg.width : seg.width;

    const rotY = -angle;
    appendOrientedBox(sidewalks, cx, 0.02, cz, rotY, 0, 0, 0, len + 2, 0.12, totalW + 4);

    if (isArterial) {
      const off = laneW / 2 + medianW / 4;
      appendOrientedBox(arterialLanes, cx, 0.08, cz, rotY, 0, 0, -off, len, 0.1, laneW);
      appendOrientedBox(arterialLanes, cx, 0.08, cz, rotY, 0, 0, off, len, 0.1, laneW);
      appendOrientedBox(medians, cx, 0.06, cz, rotY, 0, 0, 0, len, 0.08, medianW);
      appendOrientedBox(markings, cx, 0.1, cz, rotY, 0, 0, 0, len * 0.4, 0.02, 0.35);
    } else {
      appendOrientedBox(localLanes, cx, 0.07, cz, rotY, 0, 0, 0, len, 0.09, totalW * 0.85);
    }
  }

  return {
    sidewalk: mergeBucket(sidewalks),
    localLane: mergeBucket(localLanes),
    arterialLane: mergeBucket(arterialLanes),
    median: mergeBucket(medians),
    marking: mergeBucket(markings),
  };
}

const BATCHED_ROAD_MATERIALS = {
  sidewalk: (color: string) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.92 }),
  localLane: () =>
    new THREE.MeshStandardMaterial({ color: ROAD_COLORS.localLane, roughness: 0.88 }),
  arterialLane: () =>
    new THREE.MeshStandardMaterial({ color: ROAD_COLORS.arterialLane, roughness: 0.85 }),
  median: () =>
    new THREE.MeshStandardMaterial({ color: ROAD_COLORS.median, roughness: 0.9 }),
  marking: (color: string) => new THREE.MeshStandardMaterial({ color }),
};

/** Single merged mesh per road material — avoids thousands of draw calls. */
export function BatchedGridRoads({
  roads,
  sidewalkColor,
  markingColor,
}: {
  roads: RoadSegment[];
  sidewalkColor: string;
  markingColor: string;
}) {
  const geos = useMemo(() => buildBatchedRoadGeometries(roads), [roads]);

  const materials = useMemo(
    () => ({
      sidewalk: BATCHED_ROAD_MATERIALS.sidewalk(sidewalkColor),
      localLane: BATCHED_ROAD_MATERIALS.localLane(),
      arterialLane: BATCHED_ROAD_MATERIALS.arterialLane(),
      median: BATCHED_ROAD_MATERIALS.median(),
      marking: BATCHED_ROAD_MATERIALS.marking(markingColor),
    }),
    [sidewalkColor, markingColor],
  );

  useEffect(() => {
    return () => {
      geos.sidewalk.dispose();
      geos.localLane.dispose();
      geos.arterialLane.dispose();
      geos.median.dispose();
      geos.marking.dispose();
      materials.sidewalk.dispose();
      materials.localLane.dispose();
      materials.arterialLane.dispose();
      materials.median.dispose();
      materials.marking.dispose();
    };
  }, [geos, materials]);

  return (
    <group>
      <mesh geometry={geos.sidewalk} material={materials.sidewalk} receiveShadow />
      <mesh geometry={geos.localLane} material={materials.localLane} receiveShadow />
      <mesh geometry={geos.arterialLane} material={materials.arterialLane} receiveShadow />
      <mesh geometry={geos.median} material={materials.median} receiveShadow />
      <mesh geometry={geos.marking} material={materials.marking} />
    </group>
  );
}

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

export function GridRoads({
  roads,
  sidewalkColor,
  markingColor,
}: {
  roads: RoadSegment[];
  sidewalkColor: string;
  markingColor: string;
}) {
  return (
    <group>
      {roads.map((seg) => (
        <RoadStrip
          key={seg.id}
          seg={seg}
          sidewalkColor={sidewalkColor}
          markingColor={markingColor}
        />
      ))}
    </group>
  );
}
