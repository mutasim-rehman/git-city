import type { CityId } from "@/lib/types";
import type { SectorRect } from "@/lib/city/layout";
import { supabase } from "@/lib/supabaseClient";

const BOUNCE_SECONDS = 60;
const BOUNCE_DISTANCE = 40;

export type AnalyticsSessionContext = {
  username: string;
  cityId: CityId;
  vehicle: string;
  theme: string;
};

function analyticsEnabled(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function storageKey(username: string, suffix: string): string {
  return `gc_${suffix}_${username.trim().toLowerCase()}`;
}

function getOrCreateUserId(username: string): string {
  const key = storageKey(username, "au");
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function readCounter(username: string, suffix: string): number {
  return parseInt(localStorage.getItem(storageKey(username, suffix)) ?? "0", 10) || 0;
}

function writeCounter(username: string, suffix: string, value: number): void {
  localStorage.setItem(storageKey(username, suffix), String(value));
}

function bumpCounter(username: string, suffix: string, delta = 1): number {
  const next = readCounter(username, suffix) + delta;
  writeCounter(username, suffix, next);
  return next;
}

function logError(label: string, message: string) {
  console.error(`[ANALYTICS] ${label}:`, message);
}

export class AnalyticsTracker {
  private userId: string | null = null;
  private sessionId: string | null = null;
  private sessionReady = false;
  private startPromise: Promise<void> | null = null;
  private username = "";
  private cityId: CityId | null = null;
  private startedAt = 0;
  private lastAction = "session_start";
  private distance = 0;
  private lastPose: { x: number; z: number } | null = null;
  private lastTheme = "";
  private ended = false;
  private lastSearchQuery: string | null = null;

  get sessionActive(): boolean {
    return this.sessionReady && !!this.sessionId && !this.ended;
  }

  async startSession(ctx: AnalyticsSessionContext): Promise<void> {
    if (!analyticsEnabled()) return;
    if (this.sessionActive) return;
    if (this.startPromise) return this.startPromise;

    this.startPromise = this.beginSession(ctx).finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  private async beginSession(ctx: AnalyticsSessionContext): Promise<void> {
    const pendingSessionId = crypto.randomUUID();
    const pendingUserId = getOrCreateUserId(ctx.username);
    const username = ctx.username.trim();
    const now = new Date().toISOString();
    const seenKey = storageKey(username, "seen");
    const isFirstVisit = !localStorage.getItem(seenKey);
    if (isFirstVisit) localStorage.setItem(seenKey, "1");

    const totalSessions = bumpCounter(username, "sc");

    const { error: userError } = await supabase.rpc("analytics_upsert_user", {
      p_id: pendingUserId,
      p_username: username,
      p_city_id: ctx.cityId,
      p_first_visit_at: isFirstVisit ? now : null,
      p_last_active_at: now,
      p_total_sessions: totalSessions,
      p_total_time_seconds: readCounter(username, "tt"),
      p_total_distance: readCounter(username, "td"),
      p_search_count: readCounter(username, "sr"),
      p_preferred_vehicle: ctx.vehicle,
      p_preferred_theme: ctx.theme,
    });
    if (userError) {
      logError("upsert user", userError.message);
      return;
    }

    const { error: sessionError } = await supabase.from("analytics_sessions").insert({
      id: pendingSessionId,
      user_id: pendingUserId,
      username,
      city_id: ctx.cityId,
      client_session_id: pendingSessionId,
      started_at: now,
      distance_traveled: 0,
      bounced: false,
      initial_vehicle: ctx.vehicle,
      initial_theme: ctx.theme,
    });
    if (sessionError) {
      logError("insert session", sessionError.message);
      return;
    }

    this.userId = pendingUserId;
    this.sessionId = pendingSessionId;
    this.sessionReady = true;
    this.username = username;
    this.cityId = ctx.cityId;
    this.startedAt = Date.now();
    this.lastAction = "session_start";
    this.lastTheme = ctx.theme;
    this.distance = 0;
    this.lastPose = null;
    this.ended = false;
    this.lastSearchQuery = null;

    await this.insertEvent("session_start", {
      vehicle: ctx.vehicle,
      theme: ctx.theme,
    });
    await this.insertEvent("theme_select", { theme: ctx.theme });
    await this.insertEvent("vehicle_select", { vehicle: ctx.vehicle });
  }

  private async insertEvent(
    eventType: string,
    payload: Record<string, string | number | boolean | null>,
    sessionId = this.sessionId,
  ): Promise<void> {
    if (!sessionId || !this.username) return;
    if (!this.sessionReady && eventType !== "session_end") return;

    const { error } = await supabase.from("analytics_events").insert({
      session_id: sessionId,
      username: this.username,
      city_id: this.cityId,
      event_type: eventType,
      payload,
    });
    if (error) logError(`event ${eventType}`, error.message);
  }

  private touchUser(patch: {
    search_count?: number;
    preferred_vehicle?: string;
    preferred_theme?: string;
  }): void {
    if (!this.userId) return;
    void supabase
      .rpc("analytics_patch_user", {
        p_id: this.userId,
        p_last_active_at: new Date().toISOString(),
        p_search_count: patch.search_count ?? null,
        p_preferred_vehicle: patch.preferred_vehicle ?? null,
        p_preferred_theme: patch.preferred_theme ?? null,
        p_total_time_seconds: null,
        p_total_distance: null,
      })
      .then(({ error }) => {
        if (error) logError("update user", error.message);
      });
  }

  trackAction(action: string): void {
    this.lastAction = action;
    void this.insertEvent("action", { feature: action });
  }

  trackSearch(searchTerm: string, resultsCount: number, converted: boolean): void {
    this.lastSearchQuery = searchTerm;
    this.lastAction = converted ? "search" : resultsCount > 0 ? "search" : "search_no_results";

    if (resultsCount === 0) {
      void this.insertEvent("search_no_results", {
        query: searchTerm,
        results_count: 0,
        converted: false,
      });
    } else {
      void this.insertEvent("search", {
        query: searchTerm,
        results_count: resultsCount,
        converted,
      });
    }

    const searchCount = bumpCounter(this.username, "sr");
    this.touchUser({ search_count: searchCount });
  }

  trackFeature(feature: string): void {
    this.lastAction = feature;
    void this.insertEvent("settings_change", { feature });
  }

  trackVehicle(vehicle: string): void {
    this.lastAction = "vehicle_select";
    void this.insertEvent("vehicle_select", { vehicle });
    this.touchUser({ preferred_vehicle: vehicle });
  }

  trackTheme(theme: string, durationSeconds?: number): void {
    this.lastAction = "theme_switch";
    void this.insertEvent("theme_switch", {
      from: this.lastTheme,
      to: theme,
      duration_seconds: durationSeconds ?? null,
    });
    this.lastTheme = theme;
    this.touchUser({ preferred_theme: theme });
  }

  trackSector(sectorId: number, sectorLabel: string, durationSeconds: number): void {
    this.lastAction = "sector_enter";
    void this.insertEvent("sector_enter", {
      sector_id: sectorId,
      sector_label: sectorLabel,
      duration_seconds: Math.round(durationSeconds),
    });
  }

  trackBuildingVisit(githubUsername: string, sectorId: number): void {
    this.lastAction = "building_visit";
    void this.insertEvent("building_visit", {
      github_username: githubUsername,
      sector_id: sectorId,
    });
    if (this.lastSearchQuery) {
      void this.insertEvent("search_visit", {
        query: this.lastSearchQuery,
        visited_username: githubUsername,
      });
      this.lastSearchQuery = null;
    }
  }

  trackPosition(x: number, z: number, speed = 0): void {
    if (this.lastPose) {
      const dx = x - this.lastPose.x;
      const dz = z - this.lastPose.z;
      this.distance += Math.hypot(dx, dz);
    }
    this.lastPose = { x, z };

    void this.insertEvent("position_sample", { x, z, speed });
  }

  async endSession(): Promise<void> {
    if (!analyticsEnabled()) return;
    if (this.startPromise) await this.startPromise;
    if (!this.sessionId || !this.sessionReady || this.ended) {
      this.sessionId = null;
      this.sessionReady = false;
      return;
    }

    this.ended = true;
    const sessionId = this.sessionId;
    const username = this.username;
    const userId = this.userId;
    const startedAt = this.startedAt;
    const lastAction = this.lastAction;
    const lastTheme = this.lastTheme;
    const sessionDistance = Math.round(this.distance);

    const endedAt = new Date();
    const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - startedAt) / 1000));
    const bounced = durationSeconds < BOUNCE_SECONDS && sessionDistance < BOUNCE_DISTANCE;

    await this.insertEvent(
      "session_end",
      {
        last_action: lastAction,
        duration_seconds: durationSeconds,
        distance_traveled: sessionDistance,
        bounced,
      },
      sessionId,
    );

    this.sessionId = null;
    this.sessionReady = false;
    this.userId = null;

    const { error: sessionError } = await supabase.rpc("analytics_end_session", {
      p_session_id: sessionId,
      p_ended_at: endedAt.toISOString(),
      p_duration_seconds: durationSeconds,
      p_distance_traveled: sessionDistance,
      p_bounced: bounced,
      p_final_theme: lastTheme,
      p_last_action: lastAction,
    });
    if (sessionError) logError("end session", sessionError.message);

    const totalTime = readCounter(username, "tt") + durationSeconds;
    const totalDistance = readCounter(username, "td") + sessionDistance;
    writeCounter(username, "tt", totalTime);
    writeCounter(username, "td", totalDistance);

    if (userId) {
      const { error: userError } = await supabase.rpc("analytics_patch_user", {
        p_id: userId,
        p_last_active_at: endedAt.toISOString(),
        p_search_count: null,
        p_preferred_vehicle: null,
        p_preferred_theme: null,
        p_total_time_seconds: totalTime,
        p_total_distance: totalDistance,
      });
      if (userError) logError("update user on end", userError.message);
    }
  }
}

export const gameAnalytics = new AnalyticsTracker();

export function findSectorAt(
  x: number,
  z: number,
  sectors: SectorRect[],
): SectorRect | null {
  for (const sector of sectors) {
    const { minX, maxX, minZ, maxZ } = sector.rect;
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return sector;
  }
  return null;
}
