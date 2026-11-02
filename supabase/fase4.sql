-- OTAKU LEVEL — Fase 4: perfil público, avatar/banner (Storage), privacidade e rankings.
-- Rode DEPOIS de schema.sql, fase2.sql e fase3.sql. Idempotente.

-- ---------- privacidade ----------
alter table public.profiles
  add column if not exists show_in_ranking boolean not null default true,
  add column if not exists show_stats boolean not null default true,
  add column if not exists show_achievements boolean not null default true;
-- is_public = false esconde o perfil e também tira o usuário dos rankings.

-- avatar_url/banner_url só aceitam arquivos do Storage do projeto, dentro da pasta do próprio usuário.
alter table public.profiles drop constraint if exists profiles_avatar_url_fmt;
alter table public.profiles add constraint profiles_avatar_url_fmt check (avatar_url is null or avatar_url ~
  ('^https://[a-z0-9]{10,40}\.supabase\.co/storage/v1/object/public/avatars/' || id::text || '/[A-Za-z0-9._-]{1,100}$'));
alter table public.profiles drop constraint if exists profiles_banner_url_fmt;
alter table public.profiles add constraint profiles_banner_url_fmt check (banner_url is null or banner_url ~
  ('^https://[a-z0-9]{10,40}\.supabase\.co/storage/v1/object/public/banners/' || id::text || '/[A-Za-z0-9._-]{1,100}$'));

grant update (avatar_url, banner_url, show_in_ranking, show_stats, show_achievements) on public.profiles to authenticated;
create index if not exists xp_events_created on public.xp_events (created_at);

-- ---------- Storage: buckets e políticas ----------
-- Leitura pública por URL (nomes aleatórios, não listáveis); escrita só na própria pasta <uid>/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 1048576, array['image/jpeg','image/png','image/webp']),
  ('banners', 'banners', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists otaku_img_select on storage.objects;
create policy otaku_img_select on storage.objects for select to authenticated
  using (bucket_id in ('avatars','banners') and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists otaku_img_insert on storage.objects;
create policy otaku_img_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars','banners') and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists otaku_img_update on storage.objects;
create policy otaku_img_update on storage.objects for update to authenticated
  using (bucket_id in ('avatars','banners') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('avatars','banners') and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists otaku_img_delete on storage.objects;
create policy otaku_img_delete on storage.objects for delete to authenticated
  using (bucket_id in ('avatars','banners') and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- ranking (privado) ----------
-- geral = xp_total; semanal/mensal = XP dos eventos desde segunda-feira / dia 1 (America/Sao_Paulo).
-- Só entram perfis públicos com show_in_ranking e pontuação > 0.
create or replace function private.ranking(p_period text)
returns table (pos integer, user_id uuid, username text, display_name text, avatar_url text,
               level integer, xp integer, is_me boolean)
language sql stable security definer set search_path = '' as $$
  with cfg as (
    select case p_period
             when 'semanal' then date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
             when 'mensal' then date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
           end as since
     where p_period in ('geral', 'semanal', 'mensal')
  ), scores as (
    select p.id, p.username, p.display_name, p.avatar_url, coalesce(s.level, 1) as lvl,
           case when cfg.since is null then coalesce(s.xp_total, 0) else coalesce(w.xp, 0) end as pts
      from public.profiles p
      cross join cfg
      left join public.user_stats s on s.user_id = p.id
      left join (select e.user_id, sum(e.xp)::integer as xp from public.xp_events e, cfg c2
                  where e.created_at >= c2.since group by e.user_id) w on w.user_id = p.id
     where p.is_public and p.show_in_ranking
  )
  select (rank() over (order by sc.pts desc))::integer, sc.id, sc.username, sc.display_name,
         sc.avatar_url, sc.lvl, sc.pts, sc.id = auth.uid()
    from scores sc where sc.pts > 0;
$$;

-- ---------- RPCs para o cliente ----------
create or replace function public.get_ranking(p_period text, p_limit integer default 50)
returns table (pos integer, username text, display_name text, avatar_url text, level integer, xp integer, is_me boolean)
language sql stable security definer set search_path = '' as $$
  select r.pos, r.username, r.display_name, r.avatar_url, r.level, r.xp, r.is_me
    from private.ranking(p_period) r
   order by r.pos, r.username
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function public.my_rank(p_period text) returns table (pos integer, xp integer)
language sql stable security definer set search_path = '' as $$
  select r.pos, r.xp from private.ranking(p_period) r where r.is_me;
$$;

-- Perfil de qualquer usuário: só se público (ou se for o próprio). Estatísticas respeitam show_stats.
create or replace function public.get_public_profile(p_username text)
returns table (username text, display_name text, bio text, avatar_url text, banner_url text, created_at timestamptz,
               is_self boolean, show_stats boolean, show_achievements boolean,
               level integer, xp_total integer, title_name text,
               n_added integer, n_completed integer, n_favorites integer, avg_rating numeric)
language sql stable security definer set search_path = '' as $$
  with v as (
    select p.*, (p.id = auth.uid()) as self, (p.show_stats or p.id = auth.uid()) as see
      from public.profiles p
     where lower(p.username) = lower(p_username) and (p.is_public or p.id = auth.uid())
  )
  select v.username, v.display_name, v.bio, v.avatar_url, v.banner_url, v.created_at,
         v.self, v.show_stats, v.show_achievements,
         case when v.see then coalesce(s.level, 1) end,
         case when v.see then coalesce(s.xp_total, 0) end,
         case when v.see then coalesce(t.name, (select t2.name from public.titles t2
                              where t2.req_level <= coalesce(s.level, 1) order by t2.req_level desc limit 1)) end,
         case when v.see then (select count(*)::integer from public.library_entries le where le.user_id = v.id and le.status is not null) end,
         case when v.see then (select count(*)::integer from public.library_entries le where le.user_id = v.id and le.status = 'concluido') end,
         case when v.see then (select count(*)::integer from public.library_entries le where le.user_id = v.id and le.is_favorite) end,
         case when v.see then (select round(avg(le.rating)::numeric, 1) from public.library_entries le where le.user_id = v.id and le.rating is not null) end
    from v
    left join public.user_stats s on s.user_id = v.id
    left join public.titles t on t.code = s.title_code;
$$;

create or replace function public.public_achievements(p_username text)
returns table (name text, description text, rarity text, icon text, unlocked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.name, a.description, a.rarity, a.icon, ua.unlocked_at
    from public.profiles p
    join public.user_achievements ua on ua.user_id = p.id
    join public.achievements a on a.code = ua.code
   where lower(p.username) = lower(p_username)
     and (p.id = auth.uid() or (p.is_public and p.show_achievements))
   order by array_position(array['lendaria','epica','rara','comum'], a.rarity), ua.unlocked_at;
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.get_ranking(text, integer), public.my_rank(text),
  public.get_public_profile(text), public.public_achievements(text) from public, anon;
grant execute on function public.get_ranking(text, integer), public.my_rank(text),
  public.get_public_profile(text), public.public_achievements(text) to authenticated;
