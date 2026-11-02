-- OTAKU LEVEL — Fase 2 (rode DEPOIS de supabase/schema.sql)
create table if not exists public.library_entries (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- IDs positivos já gravados vieram do MAL; IDs Kitsu novos usam o negativo do ID Kitsu.
  mal_id integer not null check (mal_id <> 0),
  status text check (status in ('planejado','assistindo','concluido','pausado','abandonado')),
  rating smallint check (rating between 1 and 10),
  is_favorite boolean not null default false,
  -- snapshot só para exibição; a Fase 3 NÃO usará estes campos para calcular XP
  title text not null check (char_length(title) between 1 and 300),
  image_url text check (image_url is null or image_url ~ '^https://(cdn\.myanimelist\.net|media\.kitsu\.(app|io))/'),
  anime_type text check (char_length(anime_type) <= 30),
  episodes integer check (episodes is null or episodes >= 0),
  release_year smallint check (release_year is null or release_year between 1900 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mal_id),
  constraint rating_requires_started
    check (rating is null or coalesce(status in ('assistindo','concluido','pausado','abandonado'), false)),
  constraint entry_not_empty check (status is not null or is_favorite)
);
create index if not exists library_entries_user_updated on public.library_entries (user_id, updated_at desc);

alter table public.library_entries enable row level security;
revoke all on public.library_entries from anon, authenticated;
grant select, delete on public.library_entries to authenticated;
grant insert (mal_id, status, rating, is_favorite, title, image_url, anime_type, episodes, release_year)
  on public.library_entries to authenticated;
grant update (status, rating, is_favorite) on public.library_entries to authenticated;

drop policy if exists lib_select on public.library_entries;
create policy lib_select on public.library_entries for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists lib_insert on public.library_entries;
create policy lib_insert on public.library_entries for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists lib_update on public.library_entries;
create policy lib_update on public.library_entries for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists lib_delete on public.library_entries;
create policy lib_delete on public.library_entries for delete to authenticated using (user_id = (select auth.uid()));

drop trigger if exists library_updated on public.library_entries;
create trigger library_updated before update on public.library_entries
  for each row execute function public.set_updated_at();
