"use client";

import type { AnalyticsDashboard } from "@/lib/admin/types";
import { formatDate, formatDuration, formatNumber, formatPercent } from "@/lib/admin/format";

type Props = {
  data: AnalyticsDashboard;
  onLogout: () => void;
  onRefresh: () => void;
  refreshing: boolean;
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-purple-500/25 bg-black/40 p-4 backdrop-blur-sm">
      <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-purple-300/75">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string | number | null | undefined>[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-purple-500/20 px-4 py-8 text-center text-sm text-slate-500">
        {empty}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-purple-500/20 bg-black/30">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-purple-500/15 text-[10px] font-mono uppercase tracking-[0.2em] text-purple-300/70">
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-purple-500/10 last:border-0 hover:bg-purple-500/5">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-4 py-2.5 text-slate-200 ${c.align === "right" ? "text-right tabular-nums" : ""}`}
                >
                  {row[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeatmapGrid({ points }: { points: AnalyticsDashboard["heatmap"] }) {
  if (points.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-purple-500/20 px-4 py-8 text-center text-sm text-slate-500">
        No movement samples yet. Position events will populate the heatmap.
      </p>
    );
  }
  const max = Math.max(...points.map((p) => p.sample_count), 1);
  const sorted = [...points].sort((a, b) => b.sample_count - a.sample_count).slice(0, 48);
  return (
    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-12">
      {sorted.map((p, i) => {
        const intensity = p.sample_count / max;
        return (
          <div
            key={i}
            title={`${p.city_id ?? "?"} (${p.grid_x}, ${p.grid_z}): ${p.sample_count} samples`}
            className="aspect-square rounded-md border border-purple-500/15"
            style={{
              background: `rgba(236, 72, 153, ${0.12 + intensity * 0.75})`,
              boxShadow: intensity > 0.5 ? "0 0 12px rgba(236,72,153,0.35)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

export function AdminDashboard({ data, onLogout, onRefresh, refreshing }: Props) {
  const { activeUsers, retention, engagement } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-purple-950/30 to-pink-950/20">
      <header className="sticky top-0 z-20 border-b border-purple-500/20 bg-black/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-pink-300/80">
              Git City
            </p>
            <h1 className="text-xl font-semibold text-slate-100">Analytics</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-lg border border-purple-500/35 bg-black/40 px-3 py-1.5 text-xs text-purple-200 transition hover:bg-purple-500/10 disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-pink-500/40 bg-pink-500/10 px-3 py-1.5 text-xs text-pink-200 transition hover:bg-pink-500/20"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6">
        {/* Engagement overview */}
        <Section title="Engagement" description="DAU, sessions, and retention at a glance">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="DAU" value={formatNumber(activeUsers?.dau)} />
            <StatCard label="WAU" value={formatNumber(activeUsers?.wau)} />
            <StatCard label="MAU" value={formatNumber(activeUsers?.mau)} />
            <StatCard
              label="Returning users"
              value={formatPercent(retention?.returning_pct)}
              sub={`${formatNumber(retention?.returning_users)} returning · ${formatNumber(retention?.new_users)} new`}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total sessions" value={formatNumber(engagement?.total_sessions)} />
            <StatCard
              label="Avg session"
              value={formatDuration(engagement?.avg_session_seconds ?? null)}
            />
            <StatCard
              label="Min session"
              value={formatDuration(engagement?.min_session_seconds ?? null)}
            />
            <StatCard
              label="Max session"
              value={formatDuration(engagement?.max_session_seconds ?? null)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
            <StatCard label="Bounce rate" value={formatPercent(engagement?.bounce_rate_pct)} />
            <StatCard
              label="Avg distance"
              value={formatNumber(engagement?.avg_distance_per_session)}
              sub="units per session"
            />
          </div>
        </Section>

        {/* Search */}
        <Section title="Search analytics" description="Queries, conversions, and recent activity">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-purple-200/90">Most searched</h3>
              <DataTable
                empty="No searches recorded yet."
                columns={[
                  { key: "term", label: "Term" },
                  { key: "count", label: "Searches", align: "right" },
                  { key: "converted", label: "Visited", align: "right" },
                ]}
                rows={data.topSearches.map((r) => ({
                  term: r.search_term,
                  count: r.search_count,
                  converted: r.converted,
                }))}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-purple-200/90">Recent searches</h3>
              <DataTable
                empty="No recent searches."
                columns={[
                  { key: "user", label: "User" },
                  { key: "term", label: "Query" },
                  { key: "when", label: "When", align: "right" },
                ]}
                rows={data.recentSearches.map((r) => ({
                  user: r.username,
                  term: r.search_term,
                  when: formatDate(r.created_at),
                }))}
              />
            </div>
          </div>
        </Section>

        {/* Vehicle & theme */}
        <Section title="Vehicle & theme" description="Selections and time spent">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-purple-200/90">Vehicles</h3>
              <DataTable
                empty="No vehicle events yet."
                columns={[
                  { key: "vehicle", label: "Vehicle" },
                  { key: "selections", label: "Uses", align: "right" },
                  { key: "time", label: "Time", align: "right" },
                ]}
                rows={data.vehicleStats.map((r) => ({
                  vehicle: r.vehicle ?? "—",
                  selections: r.selections,
                  time: formatDuration(r.total_seconds),
                }))}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-purple-200/90">Themes</h3>
              <DataTable
                empty="No theme events yet."
                columns={[
                  { key: "theme", label: "Theme" },
                  { key: "selections", label: "Switches", align: "right" },
                  { key: "time", label: "Time", align: "right" },
                ]}
                rows={data.themeStats.map((r) => ({
                  theme: r.theme ?? "—",
                  selections: r.selections,
                  time: formatDuration(r.total_seconds),
                }))}
              />
            </div>
          </div>
        </Section>

        {/* Navigation */}
        <Section title="Navigation & movement" description="Sectors, buildings, and heatmap">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-purple-200/90">Time per sector</h3>
              <DataTable
                empty="No sector visits yet."
                columns={[
                  { key: "sector", label: "Sector" },
                  { key: "city", label: "City" },
                  { key: "time", label: "Time", align: "right" },
                ]}
                rows={data.sectorTime.map((r) => ({
                  sector: r.sector_label ?? `Sector ${r.sector_id ?? "?"}`,
                  city: r.city_id ?? "—",
                  time: formatDuration(r.total_seconds),
                }))}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-purple-200/90">Most visited buildings</h3>
              <DataTable
                empty="No building visits yet."
                columns={[
                  { key: "user", label: "GitHub user" },
                  { key: "sector", label: "Sector", align: "right" },
                  { key: "visits", label: "Visits", align: "right" },
                ]}
                rows={data.topBuildings.map((r) => ({
                  user: r.github_username ?? "—",
                  sector: r.sector_id ?? "—",
                  visits: r.visit_count,
                }))}
              />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-purple-200/90">Movement heatmap</h3>
            <HeatmapGrid points={data.heatmap} />
          </div>
        </Section>

        {/* Feature usage & journey */}
        <Section title="Feature usage & journey">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-purple-200/90">Features</h3>
              <DataTable
                empty="No feature events yet."
                columns={[
                  { key: "feature", label: "Feature" },
                  { key: "count", label: "Uses", align: "right" },
                ]}
                rows={data.featureUsage.map((r) => ({
                  feature: r.feature,
                  count: r.usage_count,
                }))}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-purple-200/90">Drop-off points</h3>
              <DataTable
                empty="No session end data yet."
                columns={[
                  { key: "action", label: "Last action" },
                  { key: "count", label: "Sessions", align: "right" },
                ]}
                rows={data.dropOffs.map((r) => ({
                  action: r.last_action,
                  count: r.occurrences,
                }))}
              />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-purple-200/90">First action per session</h3>
            <DataTable
              empty="No journey data yet."
              columns={[
                { key: "user", label: "User" },
                { key: "city", label: "City" },
                { key: "action", label: "First action" },
                { key: "when", label: "Started", align: "right" },
              ]}
              rows={data.userJourney.map((r) => ({
                user: r.username,
                city: r.city_id,
                action: r.first_action,
                when: formatDate(r.started_at),
              }))}
            />
          </div>
        </Section>

        {/* Users & sessions */}
        <Section title="Users & sessions" description="Per-user rollups and recent play sessions">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-purple-200/90">Users</h3>
              <DataTable
                empty="No users tracked yet."
                columns={[
                  { key: "user", label: "Username" },
                  { key: "sessions", label: "Sessions", align: "right" },
                  { key: "avg", label: "Avg time", align: "right" },
                  { key: "min", label: "Min", align: "right" },
                  { key: "max", label: "Max", align: "right" },
                ]}
                rows={data.users.map((u) => ({
                  user: u.username,
                  sessions: u.total_sessions,
                  avg: formatDuration(u.avg_session_seconds),
                  min: formatDuration(u.min_session_seconds),
                  max: formatDuration(u.max_session_seconds),
                }))}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-purple-200/90">Recent sessions</h3>
              <DataTable
                empty="No sessions yet."
                columns={[
                  { key: "user", label: "Username" },
                  { key: "car", label: "Car" },
                  { key: "searches", label: "Searches" },
                  { key: "started", label: "Started", align: "right" },
                  { key: "ended", label: "Ended", align: "right" },
                  { key: "duration", label: "Duration", align: "right" },
                ]}
                rows={data.recentSessions.map((s) => {
                  const searched =
                    s.metadata?.github_users_searched?.join(", ") ||
                    (s.searches > 0 ? `${s.searches} queries` : "—");
                  const car = s.final_vehicle ?? s.initial_vehicle ?? "—";
                  return {
                    user: s.username,
                    car,
                    searches: searched,
                    started: formatDate(s.started_at),
                    ended: s.ended_at ? formatDate(s.ended_at) : "In progress",
                    duration: s.bounced
                      ? `${formatDuration(s.duration_seconds)} (bounce)`
                      : formatDuration(s.duration_seconds),
                  };
                })}
              />
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
