-- OTAKU LEVEL — Fase 5: notificações persistentes e desafios semanais.
-- Rode DEPOIS de fase4.sql. É idempotente (pode rodar de novo).
-- O cliente não escreve em nenhuma tabela nova: tudo passa por triggers e RPCs SECURITY DEFINER.

-- ---------- notificações ----------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('conquista','nivel','desafio','sistema')),
  title text not null check (char_length(title) <= 120),
  body text check (char_length(body) <= 240),
  link text check (link ~ '^[a-z]+\.html(\?[A-Za-z0-9_=&-]*)?$'),   -- só páginas internas
  source_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);
create index if not exists notifications_user_time on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));

create or replace function private.notify(p_user uuid, p_kind text, p_key text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, kind, source_key, title, body, link)
  values (p_user, p_kind, p_key, left(p_title, 120), left(p_body, 240), p_link)
  on conflict (user_id, source_key) do nothing;
end $$;

create or replace function private.on_achievement_unlocked() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  select name, rarity, xp_reward into a from public.achievements where code = new.code;
  perform private.notify(new.user_id, 'conquista', 'ach:' || new.code, 'Conquista desbloqueada: ' || a.name,
    case a.rarity when 'comum' then 'Comum' when 'rara' then 'Rara' when 'epica' then 'Épica' else 'Lendária' end
      || ' · +' || a.xp_reward || ' XP', 'conquistas.html');
  return new;
end $$;
drop trigger if exists achievement_notify on public.user_achievements;
create trigger achievement_notify after insert on public.user_achievements
  for each row execute function private.on_achievement_unlocked();

create or replace function private.on_level_up() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.level > old.level then
    perform private.notify(new.user_id, 'nivel', 'lvl:' || new.level, 'Você chegou ao nível ' || new.level || '!',
      'Confira os títulos liberados.', 'conquistas.html');
  end if;
  return new;
end $$;
drop trigger if exists level_notify on public.user_stats;
create trigger level_notify after update of level on public.user_stats
  for each row execute function private.on_level_up();

create or replace function public.unread_notifications() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.notifications where user_id = auth.uid() and read_at is null;
$$;

-- p_ids nulo marca todas como lidas. Só altera as próprias linhas.
create or replace function public.mark_notifications_read(p_ids bigint[] default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- desafios semanais ----------
create table if not exists public.challenges (
  code text primary key,
  name text not null,
  description text not null,
  action text not null check (action in ('adicionar','iniciar','completar','avaliar','favoritar')),
  target integer not null check (target > 0),
  xp_reward integer not null check (xp_reward > 0 and xp_reward <= 200),
  icon text not null default 'fa-bullseye',
  active boolean not null default true
);

create table if not exists public.challenge_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null references public.challenges(code),
  week_start date not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, code, week_start)
);

alter table public.challenges enable row level security;
alter table public.challenge_claims enable row level security;
revoke all on public.challenges, public.challenge_claims from anon, authenticated;
grant select on public.challenge_claims to authenticated;
drop policy if exists claims_select on public.challenge_claims;
create policy claims_select on public.challenge_claims for select to authenticated using (user_id = (select auth.uid()));

insert into public.challenges (code, name, description, action, target, xp_reward, icon) values
 ('sem_explorador', 'Explorador da Semana', 'Adicione 3 animes novos à biblioteca.', 'adicionar', 3, 30, 'fa-compass'),
 ('sem_estreia', 'Estreias', 'Comece 2 animes novos.', 'iniciar', 2, 30, 'fa-play'),
 ('sem_maratona', 'Maratona', 'Conclua 2 animes.', 'completar', 2, 60, 'fa-flag-checkered'),
 ('sem_critico', 'Opinião Forte', 'Avalie 3 animes.', 'avaliar', 3, 40, 'fa-star'),
 ('sem_coracao', 'Coração Aberto', 'Favorite 2 animes.', 'favoritar', 2, 20, 'fa-heart')
on conflict (code) do update set name = excluded.name, description = excluded.description, action = excluded.action,
  target = excluded.target, xp_reward = excluded.xp_reward, icon = excluded.icon;

-- Semana começa na segunda-feira, horário de Brasília (igual ao ranking semanal).
create or replace function private.week_start(p_at timestamptz) returns date
language sql immutable set search_path = '' as $$
  select date_trunc('week', p_at at time zone 'America/Sao_Paulo')::date;
$$;

-- Progresso vem do livro-razão de XP (1 evento por anime e ação), então não dá para inflar repetindo ações.
create or replace function public.my_challenges()
returns table (code text, name text, description text, icon text, target integer, progress integer,
               xp_reward integer, claimed boolean, week_end timestamptz)
language sql stable security definer set search_path = '' as $$
  with w as (select private.week_start(now()) as ws)
  select c.code, c.name, c.description, c.icon, c.target,
         least(c.target, (select count(*)::integer from public.xp_events e
            where e.user_id = auth.uid() and e.action = c.action
              and (e.created_at at time zone 'America/Sao_Paulo')::date >= w.ws)),
         c.xp_reward,
         exists (select 1 from public.challenge_claims cc where cc.user_id = auth.uid() and cc.code = c.code and cc.week_start = w.ws),
         ((w.ws + 7)::timestamp at time zone 'America/Sao_Paulo')
    from public.challenges c cross join w
   where c.active and auth.uid() is not null
   order by c.xp_reward, c.code;
$$;

create or replace function public.claim_challenge(p_code text) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_ws date := private.week_start(now()); c record; v_xp integer;
begin
  if v_uid is null then raise exception 'Não autenticado'; end if;
  insert into public.user_stats (user_id) values (v_uid) on conflict do nothing;
  perform 1 from public.user_stats where user_id = v_uid for update;   -- serializa resgates simultâneos
  select * into c from public.challenges where code = p_code and active;
  if not found then raise exception 'Desafio indisponível'; end if;
  if (select count(*) from public.xp_events e where e.user_id = v_uid and e.action = c.action
        and (e.created_at at time zone 'America/Sao_Paulo')::date >= v_ws) < c.target then
    raise exception 'Desafio ainda não concluído';
  end if;
  insert into public.challenge_claims (user_id, code, week_start) values (v_uid, c.code, v_ws)
    on conflict do nothing;
  if not found then raise exception 'Desafio já resgatado'; end if;
  v_xp := private.grant_xp(v_uid, 'desafio', 'ch:' || c.code || ':' || v_ws, c.xp_reward, false, c.name, now());
  perform private.notify(v_uid, 'desafio', 'ch:' || c.code || ':' || v_ws, 'Desafio concluído: ' || c.name,
    '+' || v_xp || ' XP', 'dashboard.html');
  return v_xp;
end $$;

-- ---------- teto diário: recompensas de desafio também não contam (como conquistas) ----------
create or replace function private.grant_xp(p_user uuid, p_action text, p_key text, p_xp integer,
  p_capped boolean, p_detail text, p_at timestamptz) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_cap constant integer := 500;
  v_today integer; v_give integer;
begin
  insert into public.user_stats (user_id) values (p_user) on conflict do nothing;
  perform 1 from public.user_stats where user_id = p_user for update;
  if exists (select 1 from public.xp_events where user_id = p_user and source_key = p_key) then return 0; end if;
  v_give := p_xp;
  if p_capped then
    select coalesce(sum(xp), 0) into v_today from public.xp_events
     where user_id = p_user and action not in ('conquista', 'desafio')
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
           where e.user_id = u.uid and e.action not in ('conquista', 'desafio')
             and (e.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date),
         500
    from (select auth.uid() as uid) u
    left join public.user_stats s on s.user_id = u.uid
    left join public.titles t on t.code = s.title_code;
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.unread_notifications(), public.mark_notifications_read(bigint[]),
  public.my_challenges(), public.claim_challenge(text), public.my_progress() from public, anon;
grant execute on function public.unread_notifications(), public.mark_notifications_read(bigint[]),
  public.my_challenges(), public.claim_challenge(text), public.my_progress() to authenticated;
