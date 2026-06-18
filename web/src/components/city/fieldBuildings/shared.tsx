"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PositionedBuilding } from "@/lib/types";
import type { FieldStyleMeta } from "@/lib/city/buildingFieldStyles";
import {
  getFieldSurfaceTexture,
  type FieldSurfaceKind,
} from "./fieldBuildingTextures";

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

function updateInstancedBounds(mesh: THREE.InstancedMesh, buildings: PositionedBuilding[]) {
  let maxDist = 0;
  let maxHeight = 0;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i]!;
    maxDist = Math.max(maxDist, Math.hypot(b.x, b.z));
    maxHeight = Math.max(maxHeight, b.height);
  }
  const radius = Math.hypot(maxDist, maxHeight) + 250;
  mesh.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, maxHeight / 2, 0),
    radius,
  );
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
  surface = "plain",
  transparent = false,
  opacity = 1,
  roughness,
  metalness,
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
  surface?: FieldSurfaceKind;
  transparent?: boolean;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  offsetY?: number | ((b: PositionedBuilding) => number);
  centerYFn?: (b: PositionedBuilding) => number;
  localOffsetFn?: (b: PositionedBuilding) => [number, number];
  scaleFn: (b: PositionedBuilding) => [number, number, number];
  rotYFn?: (b: PositionedBuilding) => number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = buildings.length;

  const material = useMemo(() => {
    if (transparent) {
      return new THREE.MeshStandardMaterial({
        color,
        emissive: emissive ?? color,
        emissiveIntensity,
        roughness: roughness ?? 0.12,
        metalness: metalness ?? 0.08,
        transparent: true,
        opacity,
        depthWrite: opacity > 0.92,
      });
    }

    const mat = new THREE.MeshLambertMaterial({
      color,
      emissive: emissive ?? color,
      emissiveIntensity,
    });

    if (surface !== "plain") {
      mat.map = getFieldSurfaceTexture(surface);
    }

    return mat;
  }, [
    color,
    emissive,
    emissiveIntensity,
    metalness,
    opacity,
    roughness,
    surface,
    transparent,
  ]);

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
    updateInstancedBounds(mesh, buildings);
  }, [buildings, centerYFn, count, localOffsetFn, offsetY, scaleFn, rotYFn]);

  useEffect(() => () => material.dispose(), [material]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled
      castShadow={false}
      receiveShadow={false}
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
      new THREE.MeshLambertMaterial({
        color,
        emissive,
        emissiveIntensity: 0.8,
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
    updateInstancedBounds(mesh, buildings);
  }, [buildings, count]);

  useEffect(() => () => material.dispose(), [material]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometries.sphere, material, count]}
      frustumCulled
      castShadow={false}
      receiveShadow={false}
    />
  );
}
