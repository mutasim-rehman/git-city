export type CarVariant = "cm1" | "cm2" | "cm3" | "cm4" | "cm5" | "cm6" | "cm7";

export const DEFAULT_CAR_VARIANT: CarVariant = "cm1";

export type CarConfig = {
  label: string;
  modelPath: string;
  audioPath: string;
  scale: number;
  modelYaw: number;
  modelTilt: number;
  forwardOffset: number;
  downOffset: number;
  sideOffset: number;
  /** Max forward speed (units/s). */
  speed: number;
  accel: number;
  /** Minimum turning circle radius in world units (lower = sharper turns). */
  turnRadius: number;
  eyeOffset: number;
};

/** Fields you can live-tune in the showroom model tuner. */
export type CarModelTuning = Pick<
  CarConfig,
  | "scale"
  | "modelYaw"
  | "modelTilt"
  | "forwardOffset"
  | "downOffset"
  | "sideOffset"
  | "speed"
  | "accel"
  | "turnRadius"
  | "eyeOffset"
>;

const DEFAULT_TUNING: CarModelTuning = {
  scale: 1.5,
  modelYaw: Math.PI / 2,
  modelTilt: 0,
  forwardOffset: 10,
  downOffset: 1.5,
  sideOffset: 0,
  speed: 60,
  accel: 65,
  turnRadius: 30,
  eyeOffset: 2,
};

function carEntry(id: CarVariant, label: string, tuning: Partial<CarModelTuning> = {}): CarConfig {
  const t = { ...DEFAULT_TUNING, ...tuning };
  return {
    label,
    modelPath: `/models/${id}.glb`,
    audioPath: "/audios/city_music.mp3",
    ...t,
  };
}

/** Showroom display / garage preview tuning. */
export const CAR_SHOWROOM_CONFIGS: Record<CarVariant, CarConfig> = {
  cm1: carEntry("cm1", "Car 1", { scale: 145, speed: 72, accel: 58, turnRadius: 38 }),
  cm2: carEntry("cm2", "Car 2", { scale: 1.7, speed: 68, accel: 62, turnRadius: 30 }),
  cm3: carEntry("cm3", "Car 3", { scale: 0.09, speed: 118, accel: 98, turnRadius: 11 }),
  cm4: carEntry("cm4", "Car 4", { scale: 2.05, speed: 92, accel: 80, turnRadius: 16 }),
  cm5: carEntry("cm5", "Car 5", { scale: 0.012, speed: 105, accel: 88, turnRadius: 13 }),
  cm6: carEntry("cm6", "Car 6", { scale: 0.9, speed: 58, accel: 52, turnRadius: 42 }),
  cm7: carEntry("cm7", "Car 7", { scale: 0.6, speed: 78, accel: 70, turnRadius: 24 }),
};

/** In-game driving / street view tuning. */
export const CAR_GAME_CONFIGS: Record<CarVariant, CarConfig> = {
  cm1: {
    label: "Car 1",
    modelPath: "/models/cm1.glb",
    audioPath: "/audios/city_music.mp3",
    scale: 249.95,
    modelYaw: 3.12,
    modelTilt: 0,
    forwardOffset: 10,
    downOffset: 1.5,
    sideOffset: 0,
    speed: 43,
    accel: 26,
    turnRadius: 17,
    eyeOffset: 0.8,
  },
  cm2: {
    label: "Car 2",
    modelPath: "/models/cm2.glb",
    audioPath: "/audios/city_music.mp3",
    scale: 3,
    modelYaw: Math.PI / 2,
    modelTilt: 0,
    forwardOffset: 10,
    downOffset: 1.5,
    sideOffset: 0,
    speed: 67,
    accel: 68,
    turnRadius: 22,
    eyeOffset: 2,
  },
  cm3: {
    label: "Car 3",
    modelPath: "/models/cm3.glb",
    audioPath: "/audios/city_music.mp3",
    scale: 0.17,
    modelYaw: 6.28,
    modelTilt: 0,
    forwardOffset: 10,
    downOffset: 1.5,
    sideOffset: 0,
    speed: 66,
    accel: 66,
    turnRadius: 25.5,
    eyeOffset: 2,
  },
  cm4: {
    label: "Car 4",
    modelPath: "/models/cm4.glb",
    audioPath: "/audios/city_music.mp3",
    scale: 4.7,
    modelYaw: 0.0468,
    modelTilt: 0,
    forwardOffset: 10,
    downOffset: 1.5,
    sideOffset: 0,
    speed: 60,
    accel: 65,
    turnRadius: 24,
    eyeOffset: 2,
  },
  cm5: {
    label: "Car 5",
    modelPath: "/models/cm5.glb",
    audioPath: "/audios/city_music.mp3",
    scale: 0.02,
    modelYaw: 3.1168,
    modelTilt: 0,
    forwardOffset: 10,
    downOffset: 1.6,
    sideOffset: 0,
    speed: 60,
    accel: 65,
    turnRadius: 20,
    eyeOffset: 2,
  },
  cm6: {
    label: "Car 6",
    modelPath: "/models/cm6.glb",
    audioPath: "/audios/city_music.mp3",
    scale: 1.7,
    modelYaw: 6.28,
    modelTilt: 0,
    forwardOffset: 10,
    downOffset: 1.5,
    sideOffset: 0,
    speed: 60,
    accel: 65,
    turnRadius: 19.5,
    eyeOffset: 2,
  },
  cm7: {
    label: "Car 7",
    modelPath: "/models/cm7.glb",
    audioPath: "/audios/city_music.mp3",
    scale: 0.95,
    modelYaw: Math.PI / 2,
    modelTilt: 0,
    forwardOffset: 10,
    downOffset: 1.5,
    sideOffset: 0,
    speed: 60,
    accel: 65,
    turnRadius: 19,
    eyeOffset: 2,
  },
};

/** @deprecated alias — showroom code should use CAR_SHOWROOM_CONFIGS */
export const CAR_CONFIGS = CAR_SHOWROOM_CONFIGS;

export const CAR_VARIANTS: CarVariant[] = Object.keys(CAR_SHOWROOM_CONFIGS) as CarVariant[];

export function getGameCarConfig(variant: CarVariant): CarConfig {
  return CAR_GAME_CONFIGS[variant] ?? CAR_GAME_CONFIGS[DEFAULT_CAR_VARIANT];
}

export function getCarConfig(variant: CarVariant, override?: Partial<CarModelTuning>): CarConfig {
  const base = CAR_SHOWROOM_CONFIGS[variant] ?? CAR_SHOWROOM_CONFIGS[DEFAULT_CAR_VARIANT];
  if (!override) return base;
  return { ...base, ...override };
}

export function getCarModelTuning(variant: CarVariant, override?: Partial<CarModelTuning>): CarModelTuning {
  const cfg = getCarConfig(variant, override);
  return {
    scale: cfg.scale,
    modelYaw: cfg.modelYaw,
    modelTilt: cfg.modelTilt,
    forwardOffset: cfg.forwardOffset,
    downOffset: cfg.downOffset,
    sideOffset: cfg.sideOffset,
    speed: cfg.speed,
    accel: cfg.accel,
    turnRadius: cfg.turnRadius,
    eyeOffset: cfg.eyeOffset,
  };
}

/** Map car config into arcade vehicle physics knobs. */
export function vehicleTuningFromModel(tuning: CarModelTuning): {
  maxSpeed: number;
  accel: number;
  maxSteerAngle: number;
} {
  const turnRadius = Math.max(5, tuning.turnRadius);
  return {
    maxSpeed: Math.max(40, tuning.speed),
    accel: tuning.accel,
    maxSteerAngle: Math.min(1.2, Math.max(0.15, 16.5 / turnRadius)),
  };
}

/** Format a numeric radian value as a readable TS expression when possible. */
function formatRadians(rad: number): string {
  const tau = Math.PI * 2;
  const normalized = ((rad % tau) + tau) % tau;
  const candidates: [number, string][] = [
    [0, "0"],
    [Math.PI / 2, "Math.PI / 2"],
    [Math.PI, "Math.PI"],
    [(3 * Math.PI) / 2, "(3 * Math.PI) / 2"],
    [Math.PI * 2, "Math.PI * 2"],
  ];
  for (const [value, expr] of candidates) {
    if (Math.abs(normalized - value) < 0.0001) return expr;
  }
  return normalized.toFixed(4);
}

/** Copy-paste snippet for updating CAR_GAME_CONFIGS in cars.ts. */
export function formatCarConfigSnippet(variant: CarVariant, tuning: CarModelTuning): string {
  const cfg = CAR_GAME_CONFIGS[variant];
  return [
    `  ${variant}: {`,
    `    label: "${cfg.label}",`,
    `    modelPath: "${cfg.modelPath}",`,
    `    audioPath: "${cfg.audioPath}",`,
    `    scale: ${tuning.scale.toFixed(2)},`,
    `    modelYaw: ${formatRadians(tuning.modelYaw)},`,
    `    modelTilt: ${formatRadians(tuning.modelTilt)},`,
    `    forwardOffset: ${tuning.forwardOffset.toFixed(1)},`,
    `    downOffset: ${tuning.downOffset.toFixed(1)},`,
    `    sideOffset: ${tuning.sideOffset.toFixed(1)},`,
    `    speed: ${Math.round(tuning.speed)},`,
    `    accel: ${Math.round(tuning.accel)},`,
    `    turnRadius: ${tuning.turnRadius.toFixed(1)},`,
    `    eyeOffset: ${tuning.eyeOffset.toFixed(1)},`,
    `  },`,
  ].join("\n");
}

export type CarStats = {
  speed: number; // 0..100
  handling: number; // 0..100
  accel: number; // 0..100
};

/** Map a raw value into a 10..100 display stat relative to the roster range. */
function statFromRange(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  const t = (value - min) / (max - min);
  return Math.max(10, Math.min(100, Math.round(t * 90 + 10)));
}

export function getCarStats(v: CarVariant): CarStats {
  const configs = CAR_VARIANTS.map((id) => CAR_GAME_CONFIGS[id]);
  const speeds = configs.map((c) => c.speed);
  const accels = configs.map((c) => c.accel);
  const turns = configs.map((c) => c.turnRadius);

  const speedMin = Math.min(...speeds);
  const speedMax = Math.max(...speeds);
  const accelMin = Math.min(...accels);
  const accelMax = Math.max(...accels);
  const turnMin = Math.min(...turns);
  const turnMax = Math.max(...turns);

  const cfg = CAR_GAME_CONFIGS[v];
  return {
    speed: statFromRange(cfg.speed, speedMin, speedMax),
    accel: statFromRange(cfg.accel, accelMin, accelMax),
    handling: statFromRange(turnMax - cfg.turnRadius + turnMin, turnMin, turnMax),
  };
}
