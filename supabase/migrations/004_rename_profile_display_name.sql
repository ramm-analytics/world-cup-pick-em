do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'display_name'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'name'
  ) then
    alter table public.profiles rename column display_name to name;
  elsif not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'name'
  ) then
    alter table public.profiles add column name text not null default 'Manager';
    alter table public.profiles alter column name drop default;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'display_name'
  ) then
    update public.profiles
    set name = coalesce(nullif(name, ''), display_name);

    alter table public.profiles drop column display_name;
  end if;
end;
$$;

alter table public.profiles alter column name set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_username text;
  metadata_name text;
begin
  metadata_username := nullif(trim(new.raw_user_meta_data->>'username'), '');
  metadata_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'display_name'), '')
  );

  insert into public.profiles (id, username, name)
  values (
    new.id,
    metadata_username,
    coalesce(metadata_name, split_part(new.email, '@', 1), 'Manager')
  )
  on conflict (id) do update
    set
      username = coalesce(public.profiles.username, excluded.username),
      name = coalesce(nullif(public.profiles.name, ''), excluded.name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
