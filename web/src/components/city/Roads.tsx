"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { RoadSegment } from "@/lib/city/layout";
import { LANE_WIDTH, MEDIAN_WIDTH, LOCAL_ROAD_WIDTH } from "@/lib/city/layout";

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

function createAsphaltTexture(type: "arterial" | "local", roadWidth: number) {
  if (typeof window === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 1. Draw base asphalt color
  const baseColor = type === "arterial" ? "#1a222f" : "#2a3442";
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  // 2. Add fine-grained noise for asphalt texture
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 12;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // 3. Add road markings (all markings are white now)
  const pxPerUnit = 512 / roadWidth;
  if (type === "arterial") {
    // Outer edge lines (solid white)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 0.35 * pxPerUnit;

    // Left edge
    ctx.beginPath();
    ctx.moveTo(0, 1.2 * pxPerUnit);
    ctx.lineTo(512, 1.2 * pxPerUnit);
    ctx.stroke();

    // Right edge
    ctx.beginPath();
    ctx.moveTo(0, 512 - 1.2 * pxPerUnit);
    ctx.lineTo(512, 512 - 1.2 * pxPerUnit);
    ctx.stroke();

    // Middle dashed line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 0.3 * pxPerUnit;
    ctx.setLineDash([4 * pxPerUnit, 6 * pxPerUnit]);
    ctx.beginPath();
    ctx.moveTo(0, 256);
    ctx.lineTo(512, 256);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (type === "local") {
    // Outer edge lines (solid white)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 0.3 * pxPerUnit;

    // Left edge
    ctx.beginPath();
    ctx.moveTo(0, 1.0 * pxPerUnit);
    ctx.lineTo(512, 1.0 * pxPerUnit);
    ctx.stroke();

    // Right edge
    ctx.beginPath();
    ctx.moveTo(0, 512 - 1.0 * pxPerUnit);
    ctx.lineTo(512, 512 - 1.0 * pxPerUnit);
    ctx.stroke();

    // Center double white line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 0.25 * pxPerUnit;

    ctx.beginPath();
    ctx.moveTo(0, 256 - 0.45 * pxPerUnit);
    ctx.lineTo(512, 256 - 0.45 * pxPerUnit);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 256 + 0.45 * pxPerUnit);
    ctx.lineTo(512, 256 + 0.45 * pxPerUnit);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function applyLocalUVs(geo: THREE.BufferGeometry, w: number, d: number) {
  const uvAttr = geo.getAttribute("uv") as THREE.BufferAttribute;
  const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
  const normalAttr = geo.getAttribute("normal") as THREE.BufferAttribute;
  if (!uvAttr || !posAttr) return;

  const count = posAttr.count;
  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const ny = normalAttr ? normalAttr.getY(i) : 0;

    if (ny > 0.5) {
      // Top face
      const u = (x + w / 2) / 30; // repeat every 30 world units
      const v = (z + d / 2) / d;  // maps exactly 0 to 1 across width
      uvAttr.setXY(i, u, v);
    } else {
      // Side/bottom faces: Map to dark asphalt color
      uvAttr.setXY(i, 0, 0.25);
    }
  }
  uvAttr.needsUpdate = true;
}

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
  applyUVs = false,
) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (applyUVs) {
    applyLocalUVs(geo, w, d);
  }
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

function appendMedianBoxes(
  medians: THREE.BufferGeometry[],
  seg: RoadSegment,
  roads: RoadSegment[],
  laneW: number,
  medianW: number,
  heightOffset: number,
) {
  const len = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
  if (len < 1) return;

  const isVertical = Math.abs(seg.x1 - seg.x2) < 0.1;
  const rotY = -Math.atan2(seg.z2 - seg.z1, seg.x2 - seg.x1);

  // End the green belt 35 units before the center of any intersection
  const gap = 35;
  const intersections: number[] = [];

  if (isVertical) {
    const cx = seg.x1;
    const minZ = Math.min(seg.z1, seg.z2);
    const maxZ = Math.max(seg.z1, seg.z2);

    const horizontalArterials = roads.filter(
      (r) => r.kind === "arterial" && Math.abs(r.z1 - r.z2) < 0.1,
    );

    for (const h of horizontalArterials) {
      const minHx = Math.min(h.x1, h.x2);
      const maxHx = Math.max(h.x1, h.x2);
      if (
        cx >= minHx - 0.1 &&
        cx <= maxHx + 0.1 &&
        h.z1 >= minZ - 0.1 &&
        h.z1 <= maxZ + 0.1
      ) {
        intersections.push(h.z1);
      }
    }

    intersections.sort((a, b) => a - b);

    const startZ = minZ;
    const endZ = maxZ;
    let prevZ = startZ;

    for (const cz of intersections) {
      const segmentEnd = cz - gap;
      if (segmentEnd - prevZ > 1.0) {
        const segLen = segmentEnd - prevZ;
        const segCenterZ = (prevZ + segmentEnd) / 2;
        appendOrientedBox(medians, cx, 0.22 + heightOffset, segCenterZ, rotY, 0, 0, 0, segLen, 0.32, medianW);
      }
      prevZ = cz + gap;
    }

    if (endZ - prevZ > 1.0) {
      const segLen = endZ - prevZ;
      const segCenterZ = (prevZ + endZ) / 2;
      appendOrientedBox(medians, cx, 0.22 + heightOffset, segCenterZ, rotY, 0, 0, 0, segLen, 0.32, medianW);
    }

  } else {
    const cz = seg.z1;
    const minX = Math.min(seg.x1, seg.x2);
    const maxX = Math.max(seg.x1, seg.x2);

    const verticalArterials = roads.filter(
      (r) => r.kind === "arterial" && Math.abs(r.x1 - r.x2) < 0.1,
    );

    for (const v of verticalArterials) {
      const minVz = Math.min(v.z1, v.z2);
      const maxVz = Math.max(v.z1, v.z2);
      if (
        v.x1 >= minX - 0.1 &&
        v.x1 <= maxX + 0.1 &&
        cz >= minVz - 0.1 &&
        cz <= maxVz + 0.1
      ) {
        intersections.push(v.x1);
      }
    }

    intersections.sort((a, b) => a - b);

    const startX = minX;
    const endX = maxX;
    let prevX = startX;

    for (const cx of intersections) {
      const segmentEnd = cx - gap;
      if (segmentEnd - prevX > 1.0) {
        const segLen = segmentEnd - prevX;
        const segCenterX = (prevX + segmentEnd) / 2;
        appendOrientedBox(medians, segCenterX, 0.22 + heightOffset, cz, rotY, 0, 0, 0, segLen, 0.32, medianW);
      }
      prevX = cx + gap;
    }

    if (endX - prevX > 1.0) {
      const segLen = endX - prevX;
      const segCenterX = (prevX + endX) / 2;
      appendOrientedBox(medians, segCenterX, 0.22 + heightOffset, cz, rotY, 0, 0, 0, segLen, 0.32, medianW);
    }
  }
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

    const isVertical = Math.abs(seg.x1 - seg.x2) < 0.1;
    const heightOffset = isVertical ? 0 : 0.002;

    const rotY = -angle;
    if (isArterial) {
      appendOrientedBox(sidewalks, cx, 0.02 + heightOffset, cz, rotY, 0, 0, 0, len + 2, 0.12, totalW + 4);
    } else {
      // Slightly lower local sidewalk to avoid z-fighting where it overlaps with arterial roads
      appendOrientedBox(sidewalks, cx, 0.019 + heightOffset, cz, rotY, 0, 0, 0, len + 2, 0.118, totalW + 4);
    }

    if (isArterial) {
      const off = medianW / 2 + laneW / 2;
      appendOrientedBox(arterialLanes, cx, 0.08 + heightOffset, cz, rotY, 0, 0, -off, len, 0.1, laneW, true);
      appendOrientedBox(arterialLanes, cx, 0.08 + heightOffset, cz, rotY, 0, 0, off, len, 0.1, laneW, true);

      // Elevated Median ending before intersections
      appendMedianBoxes(medians, seg, roads, laneW, medianW, heightOffset);
    } else {
      appendOrientedBox(localLanes, cx, 0.07 + heightOffset, cz, rotY, 0, 0, 0, len, 0.09, totalW * 0.85, true);
    }
  }

  // Find intersections of arterial roads to build zebra crossings
  const vertical = roads.filter((r) => r.kind === "arterial" && Math.abs(r.x1 - r.x2) < 0.1);
  const horizontal = roads.filter((r) => r.kind === "arterial" && Math.abs(r.z1 - r.z2) < 0.1);

  for (const v of vertical) {
    const minVz = Math.min(v.z1, v.z2);
    const maxVz = Math.max(v.z1, v.z2);
    for (const h of horizontal) {
      const minHx = Math.min(h.x1, h.x2);
      const maxHx = Math.max(h.x1, h.x2);

      if (
        v.x1 >= minHx - 0.1 &&
        v.x1 <= maxHx + 0.1 &&
        h.z1 >= minVz - 0.1 &&
        h.z1 <= maxVz + 0.1
      ) {
        const cx = v.x1;
        const cz = h.z1;
        const w = v.width;
        const d = h.width;

        const cDist = 4.5;
        const cWidth = 4.0;

        // North Crosswalk
        const ncz = cz - d / 2 - cDist;
        for (let sx = -w / 2 + 3; sx <= w / 2 - 3; sx += 3.5) {
          appendOrientedBox(markings, cx + sx, 0.14, ncz, 0, 0, 0, 0, 1.2, 0.015, cWidth);
        }

        // South Crosswalk
        const scz = cz + d / 2 + cDist;
        for (let sx = -w / 2 + 3; sx <= w / 2 - 3; sx += 3.5) {
          appendOrientedBox(markings, cx + sx, 0.14, scz, 0, 0, 0, 0, 1.2, 0.015, cWidth);
        }

        // West Crosswalk
        const wcx = cx - w / 2 - cDist;
        for (let sz = -d / 2 + 3; sz <= d / 2 - 3; sz += 3.5) {
          appendOrientedBox(markings, wcx, 0.14, cz + sz, 0, 0, 0, 0, cWidth, 0.015, 1.2);
        }

        // East Crosswalk
        const ecx = cx + w / 2 + cDist;
        for (let sz = -d / 2 + 3; sz <= d / 2 - 3; sz += 3.5) {
          appendOrientedBox(markings, ecx, 0.14, cz + sz, 0, 0, 0, 0, cWidth, 0.015, 1.2);
        }
      }
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

  const materials = useMemo(() => {
    const isClient = typeof window !== "undefined";
    const artTex = isClient ? createAsphaltTexture("arterial", LANE_WIDTH) : null;
    const localTex = isClient ? createAsphaltTexture("local", LOCAL_ROAD_WIDTH * 0.85) : null;

    return {
      sidewalk: new THREE.MeshStandardMaterial({ color: sidewalkColor, roughness: 0.92 }),
      localLane: new THREE.MeshStandardMaterial({
        color: ROAD_COLORS.localLane,
        map: localTex,
        bumpMap: localTex ?? undefined,
        bumpScale: 0.04,
        roughness: 0.88,
      }),
      arterialLane: new THREE.MeshStandardMaterial({
        color: ROAD_COLORS.arterialLane,
        map: artTex,
        bumpMap: artTex ?? undefined,
        bumpScale: 0.04,
        roughness: 0.85,
      }),
      median: new THREE.MeshStandardMaterial({ color: ROAD_COLORS.median, roughness: 0.9 }),
      marking: new THREE.MeshStandardMaterial({
        color: markingColor,
        roughness: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    };
  }, [sidewalkColor, markingColor]);

  useEffect(() => {
    return () => {
      geos.sidewalk.dispose();
      geos.localLane.dispose();
      geos.arterialLane.dispose();
      geos.median.dispose();
      geos.marking.dispose();
      materials.sidewalk.dispose();

      if (materials.localLane.map) {
        materials.localLane.map.dispose();
      }
      materials.localLane.dispose();

      if (materials.arterialLane.map) {
        materials.arterialLane.map.dispose();
      }
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
      <mesh geometry={geos.marking} material={materials.marking} receiveShadow castShadow />
    </group>
  );
}

export function RoadStrip({
  seg,
  sidewalkColor,
}: {
  seg: RoadSegment;
  sidewalkColor: string;
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

  const isVertical = Math.abs(seg.x1 - seg.x2) < 0.1;
  const heightOffset = isVertical ? 0 : 0.002;

  return (
    <group position={[cx, (isArterial ? 0.02 : 0.019) + heightOffset, cz]} rotation-y={-angle}>
      <mesh receiveShadow>
        <boxGeometry args={[len + 2, isArterial ? 0.12 : 0.118, totalW + 4]} />
        <meshStandardMaterial color={sidewalkColor} roughness={0.92} />
      </mesh>
      {isArterial && (
        <>
          <mesh position={[0, 0.08, -(medianW / 2 + laneW / 2)]} receiveShadow>
            <boxGeometry args={[len, 0.1, laneW]} />
            <meshStandardMaterial color={ROAD_COLORS.arterialLane} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.08, medianW / 2 + laneW / 2]} receiveShadow>
            <boxGeometry args={[len, 0.1, laneW]} />
            <meshStandardMaterial color={ROAD_COLORS.arterialLane} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.22, 0]} receiveShadow>
            <boxGeometry args={[len, 0.32, medianW]} />
            <meshStandardMaterial color={ROAD_COLORS.median} roughness={0.9} />
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
}: {
  roads: RoadSegment[];
  sidewalkColor: string;
}) {
  return (
    <group>
      {roads.map((seg) => (
        <RoadStrip
          key={seg.id}
          seg={seg}
          sidewalkColor={sidewalkColor}
        />
      ))}
    </group>
  );
}
