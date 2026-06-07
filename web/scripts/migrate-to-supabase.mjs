import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { csvParse } from "d3-dsv";
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

// Load env from web/.env.local, web/.env, then repo-root .env
loadEnvFile(path.join(WEB_ROOT, ".env.local"));
loadEnvFile(path.join(WEB_ROOT, ".env"));
loadEnvFile(path.join(REPO_ROOT, ".env"));

// Retrieve Supabase credentials from the environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  console.error("Get the service_role key from Supabase → Project Settings → API.");
  console.error("Use SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix) — it must stay server-side only.");
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[WARN] Using NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY. Rename it to SUPABASE_SERVICE_ROLE_KEY so Next.js does not expose it in the browser."
  );
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("Error: SUPABASE_SERVICE_ROLE_KEY must be the service_role key, not the anon key.");
  process.exit(1);
}

// Create Supabase client (service role key is preferred for bulk migrations to bypass RLS policies)
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const CITIES = ["islamabad", "karachi", "lahore"];

function parseIntField(value, fallback = 0) {
  const n = parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseRepoMetadata(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resolveCsvPath(city) {
  const candidates = [
    path.join(REPO_ROOT, "docs", `github_users_${city}_full.csv`),
    path.join(WEB_ROOT, "public", "data", `${city}.csv`),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

async function runMigration() {
  console.log("----------------------------------------------------------------");
  console.log("Starting Git City CSV to Supabase Migration...");
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log("Auth: service_role (RLS bypass for bulk upsert)");
  console.log("----------------------------------------------------------------");

  for (const city of CITIES) {
    const csvPath = resolveCsvPath(city);
    if (!fs.existsSync(csvPath)) {
      console.warn(`[SKIP] CSV file for '${city}' not found at: ${csvPath}`);
      continue;
    }

    console.log(`[READ] Reading ${csvPath}...`);
    const csvContent = fs.readFileSync(csvPath, "utf8");
    const parsed = csvParse(csvContent);

    console.log(`[PARSE] Found ${parsed.length} rows. Mapping and cleaning data...`);

    const records = parsed.map((row) => {
      const repo_metadata = parseRepoMetadata(row.Repo_Metadata);
      const sector = assignSectorFromRepoMetadata(repo_metadata);

      return {
        username: row.Username,
        profile_url: row["Profile URL"] || "",
        github_id: parseIntField(row["GitHub ID"], 0),
        year_group: row.Year_Group || null,
        public_repositories: parseIntField(row.Public_Repositories, 0),
        lifetime_commits: parseIntField(row.Lifetime_Commits, 0),
        followers: parseIntField(row.Followers, 0),
        total_stars: parseIntField(row.Total_Stars, 0),
        repo_names: row.Repo_Names || "",
        repo_metadata,
        sector_id: row.sector_id?.trim() || sector.sector_id,
        sector_label: row.sector_label?.trim() || sector.sector_label,
        city_id: city,
      };
    });

    // Chunk records to avoid HTTP payload limits (batches of 1000 are efficient)
    const BATCH_SIZE = 1000;
    console.log(`[UPLOAD] Upserting ${records.length} records for ${city} (Batch size: ${BATCH_SIZE})...`);

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(records.length / BATCH_SIZE);

      console.log(` -> Uploading batch ${batchNum}/${totalBatches}...`);

      const { error } = await supabase
        .from("github_users")
        .upsert(batch, { onConflict: "city_id,username" });

      if (error) {
        console.error(`[ERROR] Batch ${batchNum} failed for ${city}:`, error.message);
      } else {
        console.log(` -> Batch ${batchNum}/${totalBatches} completed successfully.`);
      }
    }
    console.log(`[DONE] Finished migration for city: ${city}.\n`);
  }

  console.log("----------------------------------------------------------------");
  console.log("Git City CSV to Supabase Migration Complete!");
  console.log("----------------------------------------------------------------");
}

runMigration().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
