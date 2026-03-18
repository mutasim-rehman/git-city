import * as THREE from "three";
import type { RoadGraph, RoadNodeId } from "../world/RoadGraph";
import { nodeWorldPosition } from "../world/RoadGraph";
import { aStar } from "../routing/aStar";
import type { VehicleState } from "../state";
import { createDefaultVehicleState, DEFAULT_VEHICLE_TUNING } from "../state";
import { VehicleController } from "../physics/VehicleController";

type NpcCar = {
  id: number;
  vehicle: VehicleState;
  controller: VehicleController;
  route: RoadNodeId[];
  routeIdx: number;
  targetSpeed: number;
  color: THREE.Color;
};

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

function angleDelta(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function seededRng(seed: number): number {
  return Math.abs((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1);
}

export class NpcTraffic {
  private readonly graph: RoadGraph;
  private readonly maxCars: number;
  private cars: NpcCar[] = [];

  constructor(graph: RoadGraph, maxCars = 10) {
    this.graph = graph;
    this.maxCars = Math.max(0, Math.min(48, maxCars));
    this.seedInitialCars();
  }

  getCars() {
    return this.cars;
  }

  private randomNode(seed: number) {
    const nodes = Array.from(this.graph.nodes.keys());
    const idx = Math.floor(seededRng(seed) * nodes.length);
    return nodes[Math.max(0, Math.min(nodes.length - 1, idx))];
  }

  private seedInitialCars() {
    const count = this.maxCars;
    const nextCars: NpcCar[] = [];
    for (let i = 0; i < count; i++) {
      const start = this.randomNode(1000 + i * 17);
      const goal = this.randomNode(2000 + i * 31);
      const route = aStar(this.graph, start, goal);
      const startPos = nodeWorldPosition(this.graph, start);
      const yaw = seededRng(i * 41) * Math.PI * 2;

      const controller = new VehicleController({
        ...DEFAULT_VEHICLE_TUNING,
        maxSpeed: 70,
        accel: 40,
        brakeDecel: 60,
        rollDecel: 14,
        grip: 0.82,
        yawStability: 0.75,
      });

      nextCars.push({
        id: i,
        vehicle: createDefaultVehicleState(startPos, yaw),
        controller,
        route,
        routeIdx: 0,
        targetSpeed: 30 + seededRng(i * 97) * 25,
        color: new THREE.Color().setHSL(seededRng(i * 53), 0.75, 0.55),
      });
    }
    this.cars = nextCars;
  }

  private reroute(car: NpcCar, seed: number) {
    const current = this.closestNodeId(car.vehicle.position.x, car.vehicle.position.z);
    const goal = this.randomNode(seed);
    car.route = aStar(this.graph, current, goal);
    car.routeIdx = 0;
    car.targetSpeed = 28 + seededRng(seed + car.id * 13) * 28;
  }

  private closestNodeId(x: number, z: number): RoadNodeId {
    // small graph → linear scan is fine
    let best: RoadNodeId = Array.from(this.graph.nodes.keys())[0] ?? "r0_s0";
    let bestD = Infinity;
    for (const [id, n] of this.graph.nodes) {
      const dx = n.x - x;
      const dz = n.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  /**
   * Fixed-step update. Does simple waypoint-following and very light separation.
   */
  step(dt: number, player: VehicleState | null) {
    const cars = this.cars;
    if (!cars.length) return;

    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];

      // Ensure route exists
      if (car.route.length < 2) {
        this.reroute(car, 4000 + car.id * 101 + Math.floor(car.vehicle.position.x));
      }

      const waypointId = car.route[Math.min(car.route.length - 1, car.routeIdx)];
      const wp = this.graph.nodes.get(waypointId);
      if (!wp) {
        this.reroute(car, 5000 + car.id * 97);
        continue;
      }

      const dx = wp.x - car.vehicle.position.x;
      const dz = wp.z - car.vehicle.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 18 && car.routeIdx < car.route.length - 1) {
        car.routeIdx++;
      } else if (dist < 22 && car.routeIdx >= car.route.length - 1) {
        this.reroute(car, 6000 + car.id * 61);
      }

      const desiredYaw = Math.atan2(-dx, -dz);
      const dYaw = angleDelta(desiredYaw, car.vehicle.yaw);
      const steer = clamp(dYaw / 0.65, -1, 1);

      const speedAbs = Math.abs(car.vehicle.speed);
      const tooFast = speedAbs > car.targetSpeed + 6;
      const tooSlow = speedAbs < car.targetSpeed - 4;

      // Basic separation: if close to another car or player, brake.
      let nearBlock = false;
      for (let j = 0; j < cars.length; j++) {
        if (j === i) continue;
        const o = cars[j].vehicle.position;
        const ddx = o.x - car.vehicle.position.x;
        const ddz = o.z - car.vehicle.position.z;
        if (ddx * ddx + ddz * ddz < 18 * 18) {
          nearBlock = true;
          break;
        }
      }
      if (!nearBlock && player) {
        const ddx = player.position.x - car.vehicle.position.x;
        const ddz = player.position.z - car.vehicle.position.z;
        if (ddx * ddx + ddz * ddz < 22 * 22) nearBlock = true;
      }

      const throttle = nearBlock ? 0 : (tooSlow ? 0.85 : 0.35);
      const brake = nearBlock ? 0.75 : (tooFast ? 0.65 : 0);

      car.controller.step(
        car.vehicle,
        { throttle, brake, steer, handbrake: false },
        dt,
      );
    }
  }
}

