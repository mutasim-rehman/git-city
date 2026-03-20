export type CarVariant =
  | "mr-bean"
  | "batmobile"
  | "harry-potter"
  | "mc-queen"
  | "Stradale 67"
  | "ZIS 101A"
  | "Beetle"
  | "Ferrai SF23"
  | "Wagon";

export const DEFAULT_CAR_VARIANT: CarVariant = "mr-bean";

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
  speed: number;
  eyeOffset: number;
};

export const CAR_CONFIGS: Record<CarVariant, CarConfig> = {
  "mr-bean": {
    label: "Mr Bean",
    modelPath: "/models/car1.glb",
    audioPath: "/audios/mr_bean.mp3",
    scale: 1.8,
    modelYaw: Math.PI / 2,
    modelTilt: 0,
    forwardOffset: 15,
    downOffset: 0.5,
    sideOffset: 0,
    speed: 60,
    eyeOffset: 4,
  },
  batmobile: {
    label: "Batmobile",
    modelPath: "/models/car2.glb",
    audioPath: "/audios/batmobile.mp3",
    scale: 1.2,
    modelYaw: Math.PI / 2,
    modelTilt: 0,
    forwardOffset: 50,
    downOffset: 0.8,
    sideOffset: 0,
    speed: 110,
    eyeOffset: 15.5,
  },
  "harry-potter": {
    label: "Harry Potter",
    modelPath: "/models/car4.glb",
    audioPath: "/audios/harry_potter.mp3",
    scale: 1.0,
    modelYaw: 3.5 * Math.PI,
    modelTilt: 0,
    forwardOffset: 8,
    downOffset: 0.6,
    sideOffset: 0,
    speed: 70,
    eyeOffset: 2.2,
  },
  "mc-queen": {
    label: "Mc Queen",
    modelPath: "/models/car3.glb",
    audioPath: "/audios/mcqueen.mp3",
    scale: 1.5,
    modelYaw: Math.PI / 1,
    modelTilt: 0,
    forwardOffset: 10,
    downOffset: 1.5,
    sideOffset: 0,
    speed: 50,
    eyeOffset: 1.8,
  },
  "Stradale 67": {
    label: "Stradale 67",
    modelPath: "/models/car_stradale.glb",
    audioPath: "/audios/stradale67.mp3",
    scale: 200.0,
    modelYaw: Math.PI,
    modelTilt: 0,
    forwardOffset: 10,
    downOffset: 1.5,
    sideOffset: 0,
    speed: 50,
    eyeOffset: 1.8,
  },
  "ZIS 101A": {
    label: "ZIS 101A",
    modelPath: "/models/car_zis101.glb",
    audioPath: "/audios/zis101a.mp3",
    scale: 2.0,
    modelYaw: Math.PI / 1,
    modelTilt: 0,
    forwardOffset: 13,
    downOffset: 1.5,
    sideOffset: 0,
    speed: 50,
    eyeOffset: 1.8,
  },
  Beetle: {
    label: "Beetle",
    modelPath: "/models/car_beetle.glb",
    audioPath: "/audios/beetle.mp3",
    scale: 150.0,
    modelYaw: Math.PI / 1,
    modelTilt: 0,
    forwardOffset: 10,
    downOffset: 1.5,
    sideOffset: 0,
    speed: 50,
    eyeOffset: 1.8,
  },
  "Ferrai SF23": {
    label: "Ferrari SF23",
    modelPath: "/models/car_f1f.glb",
    audioPath: "/audios/ferrari_f123.mp3",
    scale: 2.0,
    modelYaw: Math.PI / 1,
    modelTilt: 0,
    forwardOffset: 10,
    downOffset: 1.5,
    sideOffset: 0,
    speed: 50,
    eyeOffset: 1.8,
  },
  Wagon: {
    label: "Wagon",
    modelPath: "/models/car_wagon.glb",
    audioPath: "/audios/wagon.mp3",
    scale: 1.0,
    modelYaw: (3 * Math.PI) / 2,
    modelTilt: 0,
    forwardOffset: 10,
    downOffset: 1.5,
    sideOffset: 2,
    speed: 50,
    eyeOffset: 1.8,
  },
};

export const CAR_VARIANTS: CarVariant[] = Object.keys(CAR_CONFIGS) as CarVariant[];

export type CarStats = {
  speed: number; // 0..100
  handling: number; // 0..100
  accel: number; // 0..100
};

export function getCarStats(v: CarVariant): CarStats {
  const cfg = CAR_CONFIGS[v];
  const speed = Math.max(10, Math.min(100, Math.round((cfg.speed / 140) * 100)));
  // Approximate from camera offset / size differences; tuned for “gamey” display
  const handling = Math.max(10, Math.min(100, Math.round(82 - (cfg.speed / 140) * 30)));
  const accel = Math.max(10, Math.min(100, Math.round(60 + (cfg.speed / 140) * 25)));
  return { speed, handling, accel };
}

