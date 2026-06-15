import { useEnvironment } from "@react-three/drei";
import {
  CAR_CONFIGS,
  CAR_VARIANTS,
  DEFAULT_CAR_VARIANT,
  GARAGE_MODEL_PATH,
} from "@/game/content/cars";
import { preloadGltf } from "@/lib/gltf";

export type LoadProgress = {
  phase: "city" | "models";
  progress: number; // 0..100
  message: string;
};

const SHOWROOM_ENV_PRESET = "night" as const;

function showroomPaths(): string[] {
  return [CAR_CONFIGS[DEFAULT_CAR_VARIANT].modelPath, GARAGE_MODEL_PATH];
}

function remainingCarPaths(): string[] {
  return CAR_VARIANTS.filter((v) => v !== DEFAULT_CAR_VARIANT).map((v) => CAR_CONFIGS[v].modelPath);
}

async function preloadPaths(
  paths: string[],
  onProgress?: (p: LoadProgress) => void,
): Promise<void> {
  if (paths.length === 0) {
    onProgress?.({ phase: "models", progress: 100, message: "All assets loaded" });
    return;
  }

  let completed = 0;

  const report = () => {
    const progress = Math.round((completed / paths.length) * 100);
    onProgress?.({
      phase: "models",
      progress: Math.min(99, progress),
      message: `Loading assets… ${completed}/${paths.length}`,
    });
  };

  await Promise.all(
    paths.map(async (path) => {
      try {
        await preloadGltf(path);
      } catch (err) {
        console.warn("Failed to preload:", path, err);
        throw err;
      } finally {
        completed++;
        report();
      }
    }),
  );

  onProgress?.({ phase: "models", progress: 100, message: "All assets loaded" });
}

/** Preload default car + garage + showroom HDRI — gate before entering car select. */
export async function loadShowroomAssets(onProgress?: (p: LoadProgress) => void): Promise<void> {
  onProgress?.({ phase: "models", progress: 0, message: "Loading showroom…" });

  useEnvironment.preload({ preset: SHOWROOM_ENV_PRESET });
  await preloadPaths(showroomPaths(), onProgress);
}

let remainingCarsStarted = false;

/** Fire-and-forget preload of non-default cars while user browses showroom. */
export function preloadRemainingCars(): void {
  if (remainingCarsStarted) return;
  remainingCarsStarted = true;

  const paths = remainingCarPaths();
  void Promise.all(paths.map((path) => preloadGltf(path).catch((err) => {
    console.warn("Background preload failed:", path, err);
  })));
}

/** @deprecated Use loadShowroomAssets + preloadRemainingCars */
export async function loadAllAssets(onProgress?: (p: LoadProgress) => void): Promise<void> {
  await loadShowroomAssets(onProgress);
  preloadRemainingCars();
  await Promise.all(remainingCarPaths().map((path) => preloadGltf(path)));
}

export { GARAGE_MODEL_PATH, SHOWROOM_ENV_PRESET };
