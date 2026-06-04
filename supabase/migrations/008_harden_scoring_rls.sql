-- Scoring settings are stored on public.leagues. Existing league RLS already
-- allows members to read their leagues and only owners to update league rows.
-- This migration hardens the scoring result tables and makes the standings view
-- respect the underlying RLS policies.

create or replace function public.is_league_commissioner(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leagues l
    where l.id = target_league_id
      and l.owner_id = auth.uid()
  );
$$;

alter table public.league_score_runs enable row level security;
alter table public.league_score_events enable row level security;

-- Defense in depth: browser roles do not get direct mutation grants on scoring
-- result tables. Service role bypasses RLS and can still recalculate scores.
revoke insert, update, delete on public.league_score_runs from anon, authenticated;
revoke insert, update, delete on public.league_score_events from anon, authenticated;

drop policy if exists "League members can read score runs" on public.league_score_runs;
drop policy if exists "League members can read score events" on public.league_score_events;
drop policy if exists "Commissioners can read score runs" on public.league_score_runs;
drop policy if exists "Commissioners can read score events" on public.league_score_events;

-- League members may read scoring run metadata for leagues they belong to.
create policy "League members can read score runs"
  on public.league_score_runs
  for select
  to authenticated
  using (public.is_league_member(league_id));

-- League members may read scoring event/breakdown rows for leagues they belong to.
create policy "League members can read score events"
  on public.league_score_events
  for select
  to authenticated
  using (public.is_league_member(league_id));

-- Normal authenticated users intentionally receive no insert/update/delete
-- policies for score runs or score events. Recalculation uses the service role.

alter view public.league_scoring_standings set (security_invoker = true);
