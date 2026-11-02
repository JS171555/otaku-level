-- OTAKU LEVEL — Fase 1 (rode inteiro no SQL Editor do Supabase)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  banner_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_fmt check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint profiles_display_len check (char_length(display_name) <= 40),
  constraint profiles_bio_len check (char_length(bio) <= 280)
);
create unique index if not exists profiles_username_lower_uq on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- Privilégios mínimos: o cliente só lê e edita campos seguros.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, bio, is_public) on public.profiles to authenticated;

drop policy if exists perfil_select on public.profiles;
create policy perfil_select on public.profiles for select to authenticated
  using (is_public or id = (select auth.uid()));

drop policy if exists perfil_update on public.profiles;
create policy perfil_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Sem policy de INSERT/DELETE: o perfil nasce pelo trigger e some com a conta.

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare u text := coalesce(new.raw_user_meta_data->>'username', '');
begin
  if u !~ '^[A-Za-z0-9_]{3,20}$'
     or exists (select 1 from public.profiles where lower(username) = lower(u)) then
    u := 'otaku_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  begin
    insert into public.profiles (id, username, display_name) values (new.id, u, u);
  exception when unique_violation then
    u := 'otaku_' || substr(replace(new.id::text, '-', ''), 1, 8);
    insert into public.profiles (id, username, display_name) values (new.id, u, u);
  end;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.username_disponivel(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_username ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;
revoke execute on function public.username_disponivel(text) from public;
grant execute on function public.username_disponivel(text) to anon, authenticated;
