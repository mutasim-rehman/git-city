-- =============================================================================
-- Git City — Session sync + playtime stats (run after client_writes.sql)
-- Adds periodic session checkpoints and min/max playtime dashboard metrics.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Live session checkpoint (called every ~15s while playing)
-- -----------------------------------------------------------------------------
create or replace function public.analytics_sync_session(
  p_session_id uuid,
  p_duration_seconds integer,
  p_distance_traveled double precision,
  p_final_vehicle text,
  p_last_action text,
  p_searches integer,
  p_searches_no_results integer,
  p_searches_converted integer,
  p_github_users_searched jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.analytics_sessions set
    duration_seconds = p_duration_seconds,
    distance_traveled = p_distance_traveled,
    final_vehicle = p_final_vehicle,
    searches = p_searches,
    searches_no_results = p_searches_no_results,
    searches_converted = p_searches_converted,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'last_action', p_last_action,
      'github_users_searched', coalesce(p_github_users_searched, '[]'::jsonb),
      'synced_at', timezone('utc'::text, now())
    )
  where id = p_session_id
    and ended_at is null;
end;
$$;

-- -----------------------------------------------------------------------------
-- End session (extended with vehicle + search rollups)
-- -----------------------------------------------------------------------------
create or replace function public.analytics_end_session(
  p_session_id uuid,
  p_ended_at timestamptz,
  p_duration_seconds integer,
  p_distance_traveled double precision,
  p_bounced boolean,
  p_final_theme text,
  p_final_vehicle text,
  p_last_action text,
  p_searches integer,
  p_searches_no_results integer,
  p_searches_converted integer,
  p_github_users_searched jsonb
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
    final_vehicle = p_final_vehicle,
    searches = p_searches,
    searches_no_results = p_searches_no_results,
    searches_converted = p_searches_converted,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'last_action', p_last_action,
      'github_users_searched', coalesce(p_github_users_searched, '[]'::jsonb),
      'ended_at_client', p_ended_at
    )
  where id = p_session_id;
end;
$$;

grant execute on function public.analytics_sync_session(
  uuid, integer, double precision, text, text, integer, integer, integer, jsonb
) to anon, authenticated;

grant execute on function public.analytics_end_session(
  uuid, timestamptz, integer, double precision, boolean, text, text, text,
  integer, integer, integer, jsonb
) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Dashboard views (DROP required for column changes)
-- -----------------------------------------------------------------------------
drop view if exists public.v_analytics_user_playtime cascade;
drop view if exists public.v_analytics_engagement cascade;

create view public.v_analytics_engagement as
select
  count(*) as total_sessions,
  round(avg(duration_seconds)::numeric, 1) as avg_session_seconds,
  min(duration_seconds) as min_session_seconds,
  max(duration_seconds) as max_session_seconds,
  round(100.0 * count(*) filter (where bounced) / nullif(count(*), 0), 1) as bounce_rate_pct,
  round(avg(distance_traveled)::numeric, 1) as avg_distance_per_session
from public.analytics_sessions
where ended_at is not null;

create view public.v_analytics_user_playtime as
select
  username,
  count(*) as completed_sessions,
  round(avg(duration_seconds)::numeric, 1) as avg_session_seconds,
  min(duration_seconds) as min_session_seconds,
  max(duration_seconds) as max_session_seconds,
  sum(duration_seconds) as total_seconds
from public.analytics_sessions
where ended_at is not null
group by username
order by total_seconds desc nulls last;

revoke all on table public.v_analytics_user_playtime from anon, authenticated;
alter view public.v_analytics_user_playtime set (security_invoker = true);
