alter table public.national_teams
  add column if not exists external_source text,
  add column if not exists external_id text,
  add column if not exists logo_url text;

alter table public.players
  add column if not exists external_source text,
  add column if not exists external_id text,
  add column if not exists photo_url text;

alter table public.matches
  add column if not exists external_source text,
  add column if not exists external_id text,
  add column if not exists match_number int,
  add column if not exists status text,
  add column if not exists venue text;

alter table public.player_match_stats
  add column if not exists external_source text,
  add column if not exists external_id text;

create unique index if not exists national_teams_external_source_id_key
  on public.national_teams (external_source, external_id);

create unique index if not exists players_external_source_id_key
  on public.players (external_source, external_id);

create unique index if not exists matches_external_source_id_key
  on public.matches (external_source, external_id);

create unique index if not exists player_match_stats_external_source_id_key
  on public.player_match_stats (external_source, external_id);

create table if not exists public.data_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  mode text not null,
  status text not null check (status in ('running', 'success', 'partial', 'skipped', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  counts jsonb not null default '{}'::jsonb,
  error text
);

alter table public.data_sync_runs enable row level security;
