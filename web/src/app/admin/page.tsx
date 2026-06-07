"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalyticsDashboard } from "@/lib/admin/types";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

type Phase = "loading" | "login" | "dashboard";

export default function AdminPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.status === 401) {
        setPhase("login");
        setData(null);
        return false;
      }
      if (!res.ok) {
        setError("Failed to load analytics");
        return false;
      }
      const json = (await res.json()) as AnalyticsDashboard;
      setData(json);
      setPhase("dashboard");
      return true;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const sessionRes = await fetch("/api/admin/session");
      const session = await sessionRes.json().catch(() => ({ authenticated: false }));
      if (!session.authenticated) {
        setPhase("login");
        return;
      }
      await loadAnalytics();
    })();
  }, [loadAnalytics]);

  async function handleLoginSuccess() {
    await loadAnalytics();
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setData(null);
    setPhase("login");
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  if (phase === "login") {
    return <AdminLogin onSuccess={handleLoginSuccess} />;
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-4">
        <p className="text-sm text-pink-400">{error ?? "No data"}</p>
        <button
          type="button"
          onClick={() => void loadAnalytics()}
          className="rounded-lg border border-purple-500/35 px-4 py-2 text-sm text-purple-200"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <AdminDashboard
      data={data}
      onLogout={() => void handleLogout()}
      onRefresh={() => void loadAnalytics()}
      refreshing={refreshing}
    />
  );
}
