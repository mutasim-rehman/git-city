"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PositionedBuilding } from "@/lib/types";
import type { FieldStyleMeta } from "@/lib/city/buildingFieldStyles";

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0);
const _scale = new THREE.Vector3(1, 1, 1);

export interface FieldBuildingGeometries {
  box: THREE.BoxGeometry;
  cylinder: THREE.CylinderGeometry;
  cone: THREE.ConeGeometry;
  dome: THREE.SphereGeometry;
  sphere: THREE.SphereGeometry;
}

export interface FieldBuildingComponentProps {
  buildings: PositionedBuilding[];
  geometries: FieldBuildingGeometries;
  meta: FieldStyleMeta;
}

export function usernameSeed(username: string): number {
  let s = 0;
  for (let i = 0; i < username.length; i++) s += username.charCodeAt(i);
  return s;
}

export function roofScale(b: PositionedBuilding): [number, number, number] {
  const base = Math.min(b.width, b.depth);
  return [base * 0.42, base * 0.18, base * 0.42];
}

function setInstanceMatrix(
  mesh: THREE.InstancedMesh,
  index: number,
  b: PositionedBuilding,
  centerY: number,
  sx: number,
  sy: number,
  sz: number,
  rotY = 0,
  localX = 0,
  localZ = 0,
) {
  const baseRot = b.rotationY ?? 0;
  const c = Math.cos(baseRot);
  const s = Math.sin(baseRot);
  _position.set(
    b.x + localX * c - localZ * s,
    centerY,
    b.z + localX * s + localZ * c,
  );
  _scale.set(sx, sy, sz);
  _euler.y = baseRot + rotY;
  _quaternion.setFromEuler(_euler);
  _matrix.compose(_position, _quaternion, _scale);
  mesh.setMatrixAt(index, _matrix);
}

export function InstancedPropLayer({
  buildings,
  geometry,
  color,
  emissive,
  emissiveIntensity = 0.35,
  offsetY,
  centerYFn,
  localOffsetFn,
  scaleFn,
  rotYFn,
}: {
  buildings: PositionedBuilding[];
  geometry: THREE.BufferGeometry;
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  offsetY?: number | ((b: PositionedBuilding) => number);
  centerYFn?: (b: PositionedBuilding) => number;
  localOffsetFn?: (b: PositionedBuilding) => [number, number];
  scaleFn: (b: PositionedBuilding) => [number, number, number];
  rotYFn?: (b: PositionedBuilding) => number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = buildings.length;

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: emissive ?? color,
        emissiveIntensity,
        roughness: 0.55,
        metalness: 0.15,
      }),
    [color, emissive, emissiveIntensity],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    for (let i = 0; i < count; i++) {
      const b = buildings[i]!;
      const [sx, sy, sz] = scaleFn(b);
      const oy = typeof offsetY === "function" ? offsetY(b) : offsetY ?? 0;
      const centerY = centerYFn?.(b) ?? b.height + oy;
      const rot = rotYFn?.(b) ?? 0;
      const [localX, localZ] = localOffsetFn?.(b) ?? [0, 0];
      setInstanceMatrix(mesh, i, b, centerY, sx, sy, sz, rot, localX, localZ);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = count;
  }, [buildings, centerYFn, count, localOffsetFn, offsetY, scaleFn, rotYFn]);

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

export function OrbLayer({
  buildings,
  geometries,
  color = "#c084fc",
  emissive = "#a855f7",
}: {
  buildings: PositionedBuilding[];
  geometries: FieldBuildingGeometries;
  color?: string;
  emissive?: string;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = buildings.length;
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.1,
      }),
    [color, emissive],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;
    for (let i = 0; i < count; i++) {
      const b = buildings[i]!;
      const s = Math.min(b.width, b.depth) * 0.14;
      setInstanceMatrix(mesh, i, b, b.height + s * 0.6, s, s, s);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = count;
  }, [buildings, count]);

  useEffect(() => () => material.dispose(), [material]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometries.sphere, material, count]}
      frustumCulled={false}
      castShadow
    />
  );
}
