import * as THREE from "three";
import type { VehicleControlState, VehicleState, VehicleTuning } from "../state";

const TMP_FORWARD = new THREE.Vector3();
const TMP_RIGHT = new THREE.Vector3();
const TMP_V = new THREE.Vector3();
const TMP_STABLE = new THREE.Vector3();

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

function approach(current: number, target: number, rate01: number) {
  const t = clamp(rate01, 0, 1);
  return current + (target - current) * t;
}

function wrapAngleRadians(a: number) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

/**
 * Lightweight “driving feel” controller:
 * - forward speed integrates from throttle/brake
 * - heading changes via steer angle scaled by speed (bicycle-ish)
 * - lateral slip is damped via grip, and yaw is stabilized
 *
 * This is not a rigid-body solver; it's tuned for stable arcade-sim feel in a city.
 */
export class VehicleController {
  readonly tuning: VehicleTuning;

  constructor(tuning: VehicleTuning) {
    this.tuning = tuning;
  }

  step(state: VehicleState, input: VehicleControlState, dt: number) {
    const t = this.tuning;
    const safeDt = Math.max(0, Math.min(dt, 1 / 20));

    // --- Steering (smooth) ---
    const targetSteer = clamp(input.steer, -1, 1) * t.maxSteerAngle;
    state.steerAngle = approach(state.steerAngle, targetSteer, 1 - Math.pow(1 - t.steerResponsiveness, safeDt * 60));

    // --- Longitudinal acceleration ---
    const throttle = clamp(input.throttle, 0, 1);
    const brake = clamp(input.brake, 0, 1);

    const accel = throttle * t.accel;
    let decel = brake * t.brakeDecel;
    if (input.handbrake) decel = Math.max(decel, t.brakeDecel * 0.85);

    // Coast deceleration when no inputs
    const coasting = throttle === 0 && brake === 0;
    if (coasting) decel = Math.max(decel, t.rollDecel);

    // Apply acceleration opposite direction if braking while moving
    const speedAbs = Math.abs(state.speed);

    const speedAfter = clamp(
      speedAbs + accel * safeDt - decel * safeDt,
      0,
      t.maxSpeed,
    );

    // Allow reversing gently if braking while stopped and no throttle
    const reverseIntent = throttle === 0 && brake > 0.2 && speedAbs < 0.5;
    const desiredSign = reverseIntent ? -1 : 1;
    state.speed = speedAfter * desiredSign;

    // --- Heading update (speed-scaled yaw rate) ---
    // Reduce steer at low speed to avoid twitch, and at high speed to avoid instant spins
    const speed01 = clamp(speedAbs / Math.max(1, t.maxSpeed), 0, 1);
    const steerEffect = (0.25 + 0.75 * (1 - speed01 * 0.45)) * (0.35 + 0.65 * clamp(speedAbs / 25, 0, 1));
    const yawRate = state.steerAngle * (state.speed / 18) * steerEffect;
    state.yaw = wrapAngleRadians(state.yaw + yawRate * safeDt);

    // --- Velocity composition (forward + damped lateral slip) ---
    TMP_FORWARD.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw)).normalize();
    TMP_RIGHT.set(TMP_FORWARD.z, 0, -TMP_FORWARD.x).normalize();

    // Project current velocity into local frame
    const vF = state.velocity.dot(TMP_FORWARD);
    const vR = state.velocity.dot(TMP_RIGHT);

    // Target forward velocity tries to match signed speed
    const targetVF = state.speed;

    // Lateral slip decays with grip; more slip on handbrake
    const grip = clamp(t.grip * (input.handbrake ? 0.55 : 1), 0.05, 0.98);
    const targetVR = vR * (1 - grip);

    const newVF = approach(vF, targetVF, clamp(safeDt * 8, 0, 1));
    const newVR = approach(vR, targetVR, clamp(safeDt * 10, 0, 1));

    // Recompose world velocity
    TMP_V.copy(TMP_FORWARD).multiplyScalar(newVF).addScaledVector(TMP_RIGHT, newVR);

    // Yaw stability dampens any residual sideways drift when not steering hard
    const stability = clamp(t.yawStability * (1 - Math.abs(input.steer) * 0.35), 0, 1);
    TMP_STABLE.copy(TMP_FORWARD).multiplyScalar(newVF);
    TMP_V.lerp(TMP_STABLE, clamp(stability * safeDt * 4, 0, 1));

    state.velocity.copy(TMP_V);

    // --- Integrate position ---
    state.position.addScaledVector(state.velocity, safeDt);
    state.position.y = 1.5; // clamp to ground plane for now
  }
}

