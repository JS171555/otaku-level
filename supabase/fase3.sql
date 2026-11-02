-- OTAKU LEVEL — Fase 3: XP, níveis, conquistas e títulos calculados no banco.
-- Rode DEPOIS de schema.sql e fase2.sql. É idempotente (pode rodar de novo).
-- O cliente NÃO tem permissão de escrita em nenhuma tabela de XP: tudo é gravado
-- por triggers/funções SECURITY DEFINER no schema privado.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- catálogos ----------
create table if not exists public.achievements (
  code text primary key,
  name text not null,
  description text not null,
  rarity text not null check (rarity in ('comum','rara','epica','lendaria')),
  is_secret boolean not null default false,
  xp_reward integer not null check (xp_reward >= 0),
  icon text not null default 'fa-trophy',
  metric text not null check (metric in ('added','completed','favorites','ratings','level',
    'night_completes','harsh_ratings','perfect_ratings','abandoned','distinct_statuses')),
  threshold integer not null check (threshold > 0)
);

create table if not exists public.titles (
  code text primary key,
  name text not null,
  req_level integer check (req_level > 0),
  req_achievement text references public.achievements(code),
  check ((req_level is not null) <> (req_achievement is not null))
);

-- ---------- estado do usuário ----------
create table if not exists public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp_total integer not null default 0 check (xp_total >= 0),
  level integer not null default 1 check (level >= 1),
  title_code text references public.titles(code),
  updated_at timestamptz not null default now()
);

-- Livro-razão imutável. unique(user_id, source_key) impede XP duplicado.
create table if not exists public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  source_key text not null,
  xp integer not null check (xp > 0),
  detail text check (char_length(detail) <= 100),
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);
create index if not exists xp_events_user_time on public.xp_events (user_id, created_at desc);

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null references public.achievements(code),
  unlocked_at timestamptz not null default now(),
  notified boolean not null default false,
  primary key (user_id, code)
);

-- ---------- RLS: cliente só LÊ os próprios dados ----------
alter table public.achievements enable row level security;
alter table public.titles enable row level security;
alter table public.user_stats enable row level security;
alter table public.xp_events enable row level security;
alter table public.user_achievements enable row level security;
revoke all on public.achievements, public.titles, public.user_stats, public.xp_events, public.user_achievements
  from anon, authenticated;
grant select on public.user_stats, public.xp_events, public.user_achievements to authenticated;

drop policy if exists stats_select on public.user_stats;
create policy stats_select on public.user_stats for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists xp_select on public.xp_events;
create policy xp_select on public.xp_events for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists ua_select on public.user_achievements;
create policy ua_select on public.user_achievements for select to authenticated using (user_id = (select auth.uid()));
-- achievements/titles: sem policy = sem acesso direto (segredos só via RPC com máscara).

-- ---------- catálogo inicial (ajustável: rode de novo para atualizar) ----------
insert into public.achievements (code,name,description,rarity,is_secret,xp_reward,icon,metric,threshold) values
 ('primeiro_passo','Primeiro Passo','Adicione seu primeiro anime à biblioteca.','comum',false,10,'fa-shoe-prints','added',1),
 ('fim_da_jornada','Fim da Jornada','Conclua seu primeiro anime.','comum',false,20,'fa-flag-checkered','completed',1),
 ('critico_de_primeira','Crítico de Primeira','Dê sua primeira nota.','comum',false,10,'fa-star','ratings',1),
 ('coracao_otaku','Coração Otaku','Favorite seu primeiro anime.','comum',false,10,'fa-heart','favorites',1),
 ('estante_cheia','Estante Cheia','Tenha 10 animes na biblioteca.','rara',false,50,'fa-book','added',10),
 ('veterano','Veterano','Conclua 10 animes.','rara',false,100,'fa-medal','completed',10),
 ('critico_assiduo','Crítico Assíduo','Avalie 10 animes.','rara',false,60,'fa-pen','ratings',10),
 ('nivel_5','Nível 5','Alcance o nível 5.','rara',false,75,'fa-arrow-up','level',5),
 ('biblioteca_gigante','Biblioteca Gigante','Tenha 50 animes na biblioteca.','epica',false,150,'fa-layer-group','added',50),
 ('maratonista','Maratonista','Conclua 30 animes.','epica',false,250,'fa-fire','completed',30),
 ('nivel_10','Nível 10','Alcance o nível 10.','epica',false,200,'fa-bolt','level',10),
 ('colecionador','Colecionador de Corações','Favorite 25 animes.','epica',false,150,'fa-gem','favorites',25),
 ('lenda_dos_animes','Lenda dos Animes','Conclua 100 animes.','lendaria',false,500,'fa-crown','completed',100),
 ('nivel_20','Nível 20','Alcance o nível 20.','lendaria',false,500,'fa-dragon','level',20),
 ('acervo_infinito','Acervo Infinito','Tenha 200 animes na biblioteca.','lendaria',false,500,'fa-infinity','added',200),
 ('coruja_otaku','Coruja Otaku','Conclua um anime de madrugada (0h às 5h).','rara',true,75,'fa-moon','night_completes',1),
 ('sem_remorso','Sem Remorso','Abandone 5 animes.','rara',true,50,'fa-door-open','abandoned',5),
 ('critico_implacavel','Crítico Implacável','Dê 5 notas iguais ou menores que 3.','epica',true,100,'fa-skull','harsh_ratings',5),
 ('nota_maxima','Nota Máxima','Dê dez notas 10.','epica',true,100,'fa-award','perfect_ratings',10),
 ('colecionador_de_estados','Colecionador de Estados','Use os cinco estados da biblioteca.','epica',true,100,'fa-shapes','distinct_statuses',5),
 ('lenda_oculta','Lenda Oculta','Alcance o nível 30.','lendaria',true,1000,'fa-ghost','level',30)
on conflict (code) do update set name=excluded.name, description=excluded.description, rarity=excluded.rarity,
  is_secret=excluded.is_secret, xp_reward=excluded.xp_reward, icon=excluded.icon, metric=excluded.metric, threshold=excluded.threshold;

insert into public.titles (code,name,req_level,req_achievement) values
 ('novato','Novato',1,null),('aprendiz','Aprendiz',3,null),('otaku','Otaku',5,null),
 ('veterano','Veterano',10,null),('sensei','Sensei',15,null),('lenda','Lenda',20,null),
 ('ach_coruja','Coruja da Madrugada',null,'coruja_otaku'),
 ('ach_implacavel','O Implacável',null,'critico_implacavel'),
 ('ach_maratonista','Maratonista',null,'maratonista'),
 ('ach_lenda','Lenda Viva',null,'lenda_dos_animes')
on conflict (code) do update set name=excluded.name, req_level=excluded.req_level, req_achievement=excluded.req_achievement;

-- ---------- núcleo (privado) ----------
create or replace function private.level_for_xp(p_xp integer) returns integer
language sql immutable set search_path = '' as $$
  select floor(sqrt(greatest(p_xp, 0) / 50.0))::integer + 1;   -- nível n começa em 50*(n-1)² XP
$$;

create or replace function private.metric_value(p_user uuid, p_metric text) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare v integer;
begin
  v := case p_metric
    when 'added' then (select count(*) from public.library_entries where user_id = p_user and status is not null)
    when 'completed' then (select count(*) from public.library_entries where user_id = p_user and status = 'concluido')
    when 'favorites' then (select count(*) from public.library_entries where user_id = p_user and is_favorite)
    when 'ratings' then (select count(*) from public.library_entries where user_id = p_user and rating is not null)
    when 'harsh_ratings' then (select count(*) from public.library_entries where user_id = p_user and rating <= 3)
    when 'perfect_ratings' then (select count(*) from public.library_entries where user_id = p_user and rating = 10)
    when 'abandoned' then (select count(*) from public.library_entries where user_id = p_user and status = 'abandonado')
    when 'distinct_statuses' then (select count(distinct status) from public.library_entries where user_id = p_user)
    when 'level' then (select level from public.user_stats where user_id = p_user)
    when 'night_completes' then (select count(*) from public.xp_events where user_id = p_user and action = 'completar'
        and extract(hour from created_at at time zone 'America/Sao_Paulo') < 5)
  end;
  return coalesce(v, 0);
end $$;

create or replace function private.grant_xp(p_user uuid, p_action text, p_key text, p_xp integer,
  p_capped boolean, p_detail text, p_at timestamptz) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_cap constant integer := 500;     -- teto diário de XP por ações (conquistas não contam)
  v_today integer; v_give integer; v_total integer;
begin
  insert into public.user_stats (user_id) values (p_user) on conflict do nothing;
  perform 1 from public.user_stats where user_id = p_user for update;   -- serializa por usuário
  if exists (select 1 from public.xp_events where user_id = p_user and source_key = p_key) then return 0; end if;
  v_give := p_xp;
  if p_capped then
    select coalesce(sum(xp), 0) into v_today from public.xp_events
     where user_id = p_user and action <> 'conquista'
       and (created_at at time zone 'America/Sao_Paulo')::date = (p_at at time zone 'America/Sao_Paulo')::date;
    v_give := least(p_xp, v_cap - v_today);
    if v_give <= 0 then return 0; end if;
  end if;
  insert into public.xp_events (user_id, action, source_key, xp, detail, created_at)
    values (p_user, p_action, p_key, v_give, left(p_detail, 100), p_at);
  update public.user_stats set xp_total = xp_total + v_give,
         level = private.level_for_xp(xp_total + v_give), updated_at = now()
   where user_id = p_user;
  perform private.check_achievements(p_user, p_at);
  return v_give;
end $$;

create or replace function private.check_achievements(p_user uuid, p_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select a.* from public.achievements a
            where not exists (select 1 from public.user_achievements ua where ua.user_id = p_user and ua.code = a.code)
  loop
    if private.metric_value(p_user, r.metric) >= r.threshold then
      insert into public.user_achievements (user_id, code, unlocked_at) values (p_user, r.code, p_at)
        on conflict do nothing;
      if found and r.xp_reward > 0 then
        perform private.grant_xp(p_user, 'conquista', 'ach:' || r.code, r.xp_reward, false, r.name, p_at);
      end if;
    end if;
  end loop;
end $$;

-- Regras de XP: 1x por anime e ação (source_key único), independentemente de a linha ser apagada e recriada.
create or replace function private.award_entry(p_user uuid, p_mal integer, p_title text, p_status text,
  p_rating smallint, p_fav boolean, p_capped boolean, p_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status is not null then
    perform private.grant_xp(p_user, 'adicionar', 'add:' || p_mal, 5, p_capped, p_title, p_at); end if;
  if p_status in ('assistindo','concluido','pausado','abandonado') then
    perform private.grant_xp(p_user, 'iniciar', 'start:' || p_mal, 10, p_capped, p_title, p_at); end if;
  if p_status = 'concluido' then
    perform private.grant_xp(p_user, 'completar', 'done:' || p_mal, 50, p_capped, p_title, p_at); end if;
  if p_rating is not null then
    perform private.grant_xp(p_user, 'avaliar', 'rate:' || p_mal, 10, p_capped, p_title, p_at); end if;
  if p_fav then
    perform private.grant_xp(p_user, 'favoritar', 'fav:' || p_mal, 5, p_capped, p_title, p_at); end if;
end $$;

create or replace function private.on_library_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award_entry(new.user_id, new.mal_id, new.title, new.status, new.rating,
                              new.is_favorite, true, now());
  return new;
end $$;

drop trigger if exists library_xp on public.library_entries;
create trigger library_xp after insert or update of status, rating, is_favorite on public.library_entries
  for each row execute function private.on_library_change();

-- ---------- RPCs para o cliente (somente leitura / ações validadas) ----------
create or replace function public.my_progress()
returns table (xp_total integer, level integer, level_start integer, level_next integer,
               title_code text, title_name text, xp_today integer, daily_cap integer)
language sql stable security definer set search_path = '' as $$
  select coalesce(s.xp_total, 0), coalesce(s.level, 1),
         (50 * (coalesce(s.level, 1) - 1) ^ 2)::integer, (50 * coalesce(s.level, 1) ^ 2)::integer,
         s.title_code,
         coalesce(t.name, (select t2.name from public.titles t2
                            where t2.req_level <= coalesce(s.level, 1) order by t2.req_level desc limit 1)),
         (select coalesce(sum(e.xp), 0)::integer from public.xp_events e
           where e.user_id = u.uid and e.action <> 'conquista'
             and (e.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date),
         500
    from (select auth.uid() as uid) u
    left join public.user_stats s on s.user_id = u.uid
    left join public.titles t on t.code = s.title_code;
$$;

create or replace function public.list_achievements()
returns table (code text, name text, description text, rarity text, xp_reward integer, icon text,
               is_secret boolean, unlocked boolean, unlocked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select case when a.is_secret and ua.code is null then null else a.code end,
         case when a.is_secret and ua.code is null then '???' else a.name end,
         case when a.is_secret and ua.code is null then 'Conquista secreta. Continue explorando.' else a.description end,
         a.rarity,
         case when a.is_secret and ua.code is null then null else a.xp_reward end,
         case when a.is_secret and ua.code is null then 'fa-question' else a.icon end,
         a.is_secret, ua.code is not null, ua.unlocked_at
    from public.achievements a
    left join public.user_achievements ua on ua.code = a.code and ua.user_id = auth.uid()
   order by array_position(array['comum','rara','epica','lendaria'], a.rarity), a.is_secret, a.name;
$$;

create or replace function public.my_titles()
returns table (code text, name text, requirement text, unlocked boolean, equipped boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid, (select coalesce(level, 1) from public.user_stats where user_id = auth.uid()) as lvl)
  select t.code, t.name,
         case when t.req_level is not null then 'Nível ' || t.req_level
              when a.is_secret and ua.code is null then 'Conquista secreta'
              else 'Conquista: ' || a.name end,
         coalesce(t.req_level <= coalesce(me.lvl, 1), ua.code is not null),
         coalesce((select s.title_code = t.code from public.user_stats s where s.user_id = me.uid), false)
    from me cross join public.titles t
    left join public.achievements a on a.code = t.req_achievement
    left join public.user_achievements ua on ua.code = t.req_achievement and ua.user_id = me.uid
   order by t.req_level nulls last, t.name;
$$;

create or replace function public.equip_title(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Não autenticado'; end if;
  if p_code is not null and not exists (
       select 1 from public.my_titles() mt where mt.code = p_code and mt.unlocked) then
    raise exception 'Título indisponível';
  end if;
  insert into public.user_stats (user_id) values (v_uid) on conflict do nothing;
  update public.user_stats set title_code = p_code, updated_at = now() where user_id = v_uid;
end $$;

create or replace function public.pop_new_achievements()
returns table (name text, rarity text, icon text, xp_reward integer)
language sql security definer set search_path = '' as $$
  with u as (update public.user_achievements set notified = true
              where user_id = auth.uid() and not notified returning code, unlocked_at)
  select a.name, a.rarity, a.icon, a.xp_reward
    from u join public.achievements a on a.code = u.code order by u.unlocked_at;
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.my_progress(), public.list_achievements(), public.my_titles(),
  public.equip_title(text), public.pop_new_achievements() from public, anon;
grant execute on function public.my_progress(), public.list_achievements(), public.my_titles(),
  public.equip_title(text), public.pop_new_achievements() to authenticated;

-- ---------- retroativo: quem já tem biblioteca (Fase 2) recebe o XP correspondente ----------
-- Só para usuários que ainda não têm registro de XP (assim reexecutar este arquivo nunca
-- contorna o teto diário). Sem teto e com a data da própria entrada.
do $$
declare u record; r record;
begin
  for u in select distinct le.user_id from public.library_entries le
            where not exists (select 1 from public.user_stats s where s.user_id = le.user_id) loop
    for r in select * from public.library_entries where user_id = u.user_id order by updated_at loop
      perform private.award_entry(r.user_id, r.mal_id, r.title, r.status, r.rating, r.is_favorite, false, r.updated_at);
    end loop;
  end loop;
end $$;
