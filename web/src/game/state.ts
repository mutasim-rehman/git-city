import * as THREE from "three";

export type VehicleControlState = {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1 (left..right)
  handbrake: boolean;
};

export type VehicleTuning = {
  maxSpeed: number; // units/s
  accel: number; // units/s^2
  brakeDecel: number; // units/s^2
  rollDecel: number; // units/s^2 (coast)
  maxSteerAngle: number; // radians
  steerResponsiveness: number; // 0..1 per tick (higher snaps faster)
  grip: number; // 0..1 (higher resists lateral slip)
  yawStability: number; // 0..1 (higher dampens yaw drift)
};

export type VehicleState = {
  position: THREE.Vector3;
  yaw: number; // radians, heading around Y
  velocity: THREE.Vector3; // world space, y ignored
  speed: number; // signed forward speed (units/s)
  steerAngle: number; // current steer angle (radians)
};

export type PlayerState = {
  vehicle: VehicleState;
};

export type GameState = {
  player: PlayerState;
};

export function createDefaultVehicleState(pos: THREE.Vector3, yaw: number): VehicleState {
  return {
    position: pos.clone(),
    yaw,
    velocity: new THREE.Vector3(0, 0, 0),
    speed: 0,
    steerAngle: 0,
  };
}

export const DEFAULT_VEHICLE_TUNING: VehicleTuning = {
  maxSpeed: 140,
  accel: 65,
  brakeDecel: 95,
  rollDecel: 18,
  maxSteerAngle: 0.55,
  steerResponsiveness: 0.2,
  grip: 0.78,
  yawStability: 0.65,
};

