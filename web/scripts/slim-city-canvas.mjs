import fs from "fs";
import path from "path";

const file = path.join(process.cwd(), "src", "components", "CityCanvas.tsx");
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

// Keep: 1-47 (without sign texture), 94-132 (theme), 1521-end
const kept = [
  ...lines.slice(0, 47),
  ...lines.slice(93, 132),
  ...lines.slice(1520),
];

const imports = `"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityId, CityTheme, PositionedBuilding } from "@/lib/types";
import { createWindowAtlas } from "@/lib/city/windowAtlas";
import {
  InstancedBuildings,
  BuildingSignBoards,
  PulseTargetBuilding,
} from "@/components/city/Buildings";
import type { CityLayoutResult, LayoutRect } from "@/lib/city/layout";
import { Game } from "@/game/Game";
import { createGridRoadGraph, nearestRoadNode } from "@/game/world/RoadGraph";
import type { RoadGraph } from "@/game/world/RoadGraph";
import { SectorCityTerrain, cityExtentFromBounds } from "@/components/SectorCityTerrain";
import type { RoadNodeId } from "@/game/world/RoadGraph";
import { aStar } from "@/game/routing/aStar";
import { Minimap } from "@/game/ui/Minimap";
import { NpcTraffic } from "@/game/ai/NpcTraffic";
import { CAR_CONFIGS, DEFAULT_CAR_VARIANT, type CarVariant } from "@/game/content/cars";
import { SkyDome, Stars, SunDisc } from "@/components/city/Sky";
import { GroundPlane } from "@/components/city/Ground";
import { Monument } from "@/components/city/Monument";
import {
  EnableMoonLayerOnCamera,
  MoonOnlyAmbient,
  MoonBeamFromCity,
  Moon,
  MOON_LIGHT_LAYER,
} from "@/components/city/Moon";
import { Mountains } from "@/components/city/Mountains";
import { Clouds } from "@/components/city/Clouds";
import { OrbitCityCamera } from "@/components/city/CameraView";
import { StreetView, type NetPlayerState } from "@/components/city/StreetView";

`;

// Remove duplicate "use client" and old imports from kept[0]
let body = kept.join("\n");
body = body.replace(/^"use client";\r?\n\r?\n[\s\S]*?from "@\/game\/content\/cars";\r?\n\r?\n/, "");

const out = imports + body;
fs.writeFileSync(file, out);
console.log("CityCanvas lines:", out.split("\n").length);
