/**
 * Backfill sector_id / sector_label in Supabase from repo_metadata already stored in github_users.
 * Faster than a full CSV re-import when only sectors are missing.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { assignSectorFromRepoMetadata } from "./lib/assign-sectors.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..");

function loadEnvFile(filePath) {
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

loadEnvFile(path.join(WEB_ROOT, ".env.local"));
loadEnvFile(path.join(WEB_ROOT, ".env"));
loadEnvFile(path.join(REPO_ROOT, ".env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const CITIES = ["islamabad", "karachi", "lahore"];
const PAGE_SIZE = 1000;

async function backfillCity(cityId) {
  let from = 0;
  let updated = 0;

  while (true) {
    const { data, error } = await supabase
      .from("github_users")
      .select("username, repo_metadata, sector_id, sector_label")
      .eq("city_id", cityId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    /** @type {Map<string, string[]>} */
    const bySector = new Map();
    for (const row of data) {
      const sector = assignSectorFromRepoMetadata(row.repo_metadata);
      const key = `${sector.sector_id}\t${sector.sector_label}`;
      const list = bySector.get(key) ?? [];
      list.push(row.username);
      bySector.set(key, list);
    }

    for (const [key, usernames] of bySector) {
      const [sector_id, sector_label] = key.split("\t");
      const { error: updateError } = await supabase
        .from("github_users")
        .update({ sector_id, sector_label })
        .eq("city_id", cityId)
        .in("username", usernames);

      if (updateError) throw updateError;
    }

    updated += data.length;
    console.log(`  ${cityId}: updated ${updated} rows...`);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return updated;
}

async function main() {
  console.log("Backfilling sector_id / sector_label from repo_metadata...");
  let total = 0;
  for (const city of CITIES) {
    total += await backfillCity(city);
  }
  console.log(`Done. Updated ${total} rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
