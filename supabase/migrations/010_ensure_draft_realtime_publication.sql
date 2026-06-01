do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'drafts'
  ) then
    alter publication supabase_realtime add table public.drafts;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'draft_picks'
  ) then
    alter publication supabase_realtime add table public.draft_picks;
  end if;
end;
$$;
