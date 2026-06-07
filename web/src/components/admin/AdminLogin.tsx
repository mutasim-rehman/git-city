"use client";

import { useState } from "react";

type Props = {
  onSuccess: () => void;
};

export function AdminLogin({ onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-purple-950/50 to-pink-950/40 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-purple-500/30 bg-black/50 p-8 backdrop-blur-md"
      >
        <p className="text-center text-[10px] font-mono uppercase tracking-[0.4em] text-pink-300/90">
          Git City
        </p>
        <h1 className="mt-2 text-center text-2xl font-semibold text-slate-100">Admin</h1>
        <p className="mt-1 text-center text-sm text-slate-400">User analytics dashboard</p>

        <div className="mt-8 space-y-4">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.25em] text-purple-300/80">
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="mt-1.5 h-10 w-full rounded-xl border border-purple-500/35 bg-black/40 px-3 text-sm text-slate-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
              placeholder="Admin username"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-[0.25em] text-purple-300/80">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1.5 h-10 w-full rounded-xl border border-purple-500/35 bg-black/40 px-3 text-sm text-slate-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
              placeholder="Password"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-pink-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl border border-pink-500/45 bg-pink-500/15 py-2.5 text-sm font-medium text-pink-100 transition hover:bg-pink-500/25 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
