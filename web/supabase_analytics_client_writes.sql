-- =============================================================================
-- Git City — Client write path for analytics (run after schema + lockdown)
-- Fixes: permission denied on upsert/update, FK cascades on failed user rows
-- =============================================================================
-- Direct PostgREST upsert needs SELECT when RLS is enabled (ON CONFLICT DO UPDATE).
-- These SECURITY DEFINER functions keep tables locked down while allowing writes.
-- =============================================================================

-- Ensure table write grants exist (idempotent)
grant insert, update on table public.analytics_users to anon, authenticated;
grant insert, update on table public.analytics_sessions to anon, authenticated;
grant insert on table public.analytics_events to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Upsert user rollup (session start)
-- -----------------------------------------------------------------------------
create or replace function public.analytics_upsert_user(
  p_id uuid,
  p_username text,
  p_city_id text,
  p_first_visit_at timestamptz,
  p_last_active_at timestamptz,
  p_total_sessions integer,
  p_total_time_seconds integer,
  p_total_distance double precision,
  p_search_count integer,
  p_preferred_vehicle text,
  p_preferred_theme text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_users (
    id,
    username,
    city_id,
    first_visit_at,
    last_active_at,
    total_sessions,
    total_time_seconds,
    total_distance,
    search_count,
    preferred_vehicle,
    preferred_theme
  ) values (
    p_id,
    p_username,
    p_city_id,
    coalesce(p_first_visit_at, timezone('utc'::text, now())),
    p_last_active_at,
    p_total_sessions,
    p_total_time_seconds,
    p_total_distance,
    p_search_count,
    p_preferred_vehicle,
    p_preferred_theme
  )
  on conflict (id) do update set
    username = excluded.username,
    city_id = excluded.city_id,
    last_active_at = excluded.last_active_at,
    total_sessions = excluded.total_sessions,
    total_time_seconds = excluded.total_time_seconds,
    total_distance = excluded.total_distance,
    search_count = excluded.search_count,
    preferred_vehicle = excluded.preferred_vehicle,
    preferred_theme = excluded.preferred_theme;
end;
$$;

-- -----------------------------------------------------------------------------
-- Partial user update (touch during session)
-- -----------------------------------------------------------------------------
create or replace function public.analytics_patch_user(
  p_id uuid,
  p_last_active_at timestamptz default null,
  p_search_count integer default null,
  p_preferred_vehicle text default null,
  p_preferred_theme text default null,
  p_total_time_seconds integer default null,
  p_total_distance double precision default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.analytics_users set
    last_active_at = coalesce(p_last_active_at, last_active_at),
    search_count = coalesce(p_search_count, search_count),
    preferred_vehicle = coalesce(p_preferred_vehicle, preferred_vehicle),
    preferred_theme = coalesce(p_preferred_theme, preferred_theme),
    total_time_seconds = coalesce(p_total_time_seconds, total_time_seconds),
    total_distance = coalesce(p_total_distance, total_distance)
  where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- End session row update
-- -----------------------------------------------------------------------------
create or replace function public.analytics_end_session(
  p_session_id uuid,
  p_ended_at timestamptz,
  p_duration_seconds integer,
  p_distance_traveled double precision,
  p_bounced boolean,
  p_final_theme text,
  p_last_action text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.analytics_sessions set
    ended_at = p_ended_at,
    duration_seconds = p_duration_seconds,
    distance_traveled = p_distance_traveled,
    bounced = p_bounced,
    final_theme = p_final_theme,
    metadata = jsonb_build_object('last_action', p_last_action)
  where id = p_session_id;
end;
$$;

grant execute on function public.analytics_upsert_user(
  uuid, text, text, timestamptz, timestamptz, integer, integer, double precision, integer, text, text
) to anon, authenticated;

grant execute on function public.analytics_patch_user(
  uuid, timestamptz, integer, text, text, integer, double precision
) to anon, authenticated;

grant execute on function public.analytics_end_session(
  uuid, timestamptz, integer, double precision, boolean, text, text
) to anon, authenticated;
