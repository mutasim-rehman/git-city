import { peek } from "suspend-react";
import { GLTFLoader } from "three-stdlib";
import { useGLTF } from "@react-three/drei";

// Self-hosted Draco decoder (copied from three/examples/jsm/libs/draco/gltf at build time).
// Avoids cold cross-origin DNS+TLS round-trip to gstatic.com on first load.
useGLTF.setDecoderPath("/draco/");

const PRELOAD_TIMEOUT_MS = 120_000;

/** Preload a GLB into drei's global cache and wait until parsed. */
export async function preloadGltf(path: string): Promise<void> {
  useGLTF.preload(path);
  const keys = [GLTFLoader, path];

  if (peek(keys)) return;

  // Exponential backoff — avoids hammering the main thread with tight polling
  // while still detecting fast parses quickly.
  const deadline = Date.now() + PRELOAD_TIMEOUT_MS;
  let delay = 16;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (peek(keys)) return;
    delay = Math.min(delay * 2, 500);
  }

  throw new Error(`Timed out preloading ${path}`);
}
