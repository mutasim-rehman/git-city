import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { CityId, CsvUser } from "@/lib/types";

const VALID_CITIES = new Set<CityId>(["lahore", "karachi", "islamabad"]);
const PAGE_SIZE = 1000;

const GITHUB_USER_COLUMNS =
  "username, profile_url, github_id, year_group, public_repositories, lifetime_commits, field";

type GithubUserRow = {
  username: string;
  profile_url: string;
  github_id: number;
  year_group: string | null;
  public_repositories: number;
  lifetime_commits: number;
  field: string | null;
};

function mapGithubUserRow(item: GithubUserRow): CsvUser {
  return {
    Username: item.username,
    "Profile URL": item.profile_url,
    "GitHub ID": String(item.github_id),
    Year_Group: item.year_group || "",
    Public_Repositories: String(item.public_repositories),
    Lifetime_Commits: String(item.lifetime_commits),
    Field: item.field || "",
  };
}

async function fetchAllGithubUsers(city: CityId): Promise<CsvUser[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: firstPage, error: firstError, count } = await supabase
    .from("github_users")
    .select(GITHUB_USER_COLUMNS, { count: "exact" })
    .eq("city_id", city)
    .range(0, PAGE_SIZE - 1);

  if (firstError) throw firstError;
  if (!firstPage?.length) return [];

  const total = count ?? firstPage.length;
  if (firstPage.length >= total) {
    return (firstPage as GithubUserRow[]).map(mapGithubUserRow);
  }

  const pageCount = Math.ceil(total / PAGE_SIZE);
  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) => {
      const from = (i + 1) * PAGE_SIZE;
      return supabase
        .from("github_users")
        .select(GITHUB_USER_COLUMNS)
        .eq("city_id", city)
        .range(from, from + PAGE_SIZE - 1)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as GithubUserRow[];
        });
    }),
  );

  return [firstPage as GithubUserRow[], ...remainingPages]
    .flat()
    .map(mapGithubUserRow);
}

/** Cache aggregated city payloads at the edge — one browser request instead of ~20 Supabase round-trips. */
export const revalidate = 3600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ city: string }> },
) {
  const { city } = await params;
  if (!VALID_CITIES.has(city as CityId)) {
    return NextResponse.json({ error: "Unknown city" }, { status: 400 });
  }

  try {
    const data = await fetchAllGithubUsers(city as CityId);
    if (data.length === 0) {
      return NextResponse.json({ error: "No data" }, { status: 404 });
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[api/city] fetch failed:", err);
    return NextResponse.json({ error: "Failed to load city data" }, { status: 500 });
  }
}
