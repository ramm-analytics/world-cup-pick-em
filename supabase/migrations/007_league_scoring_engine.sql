create type league_scoring_mode as enum ('team_pickem', 'player_pickem', 'combo');

alter table public.leagues
  add column if not exists scoring_mode league_scoring_mode not null default 'combo';

alter table public.matches
  add column if not exists winner_team_id uuid references public.national_teams(id);

create table public.league_score_runs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  status text not null check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);

create table public.league_score_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  draft_pick_id uuid references public.draft_picks(id) on delete cascade,
  source_type text not null check (source_type in ('team_match', 'player_match')),
  source_id uuid not null,
  category text not null,
  points numeric(8,2) not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (league_id, league_member_id, draft_pick_id, source_type, source_id, category)
);

create index league_score_events_league_member_idx
  on public.league_score_events (league_id, league_member_id);

create view public.league_scoring_standings as
select
  lm.league_id,
  lm.id as league_member_id,
  lm.display_name,
  coalesce(sum(lse.points), 0) as total_points,
  coalesce(sum(lse.points) filter (where lse.source_type = 'team_match'), 0) as team_points,
  coalesce(sum(lse.points) filter (where lse.source_type = 'player_match'), 0) as player_points,
  rank() over (
    partition by lm.league_id
    order by coalesce(sum(lse.points), 0) desc
  ) as rank
from public.league_members lm
left join public.league_score_events lse on lse.league_member_id = lm.id
group by lm.league_id, lm.id, lm.display_name;
