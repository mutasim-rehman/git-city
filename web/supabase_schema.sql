-- SQL Schema for Git City Supabase Backend

-- 1. Create table for Git City user data (migrated from CSVs)
-- CSV column mapping:
--   Username            -> username
--   Profile URL         -> profile_url
--   GitHub ID           -> github_id
--   Year_Group          -> year_group
--   Public_Repositories -> public_repositories
--   Lifetime_Commits    -> lifetime_commits
--   Followers           -> followers
--   Total_Stars         -> total_stars
--   Repo_Names          -> repo_names
--   Repo_Metadata       -> repo_metadata
--   Field               -> field
create table if not exists github_users (
  id bigint generated always as identity primary key,
  username text not null,
  profile_url text not null,
  github_id bigint not null,
  year_group text,
  public_repositories integer not null default 0,
  lifetime_commits integer not null default 0,
  followers integer not null default 0,
  total_stars integer not null default 0,
  repo_names text not null default '',
  repo_metadata jsonb not null default '[]'::jsonb,
  field text,
  sector_id text,
  sector_label text,
  city_id text not null, -- 'lahore', 'karachi', 'islamabad'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add new CSV columns when upgrading an existing github_users table
alter table github_users add column if not exists followers integer not null default 0;
alter table github_users add column if not exists total_stars integer not null default 0;
alter table github_users add column if not exists repo_names text not null default '';
alter table github_users add column if not exists repo_metadata jsonb not null default '[]'::jsonb;
alter table github_users add column if not exists field text;

-- Unique index to prevent duplicate entries for a user in a specific city
create unique index if not exists idx_github_users_city_username on github_users(city_id, username);

-- Performance indices
create index if not exists idx_github_users_city_id on github_users(city_id);

-- Enable RLS (Row Level Security)
alter table github_users enable row level security;

-- Policy: Allow public read access to github_users
drop policy if exists "Allow public read access to github_users" on github_users;
create policy "Allow public read access to github_users"
on github_users for select
to public
using (true);


-- 2. Create table for tracking active players
create table if not exists players (
  id text primary key, -- client session ID (generated client-side)
  username text not null,
  x double precision not null default 0,
  y double precision not null default 0,
  z double precision not null default 0,
  rotation double precision not null default 0, -- yaw rotation
  city_id text not null,
  last_seen timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for players
alter table players enable row level security;

-- Policy: Allow public read access to players
drop policy if exists "Allow public read access to players" on players;
create policy "Allow public read access to players"
on players for select
to public
using (true);

-- Policy: Allow anyone to insert their player record
drop policy if exists "Allow public insert to players" on players;
create policy "Allow public insert to players"
on players for insert
to public
with check (true);

-- Policy: Allow anyone to update their own player record
drop policy if exists "Allow public update to players" on players;
create policy "Allow public update to players"
on players for update
to public
using (true);

-- Policy: Allow anyone to delete their player record when they leave
drop policy if exists "Allow public delete to players" on players;
create policy "Allow public delete to players"
on players for delete
to public
using (true);
