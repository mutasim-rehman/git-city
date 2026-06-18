"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BuildingFieldStyle, PositionedBuilding } from "@/lib/types";
import { usernameSeed } from "./shared";

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0);
const _scale = new THREE.Vector3(1, 1, 1);

type FacadeFace = "front" | "back" | "left" | "right";

interface WindowSlot {
  building: PositionedBuilding;
  centerY: number;
  localX: number;
  localZ: number;
  width: number;
  height: number;
  depth: number;
  lit: boolean;
}

interface MortarSlot {
  building: PositionedBuilding;
  centerY: number;
  localX: number;
  localZ: number;
  width: number;
  height: number;
  depth: number;
}

const STYLES_WITH_FRONT_FACADE: ReadonlySet<BuildingFieldStyle> = new Set([
  "frontend",
  "other",
  "backend",
]);

const STYLES_WITHOUT_WINDOW_GRID: ReadonlySet<BuildingFieldStyle> = new Set([
  "data_science",
]);

const FACE_EPSILON = 0.42;

function setSlotMatrix(
  mesh: THREE.InstancedMesh,
  index: number,
  b: PositionedBuilding,
  centerY: number,
  localX: number,
  localZ: number,
  sx: number,
  sy: number,
  sz: number,
) {
  const rotY = b.rotationY ?? 0;
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  _position.set(
    b.x + localX * c - localZ * s,
    centerY,
    b.z + localX * s + localZ * c,
  );
  _scale.set(sx, sy, sz);
  _euler.y = rotY;
  _quaternion.setFromEuler(_euler);
  _matrix.compose(_position, _quaternion, _scale);
  mesh.setMatrixAt(index, _matrix);
}

function buildWindowSlots(
  buildings: PositionedBuilding[],
  face: FacadeFace,
  yMinFrac: number,
  yMaxFrac: number,
  faceInsetFrac: number,
): WindowSlot[] {
  const slots: WindowSlot[] = [];

  for (const b of buildings) {
    const cols =
      face === "front" || face === "back"
        ? b.windowsPerFloor
        : b.sideWindowsPerFloor;
    const rows = Math.max(1, Math.min(b.floors, 8));
    const seed = usernameSeed(b.username);

    const faceSpan =
      face === "front" || face === "back"
        ? b.width * faceInsetFrac
        : b.depth * faceInsetFrac;
    const bodyH = b.height * (yMaxFrac - yMinFrac);
    const baseY = b.height * yMinFrac;
    const pad = faceSpan * 0.1;
    const cellW = (faceSpan - pad * 2) / cols;
    const cellH = (bodyH - pad * 2) / rows;
    const winW = cellW * 0.58;
    const winH = cellH * 0.62;
    const winD = 0.32;

    const halfW = (b.width * faceInsetFrac) / 2;
    const halfD = (b.depth * faceInsetFrac) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const litRoll = ((seed + row * 19 + col * 37) % 100) / 100;
        const lit = litRoll < b.litPercentage;
        const along = -faceSpan / 2 + pad + cellW * (col + 0.5);
        const centerY = baseY + pad + cellH * (row + 0.5);

        let localX = 0;
        let localZ = 0;
        let width = winW;
        let depth = winD;

        switch (face) {
          case "front":
            localX = along;
            localZ = halfD + FACE_EPSILON;
            break;
          case "back":
            localX = -along;
            localZ = -(halfD + FACE_EPSILON);
            break;
          case "left":
            localX = -(halfW + FACE_EPSILON);
            localZ = along;
            width = winD;
            depth = winW;
            break;
          case "right":
            localX = halfW + FACE_EPSILON;
            localZ = -along;
            width = winD;
            depth = winW;
            break;
        }

        slots.push({
          building: b,
          centerY,
          localX,
          localZ,
          width,
          height: winH,
          depth,
          lit,
        });
      }
    }
  }

  return slots;
}

function buildMortarSlots(
  buildings: PositionedBuilding[],
  face: FacadeFace,
  yMinFrac: number,
  yMaxFrac: number,
  faceInsetFrac: number,
): MortarSlot[] {
  const slots: MortarSlot[] = [];

  for (const b of buildings) {
    const rows = Math.max(2, Math.min(b.floors, 7));
    const faceSpan =
      face === "front" || face === "back"
        ? b.width * faceInsetFrac
        : b.depth * faceInsetFrac;
    const bodyH = b.height * (yMaxFrac - yMinFrac);
    const baseY = b.height * yMinFrac;
    const bandH = Math.max(0.18, bodyH * 0.012);

    const halfW = (b.width * faceInsetFrac) / 2;
    const halfD = (b.depth * faceInsetFrac) / 2;

    for (let row = 1; row < rows; row++) {
      const centerY = baseY + (bodyH * row) / rows;
      let localX = 0;
      let localZ = 0;
      let width = faceSpan * 0.94;
      let depth = 0.22;

      switch (face) {
        case "front":
          localZ = halfD + FACE_EPSILON * 0.6;
          break;
        case "back":
          localZ = -(halfD + FACE_EPSILON * 0.6);
          break;
        case "left":
          localX = -(halfW + FACE_EPSILON * 0.6);
          width = 0.22;
          depth = faceSpan * 0.94;
          break;
        case "right":
          localX = halfW + FACE_EPSILON * 0.6;
          width = 0.22;
          depth = faceSpan * 0.94;
          break;
      }

      slots.push({
        building: b,
        centerY,
        localX,
        localZ,
        width,
        height: bandH,
        depth,
      });
    }
  }

  return slots;
}

function InstancedWindowBatch({
  slots,
  geometry,
  color,
  emissive,
  emissiveIntensity,
}: {
  slots: WindowSlot[];
  geometry: THREE.BoxGeometry;
  color: string;
  emissive: string;
  emissiveIntensity: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = slots.length;

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity,
        roughness: 0.25,
        metalness: 0.05,
      }),
    [color, emissive, emissiveIntensity],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    for (let i = 0; i < count; i++) {
      const slot = slots[i]!;
      setSlotMatrix(
        mesh,
        i,
        slot.building,
        slot.centerY,
        slot.localX,
        slot.localZ,
        slot.width,
        slot.height,
        slot.depth,
      );
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = count;
  }, [count, slots]);

  useEffect(() => () => material.dispose(), [material]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      castShadow
    />
  );
}

function InstancedMortarBatch({
  slots,
  geometry,
}: {
  slots: MortarSlot[];
  geometry: THREE.BoxGeometry;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = slots.length;

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#4a4642",
        emissive: "#000000",
        emissiveIntensity: 0,
        roughness: 0.85,
        metalness: 0,
      }),
    [],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    for (let i = 0; i < count; i++) {
      const slot = slots[i]!;
      setSlotMatrix(
        mesh,
        i,
        slot.building,
        slot.centerY,
        slot.localX,
        slot.localZ,
        slot.width,
        slot.height,
        slot.depth,
      );
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = count;
  }, [count, slots]);

  useEffect(() => () => material.dispose(), [material]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      castShadow
    />
  );
}

function FacadeFaceDetails({
  buildings,
  face,
  geometry,
  yMinFrac = 0.06,
  yMaxFrac = 0.82,
  faceInsetFrac = 0.84,
  includeMortar = true,
}: {
  buildings: PositionedBuilding[];
  face: FacadeFace;
  geometry: THREE.BoxGeometry;
  yMinFrac?: number;
  yMaxFrac?: number;
  faceInsetFrac?: number;
  includeMortar?: boolean;
}) {
  const windowSlots = useMemo(
    () => buildWindowSlots(buildings, face, yMinFrac, yMaxFrac, faceInsetFrac),
    [buildings, face, faceInsetFrac, yMaxFrac, yMinFrac],
  );

  const mortarSlots = useMemo(
    () =>
      includeMortar
        ? buildMortarSlots(buildings, face, yMinFrac, yMaxFrac, faceInsetFrac)
        : [],
    [buildings, face, faceInsetFrac, includeMortar, yMaxFrac, yMinFrac],
  );

  const litSlots = useMemo(
    () => windowSlots.filter((slot) => slot.lit),
    [windowSlots],
  );
  const darkSlots = useMemo(
    () => windowSlots.filter((slot) => !slot.lit),
    [windowSlots],
  );

  const frameSlots = useMemo(
    () =>
      windowSlots.map((slot) => ({
        ...slot,
        width: slot.width * 1.18,
        height: slot.height * 1.14,
        depth: slot.depth * 1.35,
      })),
    [windowSlots],
  );

  return (
    <>
      <InstancedWindowBatch
        slots={frameSlots}
        geometry={geometry}
        color="#3a3632"
        emissive="#000000"
        emissiveIntensity={0}
      />
      <InstancedWindowBatch
        slots={darkSlots}
        geometry={geometry}
        color="#1a2030"
        emissive="#0a1020"
        emissiveIntensity={0.04}
      />
      <InstancedWindowBatch
        slots={litSlots}
        geometry={geometry}
        color="#f0d890"
        emissive="#ffe8a8"
        emissiveIntensity={0.38}
      />
      <InstancedMortarBatch slots={mortarSlots} geometry={geometry} />
    </>
  );
}

export function BuildingFacadeDetails({
  buildings,
  geometry,
}: {
  buildings: PositionedBuilding[];
  geometry: THREE.BoxGeometry;
}) {
  const detailedBuildings = useMemo(
    () => buildings.filter((b) => !STYLES_WITHOUT_WINDOW_GRID.has(b.fieldStyle)),
    [buildings],
  );
  const frontBuildings = useMemo(
    () =>
      detailedBuildings.filter(
        (b) => !STYLES_WITH_FRONT_FACADE.has(b.fieldStyle),
      ),
    [detailedBuildings],
  );

  if (detailedBuildings.length === 0) return null;

  return (
    <>
      <FacadeFaceDetails
        buildings={frontBuildings}
        face="front"
        geometry={geometry}
      />
      <FacadeFaceDetails
        buildings={detailedBuildings}
        face="back"
        geometry={geometry}
      />
      <FacadeFaceDetails
        buildings={detailedBuildings}
        face="left"
        geometry={geometry}
        includeMortar={false}
      />
      <FacadeFaceDetails
        buildings={detailedBuildings}
        face="right"
        geometry={geometry}
        includeMortar={false}
      />
    </>
  );
}
