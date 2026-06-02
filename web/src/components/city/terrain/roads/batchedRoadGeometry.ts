import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { RoadSegment } from "@/lib/city/layout";
import { LANE_WIDTH, MEDIAN_WIDTH } from "@/lib/city/layout";
import { ROAD_COLORS } from "@/components/city/theme/roadColors";

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

export type BatchedRoadMeshes = {
  sidewalk: THREE.BufferGeometry;
  localLane: THREE.BufferGeometry;
  arterialLane: THREE.BufferGeometry;
  median: THREE.BufferGeometry;
  marking: THREE.BufferGeometry;
};

export function buildBatchedRoadGeometries(roads: RoadSegment[]): BatchedRoadMeshes {
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

export const BATCHED_ROAD_MATERIALS = {
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
