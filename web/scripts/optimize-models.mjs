#!/usr/bin/env node
/**
 * Optimize GLB models for web delivery (meshopt + webp textures).
 * Writes to public/models/optimized/ then replaces originals on success.
 *
 * Usage: node scripts/optimize-models.mjs
 */
import { spawn } from "node:child_process";
import { cp, mkdir, readdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.join(__dirname, "../public/models");
const STAGING_DIR = path.join(MODELS_DIR, ".optimize-staging");

const MODELS = ["cm1.glb", "cm3.glb", "cm4.glb", "cm5.glb", "cm6.glb", "cm7.glb", "garage.glb"];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: true });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function optimizeOne(filename) {
  const input = path.join(MODELS_DIR, filename);
  const output = path.join(STAGING_DIR, filename);
  await run("npx", [
    "@gltf-transform/cli@4",
    "optimize",
    input,
    output,
    "--compress",
    "meshopt",
    "--texture-compress",
    "webp",
  ]);
}

async function main() {
  await mkdir(STAGING_DIR, { recursive: true });

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of MODELS) {
    const inputPath = path.join(MODELS_DIR, file);
    try {
      await stat(inputPath);
    } catch {
      console.warn(`Skipping missing file: ${file}`);
      continue;
    }

    const before = (await stat(inputPath)).size;
    console.log(`\nOptimizing ${file} (${formatBytes(before)})…`);
    await optimizeOne(file);
    const after = (await stat(path.join(STAGING_DIR, file))).size;
    totalBefore += before;
    totalAfter += after;
    console.log(`  ${formatBytes(before)} → ${formatBytes(after)} (${Math.round((1 - after / before) * 100)}% smaller)`);
  }

  for (const file of MODELS) {
    const staged = path.join(STAGING_DIR, file);
    try {
      await stat(staged);
    } catch {
      continue;
    }
    const dest = path.join(MODELS_DIR, file);
    const backup = path.join(STAGING_DIR, `${file}.orig`);
    await rename(dest, backup);
    await cp(staged, dest);
  }

  const remaining = await readdir(STAGING_DIR);
  console.log(`\nDone. Total: ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)}`);
  console.log(`Backups in ${STAGING_DIR}: ${remaining.filter((f) => f.endsWith(".orig")).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
