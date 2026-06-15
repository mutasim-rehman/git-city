-- =============================================================================
-- Git City — Analytics tables + dashboard views
-- Run in Supabase SQL editor BEFORE supabase_analytics_lockdown.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table if not exists public.analytics_users (
  id uuid primary key,
  username text not null,
  city_id text,
  first_visit_at timestamptz not null default timezone('utc'::text, now()),
  last_active_at timestamptz not null default timezone('utc'::text, now()),
  total_sessions integer not null default 0,
  total_time_seconds integer not null default 0,
  preferred_vehicle text,
  preferred_theme text,
  search_count integer not null default 0,
  total_distance double precision not null default 0
);

create index if not exists idx_analytics_users_last_active on public.analytics_users (last_active_at desc);
create index if not exists idx_analytics_users_username on public.analytics_users (username);

create table if not exists public.analytics_sessions (
  id uuid primary key,
  username text not null,
  city_id text not null,
  started_at timestamptz not null default timezone('utc'::text, now()),
  ended_at timestamptz,
  duration_seconds integer,
  distance_traveled double precision not null default 0,
  bounced boolean not null default false,
  initial_vehicle text,
  initial_theme text,
  last_action text
);

create index if not exists idx_analytics_sessions_started on public.analytics_sessions (started_at desc);
create index if not exists idx_analytics_sessions_username on public.analytics_sessions (username);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.analytics_sessions (id) on delete cascade,
  username text not null,
  city_id text,
  event_type text not null,
  search_term text,
  results_count integer,
  converted boolean,
  vehicle text,
  theme text,
  sector_id integer,
  sector_label text,
  github_username text,
  grid_x integer,
  grid_z integer,
  feature text,
  duration_seconds integer,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_analytics_events_type on public.analytics_events (event_type);
create index if not exists idx_analytics_events_session on public.analytics_events (session_id, created_at);
create index if not exists idx_analytics_events_created on public.analytics_events (created_at desc);

alter table public.analytics_users enable row level security;
alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;

-- -----------------------------------------------------------------------------
-- Views (consumed by admin dashboard via service role)
-- -----------------------------------------------------------------------------
create or replace view public.v_analytics_active_users as
select
  count(*) filter (where last_active_at >= timezone('utc'::text, now()) - interval '1 day') as dau,
  count(*) filter (where last_active_at >= timezone('utc'::text, now()) - interval '7 days') as wau,
  count(*) filter (where last_active_at >= timezone('utc'::text, now()) - interval '30 days') as mau
from public.analytics_users;

create or replace view public.v_analytics_user_retention as
select
  count(*) filter (where total_sessions <= 1) as new_users,
  count(*) filter (where total_sessions > 1) as returning_users,
  round(
    100.0 * count(*) filter (where total_sessions > 1) / nullif(count(*), 0),
    1
  ) as returning_pct
from public.analytics_users;

create or replace view public.v_analytics_engagement as
select
  count(*) as total_sessions,
  round(avg(duration_seconds)::numeric, 1) as avg_session_seconds,
  round(
    100.0 * count(*) filter (where bounced) / nullif(count(*) filter (where ended_at is not null), 0),
    1
  ) as bounce_rate_pct,
  round(avg(distance_traveled)::numeric, 1) as avg_distance_per_session
from public.analytics_sessions
where ended_at is not null;

create or replace view public.v_analytics_top_searches as
select
  search_term,
  count(*) as search_count,
  count(*) filter (where coalesce(results_count, 0) = 0) as no_results,
  count(*) filter (where converted is true) as converted
from public.analytics_events
where event_type = 'search' and search_term is not null
group by search_term
order by search_count desc;

create or replace view public.v_analytics_recent_searches as
select
  username,
  city_id,
  search_term,
  results_count,
  converted,
  created_at
from public.analytics_events
where event_type = 'search'
order by created_at desc;

create or replace view public.v_analytics_vehicle_stats as
select
  vehicle,
  count(*) as selections,
  sum(coalesce(duration_seconds, 0)) as total_seconds
from public.analytics_events
where event_type in ('vehicle_select', 'session_start') and vehicle is not null
group by vehicle
order by selections desc;

create or replace view public.v_analytics_theme_stats as
select
  theme,
  count(*) as selections,
  sum(coalesce(duration_seconds, 0)) as total_seconds
from public.analytics_events
where event_type in ('theme_change', 'session_start') and theme is not null
group by theme
order by selections desc;

create or replace view public.v_analytics_sector_time as
select
  city_id,
  sector_id,
  sector_label,
  count(*) as visits,
  sum(coalesce(duration_seconds, 0)) as total_seconds
from public.analytics_events
where event_type = 'sector_time'
group by city_id, sector_id, sector_label
order by total_seconds desc nulls last;

create or replace view public.v_analytics_top_buildings as
select
  github_username,
  sector_id,
  count(*) as visit_count
from public.analytics_events
where event_type = 'building_visit' and github_username is not null
group by github_username, sector_id
order by visit_count desc;

create or replace view public.v_analytics_heatmap as
select
  city_id,
  grid_x,
  grid_z,
  count(*) as sample_count
from public.analytics_events
where event_type = 'position' and grid_x is not null and grid_z is not null
group by city_id, grid_x, grid_z
order by sample_count desc;

create or replace view public.v_analytics_feature_usage as
select
  feature,
  count(*) as usage_count
from public.analytics_events
where event_type = 'feature' and feature is not null
group by feature
order by usage_count desc;

create or replace view public.v_analytics_drop_offs as
select
  last_action,
  count(*) as occurrences
from public.analytics_sessions
where ended_at is not null and last_action is not null
group by last_action
order by occurrences desc;

create or replace view public.v_analytics_user_journey as
select
  s.id as session_id,
  s.username,
  s.city_id,
  s.started_at,
  coalesce(
    (
      select e.feature
      from public.analytics_events e
      where e.session_id = s.id and e.feature is not null
      order by e.created_at asc
      limit 1
    ),
    s.last_action,
    'session_start'
  ) as first_action
from public.analytics_sessions s
order by s.started_at desc;

-- Default permissive policies (tightened by supabase_analytics_lockdown.sql)
drop policy if exists "Allow public insert analytics_users" on public.analytics_users;
drop policy if exists "Allow public update analytics_users" on public.analytics_users;
drop policy if exists "Allow public insert analytics_sessions" on public.analytics_sessions;
drop policy if exists "Allow public update analytics_sessions" on public.analytics_sessions;
drop policy if exists "Allow public insert analytics_events" on public.analytics_events;

create policy "Allow public insert analytics_users"
  on public.analytics_users for insert to anon, authenticated
  with check (true);

create policy "Allow public update analytics_users"
  on public.analytics_users for update to anon, authenticated
  using (true)
  with check (true);

create policy "Allow public insert analytics_sessions"
  on public.analytics_sessions for insert to anon, authenticated
  with check (true);

create policy "Allow public update analytics_sessions"
  on public.analytics_sessions for update to anon, authenticated
  using (true)
  with check (true);

create policy "Allow public insert analytics_events"
  on public.analytics_events for insert to anon, authenticated
  with check (true);
