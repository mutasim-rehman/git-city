import type { CityId } from "@/lib/types";
import type { SectorRect } from "@/lib/city/layout";
import { supabase } from "@/lib/supabaseClient";

const GRID_CELL = 50;
const BOUNCE_SECONDS = 30;
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

function gridCoord(value: number): number {
  return Math.floor(value / GRID_CELL);
}

function logError(label: string, message: string) {
  console.error(`[ANALYTICS] ${label}:`, message);
}

export class AnalyticsTracker {
  private userId: string | null = null;
  private sessionId: string | null = null;
  private username = "";
  private cityId: CityId | null = null;
  private startedAt = 0;
  private lastAction = "session_start";
  private distance = 0;
  private lastPose: { x: number; z: number } | null = null;
  private ended = false;

  get sessionActive(): boolean {
    return !!this.sessionId && !this.ended;
  }

  async startSession(ctx: AnalyticsSessionContext): Promise<void> {
    if (!analyticsEnabled() || this.sessionId) return;

    this.userId = getOrCreateUserId(ctx.username);
    this.sessionId = crypto.randomUUID();
    this.username = ctx.username.trim();
    this.cityId = ctx.cityId;
    this.startedAt = Date.now();
    this.lastAction = "session_start";
    this.distance = 0;
    this.lastPose = null;
    this.ended = false;

    const now = new Date().toISOString();
    const seenKey = storageKey(this.username, "seen");
    const isFirstVisit = !localStorage.getItem(seenKey);
    if (isFirstVisit) localStorage.setItem(seenKey, "1");

    const totalSessions = bumpCounter(this.username, "sc");

    const { error: userError } = await supabase.from("analytics_users").upsert(
      {
        id: this.userId,
        username: this.username,
        city_id: ctx.cityId,
        first_visit_at: isFirstVisit ? now : undefined,
        last_active_at: now,
        total_sessions: totalSessions,
        total_time_seconds: readCounter(this.username, "tt"),
        total_distance: readCounter(this.username, "td"),
        search_count: readCounter(this.username, "sr"),
        preferred_vehicle: ctx.vehicle,
        preferred_theme: ctx.theme,
      },
      { onConflict: "id" },
    );
    if (userError) logError("upsert user", userError.message);

    const { error: sessionError } = await supabase.from("analytics_sessions").insert({
      id: this.sessionId,
      username: this.username,
      city_id: ctx.cityId,
      started_at: now,
      distance_traveled: 0,
      bounced: false,
      initial_vehicle: ctx.vehicle,
      initial_theme: ctx.theme,
      last_action: this.lastAction,
    });
    if (sessionError) logError("insert session", sessionError.message);

    await this.insertEvent({
      event_type: "session_start",
      vehicle: ctx.vehicle,
      theme: ctx.theme,
      feature: "session_start",
    });
  }

  private async insertEvent(
    fields: Record<string, string | number | boolean | null | undefined>,
  ): Promise<void> {
    if (!this.sessionId || !this.username) return;

    const { error } = await supabase.from("analytics_events").insert({
      session_id: this.sessionId,
      username: this.username,
      city_id: this.cityId,
      ...fields,
    });
    if (error) logError(`event ${fields.event_type}`, error.message);
  }

  private touchUser(patch: Record<string, string | number>): void {
    if (!this.userId) return;
    void supabase
      .from("analytics_users")
      .update({ last_active_at: new Date().toISOString(), ...patch })
      .eq("id", this.userId)
      .then(({ error }) => {
        if (error) logError("update user", error.message);
      });
  }

  trackAction(action: string): void {
    this.lastAction = action;
    void this.insertEvent({ event_type: "action", feature: action });
  }

  trackSearch(searchTerm: string, resultsCount: number, converted: boolean): void {
    this.lastAction = converted ? "search_converted" : "search";
    void this.insertEvent({
      event_type: "search",
      search_term: searchTerm,
      results_count: resultsCount,
      converted,
    });
    const searchCount = bumpCounter(this.username, "sr");
    this.touchUser({ search_count: searchCount });
  }

  trackFeature(feature: string): void {
    this.lastAction = feature;
    void this.insertEvent({ event_type: "feature", feature });
  }

  trackVehicle(vehicle: string): void {
    this.lastAction = "vehicle_select";
    void this.insertEvent({ event_type: "vehicle_select", vehicle });
    this.touchUser({ preferred_vehicle: vehicle });
  }

  trackTheme(theme: string, durationSeconds?: number): void {
    this.lastAction = "theme_change";
    void this.insertEvent({
      event_type: "theme_change",
      theme,
      duration_seconds: durationSeconds ?? null,
    });
    this.touchUser({ preferred_theme: theme });
  }

  trackSector(sectorId: number, sectorLabel: string, durationSeconds: number): void {
    this.lastAction = "sector_visit";
    void this.insertEvent({
      event_type: "sector_time",
      sector_id: sectorId,
      sector_label: sectorLabel,
      duration_seconds: Math.round(durationSeconds),
    });
  }

  trackBuildingVisit(githubUsername: string, sectorId: number): void {
    this.lastAction = "building_visit";
    void this.insertEvent({
      event_type: "building_visit",
      github_username: githubUsername,
      sector_id: sectorId,
    });
  }

  trackPosition(x: number, z: number): void {
    if (this.lastPose) {
      const dx = x - this.lastPose.x;
      const dz = z - this.lastPose.z;
      this.distance += Math.hypot(dx, dz);
    }
    this.lastPose = { x, z };

    void this.insertEvent({
      event_type: "position",
      grid_x: gridCoord(x),
      grid_z: gridCoord(z),
    });
  }

  async endSession(): Promise<void> {
    if (!analyticsEnabled() || !this.sessionId || this.ended) return;
    this.ended = true;

    const endedAt = new Date();
    const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - this.startedAt) / 1000));
    const bounced = durationSeconds < BOUNCE_SECONDS && this.distance < BOUNCE_DISTANCE;
    const sessionDistance = Math.round(this.distance);

    const { error: sessionError } = await supabase
      .from("analytics_sessions")
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        distance_traveled: sessionDistance,
        bounced,
        last_action: this.lastAction,
      })
      .eq("id", this.sessionId);
    if (sessionError) logError("end session", sessionError.message);

    const totalTime = readCounter(this.username, "tt") + durationSeconds;
    const totalDistance = readCounter(this.username, "td") + sessionDistance;
    writeCounter(this.username, "tt", totalTime);
    writeCounter(this.username, "td", totalDistance);

    if (this.userId) {
      const { error: userError } = await supabase
        .from("analytics_users")
        .update({
          last_active_at: endedAt.toISOString(),
          total_time_seconds: totalTime,
          total_distance: totalDistance,
        })
        .eq("id", this.userId);
      if (userError) logError("update user on end", userError.message);
    }

    this.sessionId = null;
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
