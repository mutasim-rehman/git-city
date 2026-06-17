import { csvParse } from "d3-dsv";
import type { CityId, CsvUser } from "../types";
import { supabase } from "../supabaseClient";

const CITY_FILE: Record<CityId, string> = {
  lahore: "/data/lahore.csv",
  karachi: "/data/karachi.csv",
  islamabad: "/data/islamabad.csv",
};

const SUPABASE_PAGE_SIZE = 1000;

const GITHUB_USER_COLUMNS =
  "username, profile_url, github_id, year_group, public_repositories, lifetime_commits";

type GithubUserRow = {
  username: string;
  profile_url: string;
  github_id: number;
  year_group: string | null;
  public_repositories: number;
  lifetime_commits: number;
};

function mapGithubUserRow(item: GithubUserRow): CsvUser {
  return {
    Username: item.username,
    "Profile URL": item.profile_url,
    "GitHub ID": String(item.github_id),
    Year_Group: item.year_group || "",
    Public_Repositories: String(item.public_repositories),
    Lifetime_Commits: String(item.lifetime_commits),
  };
}

/**
 * PostgREST caps each response at SUPABASE_PAGE_SIZE rows.
 * Strategy: fetch the first page + total count together, then fire all remaining
 * pages in parallel — reduces N serial RTTs to just 2 effective waits.
 */
async function fetchAllGithubUsers(city: CityId): Promise<GithubUserRow[]> {
  // First page + total row count in one request
  const { data: firstPage, error: firstError, count } = await supabase
    .from("github_users")
    .select(GITHUB_USER_COLUMNS, { count: "exact" })
    .eq("city_id", city)
    .range(0, SUPABASE_PAGE_SIZE - 1);

  if (firstError) throw firstError;
  if (!firstPage?.length) return [];

  const total = count ?? firstPage.length;
  if (firstPage.length >= total) return firstPage as GithubUserRow[];

  // Fan out all remaining pages in parallel
  const pageCount = Math.ceil(total / SUPABASE_PAGE_SIZE);
  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) => {
      const from = (i + 1) * SUPABASE_PAGE_SIZE;
      return supabase
        .from("github_users")
        .select(GITHUB_USER_COLUMNS)
        .eq("city_id", city)
        .range(from, from + SUPABASE_PAGE_SIZE - 1)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as GithubUserRow[];
        });
    }),
  );

  return [firstPage as GithubUserRow[], ...remainingPages].flat();
}

export async function loadCityCsv(city: CityId): Promise<CsvUser[]> {
  const res = await fetch(CITY_FILE[city]);
  if (!res.ok) {
    throw new Error(`Failed to load CSV for ${city}`);
  }
  const text = await res.text();
  const parsed = csvParse(text) as unknown as CsvUser[];
  return parsed;
}

async function loadCityDataFromApi(city: CityId): Promise<CsvUser[] | null> {
  try {
    const res = await fetch(`/api/city/${city}`);
    if (!res.ok) return null;
    const data = (await res.json()) as CsvUser[];
    return data.length > 0 ? data : null;
  } catch {
    return null;
  }
}

export async function loadCityData(city: CityId): Promise<CsvUser[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Single edge-cached request — server fans out Supabase pages in one hop
  const apiData = await loadCityDataFromApi(city);
  if (apiData) {
    console.log(`[API] Loaded ${apiData.length} records for '${city}'.`);
    return apiData;
  }

  // If environment variables are missing, fallback to CSV immediately
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log("Supabase credentials not configured. Falling back to local CSV files...");
    return loadCityCsv(city);
  }

  try {
    console.log(`[SUPABASE] Fetching user data for city '${city}' from database...`);
    const data = await fetchAllGithubUsers(city);

    if (data.length === 0) {
      console.warn(`[SUPABASE] No user data found for city '${city}' in database. Falling back to local CSV...`);
      return loadCityCsv(city);
    }

    console.log(`[SUPABASE] Successfully loaded ${data.length} records from database.`);

    return data.map(mapGithubUserRow);
  } catch (err) {
    console.error(`[SUPABASE] Failed to load data from database:`, err);
    console.log("[FALLBACK] Loading local CSV backup file...");
    return loadCityCsv(city);
  }
}

