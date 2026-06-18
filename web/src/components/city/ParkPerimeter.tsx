"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { LayoutRect } from "@/lib/city/layout";
import { PARK_COLORS } from "@/components/city/CentralPark";

const PROMENADE_WIDTH = 12;
const PATH_Y = 0.048;
const PATH_HEIGHT = 0.07;
const LAMP_SPACING = 36;

function appendBox(
  buckets: THREE.BufferGeometry[],
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  if (w <= 0 || d <= 0) return;
  const geo = new THREE.BoxGeometry(w, PATH_HEIGHT, d);
  geo.translate((minX + maxX) / 2, PATH_Y, (minZ + maxZ) / 2);
  buckets.push(geo);
}

function buildPromenadeGeometry(park: LayoutRect) {
  const { minX, maxX, minZ, maxZ } = park;
  const p = PROMENADE_WIDTH;
  const buckets: THREE.BufferGeometry[] = [];

  appendBox(buckets, minX - p, minX, minZ - p, maxZ + p);
  appendBox(buckets, maxX, maxX + p, minZ - p, maxZ + p);
  appendBox(buckets, minX, maxX, minZ - p, minZ);
  appendBox(buckets, minX, maxX, maxZ, maxZ + p);

  const merged = mergeGeometries(buckets, false);
  for (const g of buckets) g.dispose();
  return merged ?? new THREE.BufferGeometry();
}

function buildLampPlacements(park: LayoutRect) {
  const { minX, maxX, minZ, maxZ } = park;
  const p = PROMENADE_WIDTH;
  const out: { x: number; z: number; rotY: number }[] = [];

  const westX = minX - p / 2;
  const eastX = maxX + p / 2;
  const northZ = minZ - p / 2;
  const southZ = maxZ + p / 2;

  for (let z = minZ; z <= maxZ; z += LAMP_SPACING) {
    out.push({ x: westX, z, rotY: Math.PI / 2 });
    out.push({ x: eastX, z, rotY: -Math.PI / 2 });
  }
  for (let x = minX; x <= maxX; x += LAMP_SPACING) {
    out.push({ x, z: northZ, rotY: 0 });
    out.push({ x, z: southZ, rotY: Math.PI });
  }

  return out;
}

export function ParkPerimeterPromenade({ park }: { park: LayoutRect }) {
  const pathGeo = useMemo(() => buildPromenadeGeometry(park), [park]);
  const lampPlacements = useMemo(() => buildLampPlacements(park), [park]);

  const pathMat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: PARK_COLORS.path,
      }),
    [],
  );

  const postGeo = useMemo(() => {
    const post = new THREE.BoxGeometry(0.35, 7.2, 0.35);
    post.translate(0, 3.6, 0);
    const arm = new THREE.BoxGeometry(0.3, 0.3, 1.0);
    arm.translate(0, 7.0, 0.5);
    const merged = mergeGeometries([post, arm], false);
    post.dispose();
    arm.dispose();
    return merged ?? new THREE.BoxGeometry(0.35, 7.2, 0.35);
  }, []);

  const lanternGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.55, 0.9, 0.55);
    geo.translate(0, 6.8, 1.0);
    return geo;
  }, []);

  const postMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: "#334155" }),
    [],
  );
  const lanternMat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: PARK_COLORS.lantern,
        emissive: "#eab308",
        emissiveIntensity: 1.2,
      }),
    [],
  );

  const postRef = useRef<THREE.InstancedMesh>(null);
  const lanternRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const postMesh = postRef.current;
    const lanternMesh = lanternRef.current;
    if (!postMesh || !lanternMesh || lampPlacements.length === 0) return;

    for (let i = 0; i < lampPlacements.length; i++) {
      const lamp = lampPlacements[i]!;
      tmp.position.set(lamp.x, 0, lamp.z);
      tmp.rotation.set(0, lamp.rotY, 0);
      tmp.scale.setScalar(1);
      tmp.updateMatrix();
      postMesh.setMatrixAt(i, tmp.matrix);
      lanternMesh.setMatrixAt(i, tmp.matrix);
    }
    postMesh.count = lampPlacements.length;
    lanternMesh.count = lampPlacements.length;
    postMesh.instanceMatrix.needsUpdate = true;
    lanternMesh.instanceMatrix.needsUpdate = true;
  }, [lampPlacements, tmp]);

  useLayoutEffect(
    () => () => {
      pathGeo.dispose();
      pathMat.dispose();
      postGeo.dispose();
      lanternGeo.dispose();
      postMat.dispose();
      lanternMat.dispose();
    },
    [lanternGeo, lanternMat, pathGeo, pathMat, postGeo, postMat],
  );

  return (
    <group>
      <mesh geometry={pathGeo} material={pathMat} receiveShadow />

      {lampPlacements.length > 0 && (
        <>
          <instancedMesh
            ref={postRef}
            args={[postGeo, postMat, lampPlacements.length]}
            frustumCulled={false}
            castShadow={false}
          />
          <instancedMesh
            ref={lanternRef}
            args={[lanternGeo, lanternMat, lampPlacements.length]}
            frustumCulled={false}
            castShadow={false}
          />
        </>
      )}
    </group>
  );
}
