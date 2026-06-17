import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

function loadParentEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
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

loadParentEnv();

const IMMUTABLE = "public, max-age=31536000, immutable";
const AUDIO_CACHE = "public, max-age=86400, stale-while-revalidate=604800";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      // CSV city data – content-addressed by city name; safe to cache for a week
      {
        source: "/data/:file*.csv",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      // 3-D models & Draco decoder – versioned by filename; immutable
      {
        source: "/models/:file*",
        headers: [{ key: "Cache-Control", value: IMMUTABLE }],
      },
      {
        source: "/draco/:file*",
        headers: [{ key: "Cache-Control", value: IMMUTABLE }],
      },
      // Audio – large files; 1-day fresh, 1-week stale-while-revalidate
      {
        source: "/audios/:file*",
        headers: [{ key: "Cache-Control", value: AUDIO_CACHE }],
      },
    ];
  },
};

export default nextConfig;
