-- =============================================================================
-- Git City — User Analytics Schema
-- Run in Supabase SQL Editor (safe to re-run; uses IF NOT EXISTS / OR REPLACE)
-- Then run supabase_analytics_lockdown.sql
-- Then run supabase_analytics_client_writes.sql
-- =============================================================================
-- Design:
--   analytics_users    → one row per username (rollup / preferences)
--   analytics_sessions → one row per visit/play session
--   analytics_events   → append-only event log (event_type + payload jsonb)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. User rollup
-- -----------------------------------------------------------------------------
create table if not exists public.analytics_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  city_id text,
  first_visit_at timestamptz not null default timezone('utc'::text, now()),
  last_active_at timestamptz not null default timezone('utc'::text, now()),
  total_sessions integer not null default 0,
  total_time_seconds integer not null default 0,
  preferred_vehicle text,
  preferred_theme text,
  theme_switch_count integer not null default 0,
  vehicle_switch_count integer not null default 0,
  language text,
  total_distance double precision not null default 0,
  unique_locations_count integer not null default 0,
  search_count integer not null default 0,
  search_no_results_count integer not null default 0,
  search_converted_count integer not null default 0,
  profile_views integer not null default 0,
  building_interactions integer not null default 0,
  info_panels_opened integer not null default 0,
  external_links_clicked integer not null default 0,
  map_opens integer not null default 0,
  settings_changes integer not null default 0,
  teleport_count integer not null default 0,
  spawn_location text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists idx_analytics_users_username
  on public.analytics_users (lower(username));

create index if not exists idx_analytics_users_last_active
  on public.analytics_users (last_active_at desc);

-- -----------------------------------------------------------------------------
-- 2. Sessions
-- -----------------------------------------------------------------------------
create table if not exists public.analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.analytics_users (id) on delete set null,
  username text not null,
  city_id text not null,
  client_session_id text,
  started_at timestamptz not null default timezone('utc'::text, now()),
  ended_at timestamptz,
  duration_seconds integer,
  initial_vehicle text,
  initial_theme text,
  final_vehicle text,
  final_theme text,
  distance_traveled double precision not null default 0,
  avg_speed double precision,
  theme_changes integer not null default 0,
  vehicle_changes integer not null default 0,
  searches integer not null default 0,
  searches_no_results integer not null default 0,
  searches_converted integer not null default 0,
  sectors_visited integer not null default 0,
  unique_buildings_visited integer not null default 0,
  bounced boolean not null default false,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_analytics_sessions_username
  on public.analytics_sessions (username, started_at desc);

create index if not exists idx_analytics_sessions_started
  on public.analytics_sessions (started_at desc);

create index if not exists idx_analytics_sessions_city
  on public.analytics_sessions (city_id, started_at desc);

-- -----------------------------------------------------------------------------
-- 3. Events (payload jsonb — NOT flat search_term / grid_x columns)
-- -----------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  session_id uuid references public.analytics_sessions (id) on delete cascade,
  username text not null,
  city_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_analytics_events_session
  on public.analytics_events (session_id, created_at);

create index if not exists idx_analytics_events_type_time
  on public.analytics_events (event_type, created_at desc);

create index if not exists idx_analytics_events_username_time
  on public.analytics_events (username, created_at desc);

create index if not exists idx_analytics_events_payload_gin
  on public.analytics_events using gin (payload);

-- -----------------------------------------------------------------------------
-- 4. RLS + policies (tightened further by supabase_analytics_lockdown.sql)
-- -----------------------------------------------------------------------------
alter table public.analytics_users enable row level security;
alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists "Allow public insert analytics_users" on public.analytics_users;
create policy "Allow public insert analytics_users"
  on public.analytics_users for insert to public with check (true);

drop policy if exists "Allow public update analytics_users" on public.analytics_users;
create policy "Allow public update analytics_users"
  on public.analytics_users for update to public using (true);

drop policy if exists "Allow public insert analytics_sessions" on public.analytics_sessions;
create policy "Allow public insert analytics_sessions"
  on public.analytics_sessions for insert to public with check (true);

drop policy if exists "Allow public update analytics_sessions" on public.analytics_sessions;
create policy "Allow public update analytics_sessions"
  on public.analytics_sessions for update to public using (true);

drop policy if exists "Allow public insert analytics_events" on public.analytics_events;
create policy "Allow public insert analytics_events"
  on public.analytics_events for insert to public with check (true);

-- -----------------------------------------------------------------------------
-- 5. updated_at trigger on analytics_users
-- -----------------------------------------------------------------------------
create or replace function public.analytics_users_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_analytics_users_updated_at on public.analytics_users;
create trigger trg_analytics_users_updated_at
  before update on public.analytics_users
  for each row execute function public.analytics_users_set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. Dashboard views
-- (DROP required: CREATE OR REPLACE cannot remove columns from an existing view)
-- -----------------------------------------------------------------------------
drop view if exists public.v_analytics_drop_offs cascade;
drop view if exists public.v_analytics_user_journey cascade;
drop view if exists public.v_analytics_feature_usage cascade;
drop view if exists public.v_analytics_heatmap cascade;
drop view if exists public.v_analytics_top_buildings cascade;
drop view if exists public.v_analytics_sector_time cascade;
drop view if exists public.v_analytics_theme_stats cascade;
drop view if exists public.v_analytics_vehicle_stats cascade;
drop view if exists public.v_analytics_recent_searches cascade;
drop view if exists public.v_analytics_top_searches cascade;
drop view if exists public.v_analytics_engagement cascade;
drop view if exists public.v_analytics_user_retention cascade;
drop view if exists public.v_analytics_active_users cascade;

create view public.v_analytics_active_users as
select
  count(distinct username) filter (where started_at >= now() - interval '1 day') as dau,
  count(distinct username) filter (where started_at >= now() - interval '7 days') as wau,
  count(distinct username) filter (where started_at >= now() - interval '30 days') as mau
from public.analytics_sessions
where ended_at is not null or started_at >= now() - interval '1 day';

create view public.v_analytics_user_retention as
with recent as (
  select distinct username
  from public.analytics_sessions
  where started_at >= now() - interval '30 days'
)
select
  count(*) filter (where u.total_sessions <= 1) as new_users,
  count(*) filter (where u.total_sessions > 1) as returning_users,
  round(
    100.0 * count(*) filter (where u.total_sessions > 1) / nullif(count(*), 0),
    1
  ) as returning_pct
from recent r
join public.analytics_users u on lower(u.username) = lower(r.username);

create view public.v_analytics_engagement as
select
  count(*) as total_sessions,
  round(avg(duration_seconds)::numeric, 1) as avg_session_seconds,
  round(100.0 * count(*) filter (where bounced) / nullif(count(*), 0), 1) as bounce_rate_pct,
  round(avg(distance_traveled)::numeric, 1) as avg_distance_per_session
from public.analytics_sessions
where ended_at is not null;

create view public.v_analytics_top_searches as
select
  payload->>'query' as search_term,
  count(*) as search_count,
  count(*) filter (where event_type = 'search_no_results') as no_results,
  count(*) filter (where event_type = 'search_visit') as converted
from public.analytics_events
where event_type in ('search', 'search_no_results', 'search_visit')
  and coalesce(payload->>'query', '') <> ''
group by 1
order by search_count desc;

create view public.v_analytics_recent_searches as
select
  username,
  city_id,
  payload->>'query' as search_term,
  (payload->>'results_count')::int as results_count,
  (payload->>'converted')::boolean as converted,
  created_at
from public.analytics_events
where event_type = 'search'
order by created_at desc
limit 100;

create view public.v_analytics_vehicle_stats as
select
  coalesce(payload->>'vehicle', payload->>'to') as vehicle,
  count(*) filter (where event_type in ('vehicle_select', 'vehicle_switch')) as selections,
  round(
    coalesce(sum((payload->>'duration_seconds')::numeric) filter (
      where event_type = 'vehicle_switch'
    ), 0)::numeric,
    1
  ) as total_seconds
from public.analytics_events
where event_type in ('vehicle_select', 'vehicle_switch')
group by 1
order by selections desc;

create view public.v_analytics_theme_stats as
select
  coalesce(payload->>'theme', payload->>'to') as theme,
  count(*) filter (where event_type in ('theme_select', 'theme_switch')) as selections,
  round(
    coalesce(sum((payload->>'duration_seconds')::numeric) filter (
      where event_type = 'theme_switch'
    ), 0)::numeric,
    1
  ) as total_seconds
from public.analytics_events
where event_type in ('theme_select', 'theme_switch')
group by 1
order by total_seconds desc nulls last;

create view public.v_analytics_sector_time as
select
  city_id,
  (payload->>'sector_id')::int as sector_id,
  payload->>'sector_label' as sector_label,
  count(*) as visits,
  round(
    coalesce(sum((payload->>'duration_seconds')::numeric), 0)::numeric,
    1
  ) as total_seconds
from public.analytics_events
where event_type = 'sector_enter'
group by 1, 2, 3
order by total_seconds desc nulls last;

create view public.v_analytics_top_buildings as
select
  payload->>'github_username' as github_username,
  (payload->>'sector_id')::int as sector_id,
  count(*) as visit_count
from public.analytics_events
where event_type = 'building_visit'
group by 1, 2
order by visit_count desc;

create view public.v_analytics_heatmap as
select
  city_id,
  round((payload->>'x')::numeric / 50) * 50 as grid_x,
  round((payload->>'z')::numeric / 50) * 50 as grid_z,
  count(*) as sample_count
from public.analytics_events
where event_type = 'position_sample'
  and payload ? 'x'
  and payload ? 'z'
group by 1, 2, 3
order by sample_count desc;

create view public.v_analytics_feature_usage as
select
  coalesce(payload->>'feature', event_type) as feature,
  count(*) as usage_count
from public.analytics_events
where event_type in (
  'profile_view',
  'building_interaction',
  'info_panel_open',
  'external_link_click',
  'map_open',
  'settings_change',
  'search',
  'action'
)
group by 1
order by usage_count desc;

create view public.v_analytics_user_journey as
select
  s.id as session_id,
  s.username,
  s.city_id,
  s.started_at,
  e.event_type as first_action
from public.analytics_sessions s
join lateral (
  select event_type
  from public.analytics_events
  where session_id = s.id
    and event_type not in ('session_start', 'session_heartbeat', 'position_sample')
  order by created_at asc
  limit 1
) e on true;

create view public.v_analytics_drop_offs as
select
  e.event_type as last_action,
  count(*) as occurrences
from public.analytics_sessions s
join lateral (
  select event_type
  from public.analytics_events
  where session_id = s.id
    and event_type not in ('session_end', 'session_heartbeat', 'position_sample')
  order by created_at desc
  limit 1
) e on true
where s.ended_at is not null
group by 1
order by occurrences desc;
