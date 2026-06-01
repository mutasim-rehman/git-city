import fs from "fs";
import path from "path";

const root = path.join(process.cwd(), "src", "components");
const lines = fs.readFileSync(path.join(root, "CityCanvas.tsx"), "utf8").split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

function writeComponent(relPath, header, body, exports = "") {
  const out = `${header}\n${body}\n${exports}`.trim() + "\n";
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, out);
  console.log("wrote", relPath, out.length);
}

// Mountains: rename function Mountains -> export function Mountains, remove duplicate seededRng comment header
let mountainsBody = slice(510, 954);
mountainsBody = mountainsBody.replace(/^function Mountains/m, "export function Mountains");
writeComponent(
  "city/Mountains.tsx",
  `"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { PositionedBuilding } from "@/lib/types";
import type { LayoutRect } from "@/lib/city/layout";`,
  mountainsBody,
);

let skyBody = slice(134, 207);
skyBody = skyBody
  .replace(/^function SkyDome/m, "export function SkyDome")
  .replace(/^function Stars/m, "export function Stars")
  .replace(/^function GroundPlane/m, "export function GroundPlane");
writeComponent(
  "city/Sky.tsx",
  `"use client";

import { useMemo } from "react";
import * as THREE from "three";

function seededRng(seed: number): number {
  return Math.abs((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1);
}`,
  skyBody,
);

let monumentBody = slice(209, 269);
monumentBody = monumentBody.replace(/^function Monument/m, "export function Monument");
writeComponent(
  "city/Monument.tsx",
  `"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";`,
  monumentBody,
);

let moonBody = slice(271, 371);
const moonHeader = `"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

export const MOON_LIGHT_LAYER = 10;
const MOON_ROTATION_DEG: [number, number, number] = [180, -40, 180];`;
moonBody = moonBody
  .replace(/^const MOON_LIGHT_LAYER = 10;\r?\n/, "")
  .replace(/^const MOON_ROTATION_DEG[^\n]+\n/, "")
  .replace(/^function EnableMoonLayerOnCamera/m, "export function EnableMoonLayerOnCamera")
  .replace(/^function MoonOnlyAmbient/m, "export function MoonOnlyAmbient")
  .replace(/^function MoonBeamFromCity/m, "export function MoonBeamFromCity")
  .replace(/^function Moon/m, "export function Moon");
writeComponent("city/Moon.tsx", moonHeader, moonBody);

let cloudsBody = slice(956, 1010);
cloudsBody = cloudsBody
  .replace(/^interface CloudGroupData/, "interface CloudGroupData")
  .replace(/^function buildCloudBlobs/m, "function buildCloudBlobs")
  .replace(/^function Cloud/m, "function Cloud")
  .replace(/^function Clouds/m, "export function Clouds");
writeComponent(
  "city/Clouds.tsx",
  `"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

function seededRng(seed: number): number {
  return Math.abs((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1);
}`,
  cloudsBody,
);

let cameraBody = slice(1012, 1056);
cameraBody = cameraBody.replace(/^function CameraFocus/m, "export function CameraFocus");
writeComponent(
  "city/CameraView.tsx",
  `"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";`,
  cameraBody +
    `

export function OrbitCityCamera({
  focusPosition,
  controlsRef,
}: {
  focusPosition: [number, number, number] | null;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.1}
        minDistance={250}
        maxDistance={3200}
        enableDamping
        dampingFactor={0.06}
      />
      <CameraFocus focusPosition={focusPosition} controlsRef={controlsRef} />
    </>
  );
}`,
);

let buildingsBody = slice(373, 508);
buildingsBody = buildingsBody
  .replace(/^function createBuildingSignTexture/m, "function createBuildingSignTexture")
  .replace(/^function BuildingSignBoards/m, "export function BuildingSignBoards")
  .replace(/^function PulseTargetBuilding/m, "export function PulseTargetBuilding");
writeComponent(
  "city/BuildingExtras.tsx",
  `"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PositionedBuilding } from "@/lib/types";`,
  buildingsBody,
);

let streetBody = slice(1058, 1519);
streetBody = streetBody
  .replace(/^export type \{ CarVariant \};\r?\n\r?\n/, "")
  .replace(/^type NetPlayerState/m, "export type NetPlayerState")
  .replace(/^function StreetCar/m, "function StreetCar")
  .replace(/^function VehicleLabel/m, "function VehicleLabel")
  .replace(/^function RemoteStreetCar/m, "function RemoteStreetCar")
  .replace(/^function StreetView/m, "export function StreetView");
writeComponent(
  "city/StreetView.tsx",
  `"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityId, PositionedBuilding } from "@/lib/types";
import { Game } from "@/game/Game";
import type { RoadGraph } from "@/game/world/RoadGraph";
import { NpcTraffic } from "@/game/ai/NpcTraffic";
import {
  CAR_CONFIGS,
  DEFAULT_CAR_VARIANT,
  type CarVariant,
} from "@/game/content/cars";

export type { CarVariant };

function lerpAngle(a: number, b: number, t: number): number {
  const twoPi = Math.PI * 2;
  const diff = ((b - a + Math.PI) % twoPi) - Math.PI;
  return a + diff * t;
}`,
  streetBody,
);

console.log("done");
