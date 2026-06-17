import type { AnalyticsDashboard } from "@/lib/admin/types";
import { getSupabaseAdmin } from "./supabaseAdmin";

async function queryView<T>(view: string, limit = 50): Promise<T[]> {
  const { data, error } = await getSupabaseAdmin().from(view).select("*").limit(limit);
  if (error) {
    console.error(`[admin] view ${view}:`, error.message);
    return [];
  }
  return (data ?? []) as T[];
}

async function querySingle<T>(view: string): Promise<T | null> {
  const rows = await queryView<T>(view, 1);
  return rows[0] ?? null;
}

export async function fetchAnalyticsDashboard(): Promise<AnalyticsDashboard> {
  const sb = getSupabaseAdmin();

  const [
    activeUsers,
    retention,
    engagement,
    topSearches,
    recentSearches,
    vehicleStats,
    themeStats,
    sectorTime,
    topBuildings,
    heatmap,
    featureUsage,
    dropOffs,
    userJourney,
    userPlaytime,
    usersRes,
    sessionsRes,
  ] = await Promise.all([
    querySingle<AnalyticsDashboard["activeUsers"] & object>("v_analytics_active_users"),
    querySingle<AnalyticsDashboard["retention"] & object>("v_analytics_user_retention"),
    querySingle<AnalyticsDashboard["engagement"] & object>("v_analytics_engagement"),
    queryView<AnalyticsDashboard["topSearches"][number]>("v_analytics_top_searches", 20),
    queryView<AnalyticsDashboard["recentSearches"][number]>("v_analytics_recent_searches", 25),
    queryView<AnalyticsDashboard["vehicleStats"][number]>("v_analytics_vehicle_stats", 15),
    queryView<AnalyticsDashboard["themeStats"][number]>("v_analytics_theme_stats", 10),
    queryView<AnalyticsDashboard["sectorTime"][number]>("v_analytics_sector_time", 20),
    queryView<AnalyticsDashboard["topBuildings"][number]>("v_analytics_top_buildings", 20),
    queryView<AnalyticsDashboard["heatmap"][number]>("v_analytics_heatmap", 80),
    queryView<AnalyticsDashboard["featureUsage"][number]>("v_analytics_feature_usage", 20),
    queryView<AnalyticsDashboard["dropOffs"][number]>("v_analytics_drop_offs", 15),
    queryView<AnalyticsDashboard["userJourney"][number]>("v_analytics_user_journey", 20),
    queryView<{
      username: string;
      avg_session_seconds: number | null;
      min_session_seconds: number | null;
      max_session_seconds: number | null;
    }>("v_analytics_user_playtime", 200),
    sb
      .from("analytics_users")
      .select(
        "id, username, city_id, first_visit_at, last_active_at, total_sessions, total_time_seconds, preferred_vehicle, preferred_theme, search_count, total_distance",
      )
      .order("last_active_at", { ascending: false })
      .limit(50),
    sb
      .from("analytics_sessions")
      .select(
        "id, username, city_id, started_at, ended_at, duration_seconds, distance_traveled, bounced, initial_vehicle, final_vehicle, initial_theme, searches, metadata",
      )
      .order("started_at", { ascending: false })
      .limit(50),
  ]);

  const playtimeByUser = new Map(
    userPlaytime.map((row) => [row.username.toLowerCase(), row]),
  );

  const users = usersRes.error
    ? []
    : (usersRes.data ?? []).map((u) => {
        const pt = playtimeByUser.get(u.username.toLowerCase());
        return {
          ...u,
          avg_session_seconds: pt?.avg_session_seconds ?? null,
          min_session_seconds: pt?.min_session_seconds ?? null,
          max_session_seconds: pt?.max_session_seconds ?? null,
        };
      });

  return {
    activeUsers,
    retention,
    engagement,
    topSearches,
    recentSearches,
    vehicleStats,
    themeStats,
    sectorTime,
    topBuildings,
    heatmap,
    featureUsage,
    dropOffs,
    userJourney,
    users,
    recentSessions: sessionsRes.error ? [] : (sessionsRes.data ?? []),
  };
}
