import type { CityId } from "@/lib/types";
import type { SectorRect } from "@/lib/city/layout";
import { supabase } from "@/lib/supabaseClient";

const BOUNCE_SECONDS = 60;
const BOUNCE_DISTANCE = 40;
const PENDING_SESSION_KEY = "gc_pending_session_end";

export type AnalyticsSessionContext = {
  username: string;
  cityId: CityId;
  vehicle: string;
  theme: string;
};

type SessionEndPayload = {
  sessionId: string;
  userId: string;
  username: string;
  endedAt: string;
  durationSeconds: number;
  distanceTraveled: number;
  bounced: boolean;
  finalTheme: string;
  finalVehicle: string;
  lastAction: string;
  searches: number;
  searchesNoResults: number;
  searchesConverted: number;
  githubUsersSearched: string[];
};

function analyticsEnabled(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

function supabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
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

function rpcFetch(
  fn: string,
  body: Record<string, unknown>,
  keepalive = false,
): Promise<Response> {
  return fetch(`${supabaseUrl()}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey(),
      Authorization: `Bearer ${supabaseAnonKey()}`,
    },
    body: JSON.stringify(body),
    keepalive,
  });
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
  private currentVehicle = "";
  private ended = false;
  private lastSearchQuery: string | null = null;
  private githubUsersSearched: string[] = [];
  private sessionSearchCount = 0;
  private sessionSearchesNoResults = 0;
  private sessionSearchesConverted = 0;
  private syncing = false;

  get sessionActive(): boolean {
    return this.sessionReady && !!this.sessionId && !this.ended;
  }

  async startSession(ctx: AnalyticsSessionContext): Promise<void> {
    if (!analyticsEnabled()) return;
    await this.flushPendingSessionEnd();
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
      final_vehicle: ctx.vehicle,
      metadata: { github_users_searched: [] },
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
    this.currentVehicle = ctx.vehicle;
    this.distance = 0;
    this.lastPose = null;
    this.ended = false;
    this.lastSearchQuery = null;
    this.githubUsersSearched = [];
    this.sessionSearchCount = 0;
    this.sessionSearchesNoResults = 0;
    this.sessionSearchesConverted = 0;

    await this.insertEvent("session_start", {
      vehicle: ctx.vehicle,
      theme: ctx.theme,
    });
    await this.insertEvent("theme_select", { theme: ctx.theme });
    await this.insertEvent("vehicle_select", { vehicle: ctx.vehicle });
    void this.syncSession();
  }

  private sessionSnapshot(): SessionEndPayload | null {
    if (!this.sessionId || !this.userId || !this.sessionReady) return null;
    const endedAt = new Date();
    const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - this.startedAt) / 1000));
    const sessionDistance = Math.round(this.distance);
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      username: this.username,
      endedAt: endedAt.toISOString(),
      durationSeconds,
      distanceTraveled: sessionDistance,
      bounced: durationSeconds < BOUNCE_SECONDS && sessionDistance < BOUNCE_DISTANCE,
      finalTheme: this.lastTheme,
      finalVehicle: this.currentVehicle,
      lastAction: this.lastAction,
      searches: this.sessionSearchCount,
      searchesNoResults: this.sessionSearchesNoResults,
      searchesConverted: this.sessionSearchesConverted,
      githubUsersSearched: [...this.githubUsersSearched],
    };
  }

  private syncPayloadFromSnapshot(snap: SessionEndPayload) {
    return {
      p_session_id: snap.sessionId,
      p_duration_seconds: snap.durationSeconds,
      p_distance_traveled: snap.distanceTraveled,
      p_final_vehicle: snap.finalVehicle,
      p_last_action: snap.lastAction,
      p_searches: snap.searches,
      p_searches_no_results: snap.searchesNoResults,
      p_searches_converted: snap.searchesConverted,
      p_github_users_searched: snap.githubUsersSearched,
    };
  }

  private endPayloadFromSnapshot(snap: SessionEndPayload) {
    return {
      p_session_id: snap.sessionId,
      p_ended_at: snap.endedAt,
      p_duration_seconds: snap.durationSeconds,
      p_distance_traveled: snap.distanceTraveled,
      p_bounced: snap.bounced,
      p_final_theme: snap.finalTheme,
      p_final_vehicle: snap.finalVehicle,
      p_last_action: snap.lastAction,
      p_searches: snap.searches,
      p_searches_no_results: snap.searchesNoResults,
      p_searches_converted: snap.searchesConverted,
      p_github_users_searched: snap.githubUsersSearched,
    };
  }

  private savePendingSessionEnd(snap: SessionEndPayload): void {
    try {
      localStorage.setItem(PENDING_SESSION_KEY, JSON.stringify(snap));
    } catch {
      // ignore quota errors
    }
  }

  private clearPendingSessionEnd(): void {
    localStorage.removeItem(PENDING_SESSION_KEY);
  }

  private applySessionEndCounters(snap: SessionEndPayload): void {
    const totalTime = readCounter(snap.username, "tt") + snap.durationSeconds;
    const totalDistance = readCounter(snap.username, "td") + snap.distanceTraveled;
    writeCounter(snap.username, "tt", totalTime);
    writeCounter(snap.username, "td", totalDistance);
  }

  private async patchUserTotals(snap: SessionEndPayload, keepalive = false): Promise<void> {
    const totalTime = readCounter(snap.username, "tt");
    const totalDistance = readCounter(snap.username, "td");
    const patch = {
      p_id: snap.userId,
      p_last_active_at: snap.endedAt,
      p_search_count: null,
      p_preferred_vehicle: null,
      p_preferred_theme: null,
      p_total_time_seconds: totalTime,
      p_total_distance: totalDistance,
    };
    if (keepalive) {
      void rpcFetch("analytics_patch_user", patch, true).catch(() => {});
      return;
    }
    const { error: userError } = await supabase.rpc("analytics_patch_user", patch);
    if (userError) logError("update user on end", userError.message);
  }

  private async flushPendingSessionEnd(): Promise<void> {
    if (!analyticsEnabled()) return;
    const raw = localStorage.getItem(PENDING_SESSION_KEY);
    if (!raw) return;

    let snap: SessionEndPayload;
    try {
      snap = JSON.parse(raw) as SessionEndPayload;
    } catch {
      this.clearPendingSessionEnd();
      return;
    }

    const { error } = await supabase.rpc("analytics_end_session", this.endPayloadFromSnapshot(snap));
    if (error) {
      logError("flush pending session", error.message);
      return;
    }

    this.applySessionEndCounters(snap);

    const { error: userError } = await supabase.rpc("analytics_patch_user", {
      p_id: snap.userId,
      p_last_active_at: snap.endedAt,
      p_search_count: null,
      p_preferred_vehicle: null,
      p_preferred_theme: null,
      p_total_time_seconds: readCounter(snap.username, "tt"),
      p_total_distance: readCounter(snap.username, "td"),
    });
    if (userError) logError("flush pending user", userError.message);

    this.clearPendingSessionEnd();
  }

  /** Push live session state to the database (survives abrupt tab closes). */
  syncSession(keepalive = false): void {
    if (!analyticsEnabled() || !this.sessionActive || this.syncing) return;
    const snap = this.sessionSnapshot();
    if (!snap) return;

    this.syncing = true;
    const payload = this.syncPayloadFromSnapshot(snap);

    const done = () => {
      this.syncing = false;
    };

    if (keepalive) {
      void rpcFetch("analytics_sync_session", payload, true)
        .then((res) => {
          if (!res.ok) logError("sync session keepalive", String(res.status));
        })
        .catch(() => logError("sync session keepalive", "network error"))
        .finally(done);
      return;
    }

    void (async () => {
      try {
        const { error } = await supabase.rpc("analytics_sync_session", payload);
        if (error) logError("sync session", error.message);
      } finally {
        done();
      }
    })();
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

  private insertEventKeepalive(
    eventType: string,
    payload: Record<string, string | number | boolean | null>,
    sessionId: string,
  ): void {
    if (!sessionId || !this.username) return;
    const url = `${supabaseUrl()}/rest/v1/analytics_events`;
    void fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey(),
        Authorization: `Bearer ${supabaseAnonKey()}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        session_id: sessionId,
        username: this.username,
        city_id: this.cityId,
        event_type: eventType,
        payload,
      }),
      keepalive: true,
    }).catch(() => {});
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
    const query = searchTerm.trim().toLowerCase();
    if (!query) return;

    this.lastSearchQuery = query;
    this.lastAction = converted ? "search" : resultsCount > 0 ? "search" : "search_no_results";
    this.sessionSearchCount += 1;
    if (resultsCount === 0) this.sessionSearchesNoResults += 1;
    if (converted) this.sessionSearchesConverted += 1;
    if (!this.githubUsersSearched.includes(query)) {
      this.githubUsersSearched.push(query);
    }

    if (resultsCount === 0) {
      void this.insertEvent("search_no_results", {
        query,
        results_count: 0,
        converted: false,
      });
    } else {
      void this.insertEvent("search", {
        query,
        results_count: resultsCount,
        converted,
      });
    }

    const searchCount = bumpCounter(this.username, "sr");
    this.touchUser({ search_count: searchCount });
    this.syncSession();
  }

  trackFeature(feature: string): void {
    this.lastAction = feature;
    void this.insertEvent("settings_change", { feature });
  }

  trackVehicle(vehicle: string): void {
    this.lastAction = "vehicle_select";
    this.currentVehicle = vehicle;
    void this.insertEvent("vehicle_select", { vehicle });
    this.touchUser({ preferred_vehicle: vehicle });
    this.syncSession();
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
    this.syncSession();
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
    this.syncSession();
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

  async endSession(options: { keepalive?: boolean } = {}): Promise<void> {
    if (!analyticsEnabled()) return;
    if (this.startPromise) await this.startPromise;
    if (!this.sessionId || !this.sessionReady || this.ended) {
      this.sessionId = null;
      this.sessionReady = false;
      return;
    }

    this.ended = true;
    const snap = this.sessionSnapshot();
    if (!snap) return;

    const sessionId = snap.sessionId;

    this.savePendingSessionEnd(snap);

    if (options.keepalive) {
      this.insertEventKeepalive(
        "session_end",
        {
          last_action: snap.lastAction,
          duration_seconds: snap.durationSeconds,
          distance_traveled: snap.distanceTraveled,
          bounced: snap.bounced,
        },
        sessionId,
      );
      void rpcFetch("analytics_end_session", this.endPayloadFromSnapshot(snap), true)
        .then(async (res) => {
          if (!res.ok) {
            logError("end session keepalive", String(res.status));
            return;
          }
          this.applySessionEndCounters(snap);
          this.clearPendingSessionEnd();
          await this.patchUserTotals(snap, true);
        })
        .catch(() => logError("end session keepalive", "network error"));
    } else {
      await this.insertEvent(
        "session_end",
        {
          last_action: snap.lastAction,
          duration_seconds: snap.durationSeconds,
          distance_traveled: snap.distanceTraveled,
          bounced: snap.bounced,
        },
        sessionId,
      );

      const { error: sessionError } = await supabase.rpc(
        "analytics_end_session",
        this.endPayloadFromSnapshot(snap),
      );
      if (sessionError) {
        logError("end session", sessionError.message);
      } else {
        this.applySessionEndCounters(snap);
        this.clearPendingSessionEnd();
        await this.patchUserTotals(snap);
      }
    }

    this.sessionId = null;
    this.sessionReady = false;
    this.userId = null;
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
