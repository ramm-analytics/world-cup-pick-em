create or replace function public.is_league_member(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members lm
    where lm.league_id = target_league_id
      and lm.user_id = auth.uid()
  );
$$;

create or replace function public.is_league_owner(target_league_id uuid)
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

drop policy if exists "League members can read league" on public.leagues;
drop policy if exists "League members are visible to league" on public.league_members;
drop policy if exists "Drafts visible to league members" on public.drafts;
drop policy if exists "League owners can create drafts" on public.drafts;
drop policy if exists "League owners can update drafts" on public.drafts;
drop policy if exists "Draft picks visible to league members" on public.draft_picks;

create policy "League members can read league"
  on public.leagues
  for select
  to authenticated
  using (public.is_league_member(id));

create policy "League members are visible to league"
  on public.league_members
  for select
  to authenticated
  using (public.is_league_member(league_id));

create policy "Drafts visible to league members"
  on public.drafts
  for select
  to authenticated
  using (public.is_league_member(league_id));

create policy "League owners can create drafts"
  on public.drafts
  for insert
  to authenticated
  with check (public.is_league_owner(league_id));

create policy "League owners can update drafts"
  on public.drafts
  for update
  to authenticated
  using (public.is_league_owner(league_id))
  with check (public.is_league_owner(league_id));

create policy "Draft picks visible to league members"
  on public.draft_picks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.drafts d
      where d.id = draft_picks.draft_id
        and public.is_league_member(d.league_id)
    )
  );
