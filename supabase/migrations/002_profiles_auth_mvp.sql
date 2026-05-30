alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_key
  on public.profiles (username)
  where username is not null;

drop policy if exists "Profiles can be read by authenticated users" on public.profiles;
drop policy if exists "Users can maintain own profile" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
