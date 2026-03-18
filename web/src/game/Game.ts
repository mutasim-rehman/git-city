import * as THREE from "three";
import { InputManager } from "./input/InputManager";
import { VehicleController } from "./physics/VehicleController";
import type { GameState, VehicleTuning } from "./state";
import { createDefaultVehicleState, DEFAULT_VEHICLE_TUNING } from "./state";

export type GameConfig = {
  initialPosition: THREE.Vector3;
  initialYaw: number;
  vehicleTuning?: Partial<VehicleTuning>;
};

export class Game {
  readonly input: InputManager;
  readonly vehicle: VehicleController;
  readonly state: GameState;

  private accumulator = 0;
  private readonly fixedDt = 1 / 60;

  constructor(cfg: GameConfig) {
    this.input = new InputManager();
    this.vehicle = new VehicleController({ ...DEFAULT_VEHICLE_TUNING, ...(cfg.vehicleTuning ?? {}) });
    this.state = {
      player: {
        vehicle: createDefaultVehicleState(cfg.initialPosition, cfg.initialYaw),
      },
    };
  }

  setVehicleTuning(partial: Partial<VehicleTuning>) {
    Object.assign(this.vehicle.tuning, partial);
  }

  /**
   * Advance the simulation using a fixed time step for stability.
   * Call this from render-loop with the variable `delta` provided by R3F.
   */
  update(deltaSeconds: number, onFixedStep?: (fixedDt: number) => void) {
    const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
    this.accumulator += dt;

    // Cap to avoid spiral-of-death after tab becomes inactive
    const maxSteps = 8;
    let steps = 0;

    const snapshot = this.input.consumeSnapshot();
    const control = {
      throttle: snapshot.throttle,
      brake: snapshot.brake,
      steer: snapshot.steer,
      handbrake: snapshot.handbrake,
    };

    while (this.accumulator >= this.fixedDt && steps < maxSteps) {
      this.vehicle.step(this.state.player.vehicle, control, this.fixedDt);
      onFixedStep?.(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }

    return snapshot;
  }
}

