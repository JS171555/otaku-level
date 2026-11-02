"""Teste do SQL da Fase 4 (privacidade, perfil público, ranking, Storage) em Postgres real descartável.
Uso: pip install pgserver "psycopg[binary]" && python3 tests/fase4.test.py"""
import pathlib, sys, tempfile
import pgserver, psycopg

root = pathlib.Path(__file__).resolve().parent.parent
db = pgserver.get_server(tempfile.mkdtemp())
conn = psycopg.connect(db.get_uri(), autocommit=True)
fails = 0

def run(sql, name=None):
    global fails
    try:
        cur = conn.execute(sql)
        rows = cur.fetchall() if cur.description else None
        if name: print('OK  ', name)
        return rows
    except Exception as e:
        fails += 1; print('FALHA', name or '', '->', str(e).splitlines()[0][:220]); return None

run("""
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid() primary key, bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
grant usage on schema storage to authenticated; grant select, insert, update, delete on storage.objects to authenticated;
""", 'stubs do Supabase (auth + storage)')
for f in ('schema', 'fase2', 'fase3', 'fase4'):
    run((root / f'supabase/{f}.sql').read_text(), f'{f}.sql')

N = 'ABCDEFG'
U = {k: f'{i}b4e7d10-3c5a-4f2b-8d6e-9a0b1c2d3e4{i}' for i, k in enumerate(N, 1)}
run("insert into auth.users(id, raw_user_meta_data) values " + ",".join(
    f"('{U[k]}', '{{\"username\":\"user_{k.lower()}\"}}')" for k in N) + ";", 'usuários (perfis criados por trigger)')

def as_user(u, body): return f"""do $t$ begin perform set_config('request.jwt.claim.sub','{U[u]}',true); set local role authenticated; {body} end $t$;"""
def t(name, u, body): run(as_user(u, body), name)
def q(u, sql):  # consulta como usuário autenticado (retorna linhas)
    conn.execute("begin"); conn.execute(f"select set_config('request.jwt.claim.sub','{U[u]}',true)"); conn.execute("set local role authenticated")
    try: return conn.execute(sql).fetchall()
    finally: conn.execute("rollback")
def check(name, cond):
    global fails
    print('OK  ' if cond else 'FALHA', name); fails += 0 if cond else 1

# XP: A=300 (geral, semanal), B=200 (privado), C=150 (fora do ranking), D=100 (stats/conquistas ocultas), E=50, F=90 (XP só de 40 dias atrás), G=0
su = lambda k, xp, at='now()': run(f"select private.grant_xp('{U[k]}','teste','t:{k}:{xp}',{xp},false,'t',{at})")
su('A', 300); su('B', 200); su('C', 150); su('D', 100); su('E', 50); su('F', 90, "now() - interval '40 days'")
run(f"update public.profiles set is_public=false where id='{U['B']}'")
run(f"update public.profiles set show_in_ranking=false where id='{U['C']}'")
run(f"update public.profiles set show_stats=false, show_achievements=false where id='{U['D']}'")
run(f"insert into public.library_entries(user_id,mal_id,status,rating,is_favorite,title) values ('{U['A']}',1,'concluido',9,true,'X'),('{U['A']}',2,'assistindo',null,false,'Y'),('{U['D']}',3,'planejado',null,false,'Z')")

# --- URLs de imagem ---
ID = U['A']; base = 'https://abcdefghijklmn.supabase.co/storage/v1/object/public'
t('avatar_url válida é aceita', 'A', f"update profiles set avatar_url='{base}/avatars/{ID}/a1.webp' where id=auth.uid();")
t('banner_url válida é aceita', 'A', f"update profiles set banner_url='{base}/banners/{ID}/b1.webp' where id=auth.uid();")
def bad(name, stmt):
    t(name, 'A', f"begin {stmt}; raise exception 'DEVERIA TER FALHADO'; exception when check_violation or insufficient_privilege then null; end;")
bad('avatar_url de outro domínio é recusada', "update profiles set avatar_url='https://evil.example/storage/v1/object/public/avatars/"+ID+"/a.webp' where id=auth.uid()")
bad('avatar_url na pasta de outro usuário é recusada', f"update profiles set avatar_url='{base}/avatars/{U['B']}/a.webp' where id=auth.uid()")
bad('avatar_url com javascript: é recusada', "update profiles set avatar_url='javascript:alert(1)' where id=auth.uid()")
bad('banner_url apontando para o bucket de avatars é recusada', f"update profiles set banner_url='{base}/avatars/{ID}/a.webp' where id=auth.uid()")
bad('cliente não troca o username', "update profiles set username='hacker' where id=auth.uid()")
t('toggles de privacidade são editáveis', 'A', "update profiles set show_stats=false, show_in_ranking=false, show_achievements=false where id=auth.uid(); update profiles set show_stats=true, show_in_ranking=true, show_achievements=true where id=auth.uid();")

# --- Storage: só a própria pasta ---
t('upload na própria pasta funciona', 'A', f"insert into storage.objects(bucket_id,name) values ('avatars','{ID}/z.webp');")
bad('upload na pasta de outro usuário é bloqueado', f"insert into storage.objects(bucket_id,name) values ('avatars','{U['B']}/z.webp')")
bad('upload na raiz do bucket é bloqueado', "insert into storage.objects(bucket_id,name) values ('avatars','x.webp')")
run(f"insert into storage.objects(bucket_id,name) values ('banners','{U['B']}/keep.webp')")
t('delete de arquivo alheio não falha, mas não afeta nada', 'A', f"delete from storage.objects where name='{U['B']}/keep.webp';")
check('arquivo de outro usuário continua existindo', run(f"select count(*) from storage.objects where name='{U['B']}/keep.webp'")[0][0] == 1)
t('não enxerga arquivos de outro usuário', 'A', f"assert (select count(*) from storage.objects where name like '{U['B']}/%')=0, 'viu arquivo alheio';")
check('buckets públicos com limite de tamanho e MIME', run("select count(*) from storage.buckets where id in ('avatars','banners') and public and file_size_limit>0 and allowed_mime_types @> array['image/webp']")[0][0] == 2)

# --- perfil público e privacidade ---
r = q('E', "select username, level, xp_total, n_completed, avg_rating, is_self from get_public_profile('USER_A')")
check('perfil público de A (case-insensitive) com estatísticas', len(r) == 1 and r[0][0] == 'user_a' and r[0][1] >= 1 and r[0][2] >= 300 and r[0][3] == 1 and float(r[0][4]) == 9.0 and r[0][5] is False)
check('perfil privado (B) não existe para outros', q('E', "select 1 from get_public_profile('user_b')") == [])
check('perfil privado (B) existe para o próprio', len(q('B', "select 1 from get_public_profile('user_b')")) == 1)
r = q('E', "select level, xp_total, title_name, n_added, avg_rating from get_public_profile('user_d')")
check('D oculta estatísticas: tudo nulo para outros', r == [(None,) * 5])
r = q('D', "select level, xp_total, is_self from get_public_profile('user_d')")
check('D vê as próprias estatísticas', r[0][0] is not None and r[0][2] is True)
check('conquistas públicas de A', len(q('E', "select * from public_achievements('user_a')")) > 0)
check('conquistas ocultas de D não vazam', q('E', "select * from public_achievements('user_d')") == [])
check('D vê as próprias conquistas', len(q('D', "select * from public_achievements('user_d')")) > 0)
check('conquistas de perfil privado não vazam', q('E', "select * from public_achievements('user_b')") == [])
check('perfil retorna sem expor user_id', 'user_id' not in [d.name for d in conn.execute("select * from public.get_public_profile('user_a')").description])

# --- rankings ---
def rk(u, period, lim=50): return q(u, f"select pos, username, xp, is_me from get_ranking('{period}', {lim})")
g = rk('E', 'geral'); names = [x[1] for x in g]
check('geral: ordem por XP (A, D, F, E…) sem privados/ocultos', names[0] == 'user_a' and 'user_b' not in names and 'user_c' not in names and names.index('user_d') < names.index('user_e'))
check('geral: usuário sem XP (G) não aparece', 'user_g' not in names)
s = rk('E', 'semanal'); sn = [x[1] for x in s]
check('semanal: XP de 40 dias atrás (F) fica de fora', 'user_f' not in sn and 'user_a' in sn)
m = rk('E', 'mensal'); mn = [x[1] for x in m]
check('mensal: XP de 40 dias atrás (F) fica de fora', 'user_f' not in mn and 'user_a' in mn)
check('is_me marca só o próprio usuário', [x[1] for x in rk('E', 'geral') if x[3]] == ['user_e'])
check('empates dividem a posição', len({x[0] for x in q('E', "select pos, username, xp, is_me from get_ranking('geral', 50) where xp>0")}) <= len(g))
check('limite máximo 100 e mínimo 1', len(rk('E', 'geral', 1)) == 1 and len(rk('E', 'geral', 100000)) == len(g))
check('período inválido retorna vazio', rk('E', 'anual') == [])
check('my_rank de A é 1º', q('A', "select pos from my_rank('geral')") == [(1,)])
check('my_rank de quem está fora (C, B) é vazio', q('C', "select * from my_rank('geral')") == [] and q('B', "select * from my_rank('geral')") == [])
check('my_rank semanal de F (sem XP na semana) é vazio', q('F', "select * from my_rank('semanal')") == [])
# privacidade dinâmica: C volta ao ranking
run(f"update public.profiles set show_in_ranking=true where id='{U['C']}'")
check('C volta ao ranking ao reativar', 'user_c' in [x[1] for x in rk('E', 'geral')])

# --- acesso direto / grants ---
def denied(name, u, stmt): t(name, u, f"begin {stmt}; raise exception 'DEVERIA TER FALHADO'; exception when insufficient_privilege then null; end;")
denied('cliente não chama private.ranking', 'E', "perform * from private.ranking('geral')")
denied('cliente anônimo/público sem execute: authenticated não altera xp', 'E', "update user_stats set xp_total=1")
check('anon não executa get_ranking', run("select has_function_privilege('anon','public.get_ranking(text,integer)','execute')")[0][0] is False)
check('anon não executa get_public_profile', run("select has_function_privilege('anon','public.get_public_profile(text)','execute')")[0][0] is False)

# --- idempotência ---
before = run("select count(*) from storage.buckets"), run("select id, show_stats, show_in_ranking from public.profiles order by id")
run((root / 'supabase/fase4.sql').read_text(), 'fase4.sql reexecutado')
after = run("select count(*) from storage.buckets"), run("select id, show_stats, show_in_ranking from public.profiles order by id")
check('reexecução não altera dados', before == after)
print('\nRESULTADO:', 'TUDO OK' if not fails else f'{fails} FALHA(S)')
sys.exit(1 if fails else 0)
