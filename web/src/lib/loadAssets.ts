import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CAR_CONFIGS, CAR_VARIANTS } from "@/game/content/cars";

const MONUMENT_PATH = "/models/v-cruiser.glb";

export type LoadProgress = {
  phase: "city" | "models";
  progress: number; // 0..100
  message: string;
};

/**
 * Load all required 3D assets (car GLBs + monument) and report progress.
 * Resolves when every model is loaded. Use this before transitioning off the loading screen.
 */
export async function loadAllAssets(
  onProgress?: (p: LoadProgress) => void
): Promise<void> {
  const loader = new GLTFLoader();
  const carPaths = CAR_VARIANTS.map((v) => CAR_CONFIGS[v].modelPath);
  const allPaths = [...carPaths, MONUMENT_PATH];
  const total = allPaths.length;
  let loaded = 0;

  const loadOne = (url: string) =>
    loader.loadAsync(url, (e) => {
      if (e.lengthComputable) {
        const pct = ((loaded + e.loaded / e.total) / total) * 100;
        onProgress?.({
          phase: "models",
          progress: Math.min(99, pct),
          message: `Loading assets… ${loaded + 1}/${total}`,
        });
      }
    });

  for (let i = 0; i < allPaths.length; i++) {
    onProgress?.({
      phase: "models",
      progress: (i / total) * 100,
      message: `Loading assets… ${i + 1}/${total}`,
    });
    await loadOne(allPaths[i]);
    loaded++;
  }

  onProgress?.({
    phase: "models",
    progress: 100,
    message: "All assets loaded",
  });
}
