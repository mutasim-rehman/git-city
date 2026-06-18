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
  opacity = 1,
  transparent = false,
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
  opacity?: number;
  transparent?: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = buildings.length;

  const material = useMemo(
    () =>
      transparent
        ? new THREE.MeshPhysicalMaterial({
            color: "white",
            emissive: emissive ?? "#000000",
            emissiveIntensity,
            roughness: 0.05,
            metalness: 0.1,
            transmission: 1 - opacity,
            thickness: 0.5,
            transparent: true,
            opacity,
            envMapIntensity: 1.2,
          })
        : new THREE.MeshStandardMaterial({
            color: "white",
            emissive: emissive ?? color,
            emissiveIntensity,
            roughness: 0.55,
            metalness: 0.15,
          }),
    [color, emissive, emissiveIntensity, opacity, transparent],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    const baseColor = new THREE.Color(color);
    const tempColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const b = buildings[i]!;
      const [sx, sy, sz] = scaleFn(b);
      const oy = typeof offsetY === "function" ? offsetY(b) : offsetY ?? 0;
      const centerY = centerYFn?.(b) ?? b.height + oy;
      const rot = rotYFn?.(b) ?? 0;
      const [localX, localZ] = localOffsetFn?.(b) ?? [0, 0];
      setInstanceMatrix(mesh, i, b, centerY, sx, sy, sz, rot, localX, localZ);

      // Compute deterministic factor for the shade variation
      const seed = usernameSeed(b.username);
      const hash = Math.sin(seed * 12.9898) * 43758.5453;
      const factor = (hash - Math.floor(hash)) * 0.16 - 0.08; // float in [-0.08, 0.08]

      tempColor.copy(baseColor);
      tempColor.r = Math.max(0, Math.min(1, tempColor.r * (1 + factor)));
      tempColor.g = Math.max(0, Math.min(1, tempColor.g * (1 + factor)));
      tempColor.b = Math.max(0, Math.min(1, tempColor.b * (1 + factor)));

      mesh.setColorAt(i, tempColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.count = count;
  }, [buildings, centerYFn, count, localOffsetFn, offsetY, scaleFn, rotYFn, color]);

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
        color: "white",
        emissive,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.1,
      }),
    [emissive],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;
    const baseColor = new THREE.Color(color);
    const tempColor = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const b = buildings[i]!;
      const s = Math.min(b.width, b.depth) * 0.14;
      setInstanceMatrix(mesh, i, b, b.height + s * 0.6, s, s, s);

      // Compute deterministic factor for the shade variation
      const seed = usernameSeed(b.username);
      const hash = Math.sin(seed * 12.9898) * 43758.5453;
      const factor = (hash - Math.floor(hash)) * 0.16 - 0.08; // float in [-0.08, 0.08]

      tempColor.copy(baseColor);
      tempColor.r = Math.max(0, Math.min(1, tempColor.r * (1 + factor)));
      tempColor.g = Math.max(0, Math.min(1, tempColor.g * (1 + factor)));
      tempColor.b = Math.max(0, Math.min(1, tempColor.b * (1 + factor)));

      mesh.setColorAt(i, tempColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.count = count;
  }, [buildings, count, color]);

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