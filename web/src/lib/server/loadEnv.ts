import fs from "fs";
import path from "path";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

let loaded = false;

/** Load web/.env.local, web/.env, then repo-root .env (first wins). */
export function ensureEnvLoaded() {
  if (loaded) return;
  const webRoot = path.join(process.cwd());
  const repoRoot = path.resolve(webRoot, "..");
  loadEnvFile(path.join(webRoot, ".env.local"));
  loadEnvFile(path.join(webRoot, ".env"));
  loadEnvFile(path.join(repoRoot, ".env"));
  loaded = true;
}
