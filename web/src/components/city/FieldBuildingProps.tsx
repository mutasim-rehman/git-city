"use client";

import { memo, useEffect, useMemo } from "react";
import type { ComponentType } from "react";
import * as THREE from "three";
import type { BuildingFieldStyle, PositionedBuilding } from "@/lib/types";
import { FIELD_STYLE_META } from "@/lib/city/buildingFieldStyles";
import { AiMlBuilding } from "./fieldBuildings/AiMlBuilding";
import { BackendBuilding } from "./fieldBuildings/BackendBuilding";
import { BlockchainBuilding } from "./fieldBuildings/BlockchainBuilding";
import { CybersecurityBuilding } from "./fieldBuildings/CybersecurityBuilding";
import { DataScienceBuilding } from "./fieldBuildings/DataScienceBuilding";
import { DesignBuilding } from "./fieldBuildings/DesignBuilding";
import { DevopsBuilding } from "./fieldBuildings/DevopsBuilding";
import { FrontendBuilding } from "./fieldBuildings/FrontendBuilding";
import { FullStackBuilding } from "./fieldBuildings/FullStackBuilding";
import { GameDevBuilding } from "./fieldBuildings/GameDevBuilding";
import { MobileBuilding } from "./fieldBuildings/MobileBuilding";
import { OtherBuilding } from "./fieldBuildings/OtherBuilding";
import type {
  FieldBuildingComponentProps,
  FieldBuildingGeometries,
} from "./fieldBuildings/shared";
import { BuildingFacadeDetails } from "./fieldBuildings/facadeDetails";

const FIELD_BUILDING_COMPONENTS: Record<
  BuildingFieldStyle,
  ComponentType<FieldBuildingComponentProps>
> = {
  data_science: DataScienceBuilding,
  full_stack: FullStackBuilding,
  frontend: FrontendBuilding,
  backend: BackendBuilding,
  ai_ml: AiMlBuilding,
  cybersecurity: CybersecurityBuilding,
  devops: DevopsBuilding,
  mobile: MobileBuilding,
  game_dev: GameDevBuilding,
  blockchain: BlockchainBuilding,
  design: DesignBuilding,
  other: OtherBuilding,
};

export const FieldBuildingProps = memo(function FieldBuildingProps({
  buildings,
}: {
  buildings: PositionedBuilding[];
}) {
  const geometries = useMemo<FieldBuildingGeometries>(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 6),
      cone: new THREE.ConeGeometry(1, 1, 4),
      dome: new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      sphere: new THREE.SphereGeometry(1, 8, 6),
    }),
    [],
  );

  useEffect(
    () => () => {
      geometries.box.dispose();
      geometries.cylinder.dispose();
      geometries.cone.dispose();
      geometries.dome.dispose();
      geometries.sphere.dispose();
    },
    [geometries],
  );

  const byStyle = useMemo(() => {
    const map = new Map<BuildingFieldStyle, PositionedBuilding[]>();
    for (const b of buildings) {
      const list = map.get(b.fieldStyle) ?? [];
      list.push(b);
      map.set(b.fieldStyle, list);
    }
    return map;
  }, [buildings]);

  if (buildings.length === 0) return null;

  return (
    <group>
      {Array.from(byStyle.entries()).map(([style, group]) => {
        const Component = FIELD_BUILDING_COMPONENTS[style];
        return (
          <Component
            key={style}
            buildings={group}
            geometries={geometries}
            meta={FIELD_STYLE_META[style]}
          />
        );
      })}
      <BuildingFacadeDetails buildings={buildings} geometry={geometries.box} />
    </group>
  );
});
