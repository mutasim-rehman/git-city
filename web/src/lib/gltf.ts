import { peek } from "suspend-react";
import { GLTFLoader } from "three-stdlib";
import { useGLTF } from "@react-three/drei";

useGLTF.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");

const PRELOAD_TIMEOUT_MS = 120_000;

/** Preload a GLB into drei's global cache and wait until parsed. */
export async function preloadGltf(path: string): Promise<void> {
  useGLTF.preload(path);
  const keys = [GLTFLoader, path];

  if (peek(keys)) return;

  const deadline = Date.now() + PRELOAD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (peek(keys)) return;
    await new Promise((resolve) => setTimeout(resolve, 16));
  }

  throw new Error(`Timed out preloading ${path}`);
}
