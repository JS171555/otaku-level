"""Teste do SQL da Fase 5 (notificações e desafios semanais) em Postgres real descartável.
Uso: pip install pgserver "psycopg[binary]" && python3 tests/fase5.test.py"""
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
for f in ('schema', 'fase2', 'fase3', 'fase4', 'fase5'):
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


def bad(name, stmt, u='A'):
    t(name, u, f"begin {stmt}; raise exception 'DEVERIA TER FALHADO'; exception when others then if sqlerrm = 'DEVERIA TER FALHADO' then raise; end if; end;")

def one(u, sql): r = q(u, sql); return r[0][0] if r else None
def lib(u, mal, status=None, rating='null', fav='false'):  # igual ao js/library.js (insert/update/delete)
    st = f"'{status}'" if status else 'null'
    if not status and fav == 'false':
        return t(f'{u} remove anime {mal}', u, f"delete from library_entries where mal_id={mal};")
    t(f'{u} salva anime {mal}', u, f"update library_entries set status={st}, rating={rating}, is_favorite={fav} where mal_id={mal}; if not found then insert into library_entries(mal_id,status,rating,is_favorite,title) values ({mal},{st},{rating},{fav},'T{mal}'); end if;")

# --- notificações por conquista e nível ---
lib('A', 1, 'concluido', 9, 'true')
n = q('A', "select kind, title, link from notifications order by id")
check('conquista gera notificação persistente', any(k == 'conquista' and 'Primeiro Passo' in ti for k, ti, _ in n))
check('notificação aponta para página interna', all(l and l.endswith('.html') for *_, l in n))
check('subir de nível gera notificação', any(k == 'nivel' for k, *_ in n))
cnt = one('A', "select unread_notifications()")
check('contador de não lidas bate', cnt == len(n) and cnt > 0)
check('outro usuário não vê notificações de A', one('B', "select count(*) from notifications") == 0)
bad('cliente não insere notificação', "insert into notifications(user_id,kind,title,source_key) values (auth.uid(),'sistema','x','x')")
bad('cliente não atualiza notificação diretamente', "update notifications set read_at=now()")
first = one('A', "select min(id) from notifications")
t('marcar uma como lida', 'A', f"perform mark_notifications_read(array[{first}]::bigint[]);")
check('uma a menos não lida', one('A', "select unread_notifications()") == cnt - 1)
t('B não consegue marcar as de A', 'B', "perform mark_notifications_read(null);")
check('B não alterou as de A', one('A', "select unread_notifications()") == cnt - 1)
t('marcar todas como lidas', 'A', "perform mark_notifications_read(null);")
check('zero não lidas', one('A', "select unread_notifications()") == 0)
try:
    conn.execute("begin"); conn.execute("set local role anon"); conn.execute("select unread_notifications()"); fails += 1; print('FALHA anon executa unread_notifications')
except Exception: print('OK   anon não executa unread_notifications')
finally: conn.execute("rollback")

# --- desafios semanais ---
ch = {r[0]: r for r in q('A', "select code, progress, target, claimed from my_challenges()")}
check('5 desafios ativos', len(ch) == 5)
check('progresso de "completar" é 1 de 2', ch['sem_maratona'][1] == 1 and ch['sem_maratona'][2] == 2)
bad('resgatar antes de concluir falha', "perform claim_challenge('sem_maratona')")
lib('A', 2, 'concluido')
xp0 = one('A', "select xp_total from my_progress()")
t('resgatar desafio concluído', 'A', "perform claim_challenge('sem_maratona');")
xp1 = one('A', "select xp_total from my_progress()")
check('resgate dá exatamente 60 XP', xp1 - xp0 == 60)
bad('resgatar duas vezes falha', "perform claim_challenge('sem_maratona')")
check('desafio aparece como resgatado', q('A', "select claimed from my_challenges() where code='sem_maratona'")[0][0] is True)
check('resgate gera notificação de desafio', one('A', "select count(*) from notifications where kind='desafio'") == 1)
check('XP de desafio não conta no teto diário', one('A', "select xp_today from my_progress()") == one('A', "select coalesce(sum(xp),0) from xp_events where action not in ('conquista','desafio')"))
lib('A', 2)
lib('A', 2, 'concluido')
bad('remover e readicionar não permite resgatar de novo', "perform claim_challenge('sem_maratona')")
bad('desafio inexistente falha', "perform claim_challenge('nao_existe')")
bad('cliente não insere resgate direto', "insert into challenge_claims(user_id,code,week_start) values (auth.uid(),'sem_coracao',current_date)")
check('B não vê resgates de A', one('B', "select count(*) from challenge_claims") == 0)
check('B tem progresso próprio (zero)', all(r[0] == 0 for r in q('B', "select progress from my_challenges()")))
# evento de semana passada não conta
su = lambda k, act, key, at: run(f"select private.grant_xp('{U[k]}','{act}','{key}',10,false,'t',{at})")
su('B', 'completar', 'done:old1', "now() - interval '8 days'"); su('B', 'completar', 'done:old2', "now() - interval '9 days'")
check('eventos de semanas anteriores não contam', q('B', "select progress from my_challenges() where code='sem_maratona'")[0][0] == 0)

# --- idempotência ---
run((root / 'supabase/fase5.sql').read_text(), 'fase5.sql roda de novo sem erro')
check('reexecutar não duplica notificações', one('A', "select count(*) from notifications where kind='desafio'") == 1)

print('\n' + ('TUDO OK' if not fails else f'{fails} FALHA(S)'))
sys.exit(1 if fails else 0)
