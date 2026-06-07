export type AnalyticsDashboard = {
  activeUsers: { dau: number; wau: number; mau: number } | null;
  retention: {
    new_users: number;
    returning_users: number;
    returning_pct: number | null;
  } | null;
  engagement: {
    total_sessions: number;
    avg_session_seconds: number | null;
    bounce_rate_pct: number | null;
    avg_distance_per_session: number | null;
  } | null;
  topSearches: Array<{
    search_term: string;
    search_count: number;
    no_results: number;
    converted: number;
  }>;
  recentSearches: Array<{
    username: string;
    city_id: string | null;
    search_term: string;
    results_count: number | null;
    converted: boolean | null;
    created_at: string;
  }>;
  vehicleStats: Array<{
    vehicle: string | null;
    selections: number;
    total_seconds: number | null;
  }>;
  themeStats: Array<{
    theme: string | null;
    selections: number;
    total_seconds: number | null;
  }>;
  sectorTime: Array<{
    city_id: string | null;
    sector_id: number | null;
    sector_label: string | null;
    visits: number;
    total_seconds: number | null;
  }>;
  topBuildings: Array<{
    github_username: string | null;
    sector_id: number | null;
    visit_count: number;
  }>;
  heatmap: Array<{
    city_id: string | null;
    grid_x: number | null;
    grid_z: number | null;
    sample_count: number;
  }>;
  featureUsage: Array<{
    feature: string;
    usage_count: number;
  }>;
  dropOffs: Array<{
    last_action: string;
    occurrences: number;
  }>;
  userJourney: Array<{
    session_id: string;
    username: string;
    city_id: string;
    started_at: string;
    first_action: string;
  }>;
  users: Array<{
    id: string;
    username: string;
    city_id: string | null;
    first_visit_at: string;
    last_active_at: string;
    total_sessions: number;
    total_time_seconds: number;
    preferred_vehicle: string | null;
    preferred_theme: string | null;
    search_count: number;
    total_distance: number;
  }>;
  recentSessions: Array<{
    id: string;
    username: string;
    city_id: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    distance_traveled: number;
    bounced: boolean;
    initial_vehicle: string | null;
    initial_theme: string | null;
  }>;
};
