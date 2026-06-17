-- =============================================================================
-- Git City — Lock down analytics (fix "Unrestricted / publicly available" warning)
-- Run this AFTER creating analytics tables + views.
-- Then run supabase_analytics_client_writes.sql
-- =============================================================================
-- Why Supabase warns:
--   1. Views are exposed to the Data API and bypass table RLS by default.
--   2. Tables in `public` are granted SELECT to `anon` unless you revoke it.
-- Admin dashboard reads via SUPABASE_SERVICE_ROLE_KEY only (server-side).
-- Client app may INSERT/UPDATE tracking rows via anon key.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Revoke read access on analytics TABLES from API roles
-- -----------------------------------------------------------------------------
revoke select on table public.analytics_users from anon, authenticated;
revoke select on table public.analytics_sessions from anon, authenticated;
revoke select on table public.analytics_events from anon, authenticated;

-- Keep write access for the game client (tracking)
grant insert, update on table public.analytics_users to anon, authenticated;
grant insert, update on table public.analytics_sessions to anon, authenticated;
grant insert on table public.analytics_events to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Block ALL API access to analytics VIEWS (admin uses service_role only)
-- -----------------------------------------------------------------------------
revoke all on table public.v_analytics_active_users from anon, authenticated;
revoke all on table public.v_analytics_user_retention from anon, authenticated;
revoke all on table public.v_analytics_engagement from anon, authenticated;
revoke all on table public.v_analytics_top_searches from anon, authenticated;
revoke all on table public.v_analytics_recent_searches from anon, authenticated;
revoke all on table public.v_analytics_vehicle_stats from anon, authenticated;
revoke all on table public.v_analytics_theme_stats from anon, authenticated;
revoke all on table public.v_analytics_sector_time from anon, authenticated;
revoke all on table public.v_analytics_top_buildings from anon, authenticated;
revoke all on table public.v_analytics_heatmap from anon, authenticated;
revoke all on table public.v_analytics_feature_usage from anon, authenticated;
revoke all on table public.v_analytics_user_journey from anon, authenticated;
revoke all on table public.v_analytics_user_playtime from anon, authenticated;
revoke all on table public.v_analytics_drop_offs from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Tighten RLS — explicit deny read, allow only writes from public
-- -----------------------------------------------------------------------------
drop policy if exists "Allow public insert analytics_users" on analytics_users;
drop policy if exists "Allow public update analytics_users" on analytics_users;
drop policy if exists "Allow public insert analytics_sessions" on analytics_sessions;
drop policy if exists "Allow public update analytics_sessions" on analytics_sessions;
drop policy if exists "Allow public insert analytics_events" on analytics_events;

create policy "Allow public insert analytics_users"
  on analytics_users for insert to anon, authenticated
  with check (true);

create policy "Allow public update analytics_users"
  on analytics_users for update to anon, authenticated
  using (true)
  with check (true);

create policy "Allow public insert analytics_sessions"
  on analytics_sessions for insert to anon, authenticated
  with check (true);

create policy "Allow public update analytics_sessions"
  on analytics_sessions for update to anon, authenticated
  using (true)
  with check (true);

create policy "Allow public insert analytics_events"
  on analytics_events for insert to anon, authenticated
  with check (true);

-- No SELECT / DELETE policies → anon cannot read or delete analytics data.

-- -----------------------------------------------------------------------------
-- 4. Recreate views with security_invoker (extra safety if grants change later)
-- -----------------------------------------------------------------------------
alter view public.v_analytics_active_users set (security_invoker = true);
alter view public.v_analytics_user_retention set (security_invoker = true);
alter view public.v_analytics_engagement set (security_invoker = true);
alter view public.v_analytics_top_searches set (security_invoker = true);
alter view public.v_analytics_recent_searches set (security_invoker = true);
alter view public.v_analytics_vehicle_stats set (security_invoker = true);
alter view public.v_analytics_theme_stats set (security_invoker = true);
alter view public.v_analytics_sector_time set (security_invoker = true);
alter view public.v_analytics_top_buildings set (security_invoker = true);
alter view public.v_analytics_heatmap set (security_invoker = true);
alter view public.v_analytics_feature_usage set (security_invoker = true);
alter view public.v_analytics_user_journey set (security_invoker = true);
alter view public.v_analytics_user_playtime set (security_invoker = true);
alter view public.v_analytics_drop_offs set (security_invoker = true);
