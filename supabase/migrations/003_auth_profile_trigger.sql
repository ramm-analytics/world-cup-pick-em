create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_username text;
  metadata_display_name text;
begin
  metadata_username := nullif(trim(new.raw_user_meta_data->>'username'), '');
  metadata_display_name := nullif(trim(new.raw_user_meta_data->>'display_name'), '');

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    metadata_username,
    coalesce(metadata_display_name, split_part(new.email, '@', 1), 'Manager')
  )
  on conflict (id) do update
    set
      username = coalesce(public.profiles.username, excluded.username),
      display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
