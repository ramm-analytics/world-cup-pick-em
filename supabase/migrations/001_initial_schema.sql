create extension if not exists "pgcrypto";

create type draftable_type as enum ('team', 'player');
create type draft_status as enum ('pending', 'active', 'complete');
create type match_stage as enum ('group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  max_members int not null default 8 check (max_members between 2 and 16),
  roster_team_slots int not null default 2 check (roster_team_slots > 0),
  roster_player_slots int not null default 8 check (roster_player_slots > 0),
  scoring_rules jsonb not null default '{"team_win":3,"team_draw":1,"team_goal":1,"player_goal":4,"player_assist":3,"clean_sheet":2}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  draft_position int,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id),
  unique (league_id, draft_position)
);

create table public.national_teams (
  id uuid primary key default gen_random_uuid(),
  fifa_code text not null unique,
  name text not null,
  confederation text not null,
  group_name text,
  flag_emoji text not null default ''
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.national_teams(id) on delete cascade,
  name text not null,
  position text not null,
  club text,
  projected_points numeric(8,2) not null default 0,
  unique (team_id, name)
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null unique references public.leagues(id) on delete cascade,
  status draft_status not null default 'pending',
  current_pick_number int not null default 1 check (current_pick_number > 0),
  round_count int not null,
  seconds_per_pick int not null default 90,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  pick_number int not null check (pick_number > 0),
  round_number int not null check (round_number > 0),
  draftable_type draftable_type not null,
  national_team_id uuid references public.national_teams(id) on delete restrict,
  player_id uuid references public.players(id) on delete restrict,
  picked_at timestamptz not null default now(),
  unique (draft_id, pick_number),
  unique (draft_id, national_team_id),
  unique (draft_id, player_id),
  check (
    (draftable_type = 'team' and national_team_id is not null and player_id is null)
    or
    (draftable_type = 'player' and player_id is not null and national_team_id is null)
  )
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  stage match_stage not null default 'group',
  home_team_id uuid not null references public.national_teams(id),
  away_team_id uuid not null references public.national_teams(id),
  starts_at timestamptz not null,
  home_score int,
  away_score int,
  is_final boolean not null default false
);

create table public.player_match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  goals int not null default 0,
  assists int not null default 0,
  clean_sheet boolean not null default false,
  minutes int not null default 0,
  unique (match_id, player_id)
);

create view public.league_standings as
with team_points as (
  select
    dp.league_member_id,
    coalesce(sum(
      case
        when m.is_final = false then 0
        when dp.national_team_id = m.home_team_id and m.home_score > m.away_score then ((l.scoring_rules->>'team_win')::int)
        when dp.national_team_id = m.away_team_id and m.away_score > m.home_score then ((l.scoring_rules->>'team_win')::int)
        when m.home_score = m.away_score then ((l.scoring_rules->>'team_draw')::int)
        else 0
      end
      + case
        when m.is_final = false then 0
        when dp.national_team_id = m.home_team_id then m.home_score * ((l.scoring_rules->>'team_goal')::int)
        when dp.national_team_id = m.away_team_id then m.away_score * ((l.scoring_rules->>'team_goal')::int)
        else 0
      end
    ), 0) as points
  from public.draft_picks dp
  join public.drafts d on d.id = dp.draft_id
  join public.leagues l on l.id = d.league_id
  left join public.matches m on dp.national_team_id in (m.home_team_id, m.away_team_id)
  where dp.draftable_type = 'team'
  group by dp.league_member_id
),
player_points as (
  select
    dp.league_member_id,
    coalesce(sum(
      pms.goals * ((l.scoring_rules->>'player_goal')::int)
      + pms.assists * ((l.scoring_rules->>'player_assist')::int)
      + case when pms.clean_sheet then ((l.scoring_rules->>'clean_sheet')::int) else 0 end
    ), 0) as points
  from public.draft_picks dp
  join public.drafts d on d.id = dp.draft_id
  join public.leagues l on l.id = d.league_id
  left join public.player_match_stats pms on pms.player_id = dp.player_id
  where dp.draftable_type = 'player'
  group by dp.league_member_id
)
select
  lm.league_id,
  lm.id as league_member_id,
  lm.display_name,
  coalesce(tp.points, 0) + coalesce(pp.points, 0) as total_points,
  coalesce(tp.points, 0) as team_points,
  coalesce(pp.points, 0) as player_points,
  rank() over (partition by lm.league_id order by coalesce(tp.points, 0) + coalesce(pp.points, 0) desc) as rank
from public.league_members lm
left join team_points tp on tp.league_member_id = lm.id
left join player_points pp on pp.league_member_id = lm.id;

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.drafts enable row level security;
alter table public.draft_picks enable row level security;
alter table public.national_teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.player_match_stats enable row level security;

create policy "Public draft pool is readable" on public.national_teams for select using (true);
create policy "Public players are readable" on public.players for select using (true);
create policy "Match data is readable" on public.matches for select using (true);
create policy "Player stats are readable" on public.player_match_stats for select using (true);

create policy "Profiles can be read by authenticated users" on public.profiles for select to authenticated using (true);
create policy "Users can maintain own profile" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "League members can read league" on public.leagues for select to authenticated using (
  exists (select 1 from public.league_members lm where lm.league_id = id and lm.user_id = auth.uid())
);
create policy "Authenticated users can find leagues by invite" on public.leagues for select to authenticated using (true);
create policy "Users can create leagues" on public.leagues for insert to authenticated with check (owner_id = auth.uid());
create policy "Owners can update leagues" on public.leagues for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "League members are visible to league" on public.league_members for select to authenticated using (
  exists (select 1 from public.league_members lm where lm.league_id = league_members.league_id and lm.user_id = auth.uid())
);
create policy "Users can join as themselves" on public.league_members for insert to authenticated with check (user_id = auth.uid());

create policy "Drafts visible to league members" on public.drafts for select to authenticated using (
  exists (
    select 1 from public.league_members lm
    where lm.league_id = drafts.league_id and lm.user_id = auth.uid()
  )
);
create policy "League owners can create drafts" on public.drafts for insert to authenticated with check (
  exists (
    select 1 from public.leagues l
    where l.id = drafts.league_id and l.owner_id = auth.uid()
  )
);
create policy "League owners can update drafts" on public.drafts for update to authenticated using (
  exists (
    select 1 from public.leagues l
    where l.id = drafts.league_id and l.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.leagues l
    where l.id = drafts.league_id and l.owner_id = auth.uid()
  )
);
create policy "Draft picks visible to league members" on public.draft_picks for select to authenticated using (
  exists (
    select 1 from public.drafts d
    join public.league_members lm on lm.league_id = d.league_id
    where d.id = draft_picks.draft_id and lm.user_id = auth.uid()
  )
);

alter publication supabase_realtime add table public.drafts, public.draft_picks;
