"""Teste do SQL da Fase 3 em um Postgres real e descartável.
Uso: pip install pgserver && python3 tests/fase3.test.py
Simula auth.users, auth.uid() e os papéis anon/authenticated do Supabase."""
import pathlib, re, sys, tempfile
import pgserver

root = pathlib.Path(__file__).resolve().parent.parent
db = pgserver.get_server(tempfile.mkdtemp())
fails = 0

import psycopg
conn = psycopg.connect(db.get_uri(), autocommit=True)

def run(sql, name=None):
    global fails
    try:
        cur = conn.execute(sql)
        rows = cur.fetchall() if cur.description else None
        if name: print('OK  ', name)
        return rows
    except Exception as e:
        fails += 1
        print('FALHA', name or '', '->', str(e).splitlines()[0][:200])
        return None

run("""
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
""", 'stubs do Supabase')
run((root / 'supabase/schema.sql').read_text(), 'schema.sql (Fase 1)')
run((root / 'supabase/fase2.sql').read_text(), 'fase2.sql (Fase 2)')

U = {k: f'{i}a3f9c21-7b4d-4e0a-9c1d-5e6f7a8b9c0{i}' for i, k in enumerate('ABCDEF', 1)}
run("insert into auth.users(id) values " + ",".join(f"('{v}')" for v in U.values()) + ";", 'usuários de teste')
# dados pré-existentes da Fase 2 (testa o retroativo): C = concluído às 12h SP; D = concluído às 02h30 SP
run(f"""
insert into public.library_entries (user_id,mal_id,status,rating,is_favorite,title,updated_at) values
 ('{U['C']}',1,'concluido',9,true,'Anime C','2026-01-01 15:00+00'),
 ('{U['D']}',2,'concluido',null,false,'Anime D','2026-01-01 05:30+00');
""", 'biblioteca pré-existente')
run((root / 'supabase/fase3.sql').read_text(), 'fase3.sql (aplicação + retroativo)')

def as_user(u, body):   # executa um bloco PL/pgSQL como usuário autenticado (RLS e grants valem)
    return f"""do $t$ begin
      perform set_config('request.jwt.claim.sub','{U[u]}',true); set local role authenticated;
      {body}
    end $t$;"""

def t(name, user, body): run(as_user(user, body), name)

# --- retroativo ---
t('retroativo C: 130 XP, nível 2', 'C', "assert (select xp_total from my_progress())=130 and (select level from my_progress())=2, 'C deveria ter 130 XP / nível 2';")
t('retroativo: sem Coruja às 12h, com Coruja às 02h30', 'C', "assert (select count(*) from user_achievements where code='coruja_otaku')=0, 'C não pode ter coruja';")
t('retroativo D: Coruja Otaku desbloqueada', 'D', "assert (select count(*) from user_achievements where code='coruja_otaku')=1, 'D deveria ter coruja'; assert (select name from list_achievements() where unlocked and is_secret limit 1)='Coruja Otaku', 'segredo revelado após desbloqueio';")

night = run("select extract(hour from now() at time zone 'America/Sao_Paulo') < 5")[0][0]
extra = 75 if night else 0   # 'Coruja Otaku' é conquista correta se o teste rodar de madrugada
lvl = 3 if night else 2
# --- fluxo incremental (F) e anti-duplicação ---
steps = [
 ("insert into library_entries(mal_id,status,title) values (10,'planejado','F10');", 15),   # add 5 + conquista primeiro_passo 10
 ("update library_entries set status='assistindo' where mal_id=10;", 25),                    # start 10
 ("update library_entries set status='concluido' where mal_id=10;", 95),                     # done 50 + fim_da_jornada 20
 ("update library_entries set rating=8 where mal_id=10;", 115),                              # rate 10 + critico_de_primeira 10
 ("update library_entries set is_favorite=true where mal_id=10;", 130),                      # fav 5 + coracao_otaku 10 ... ver abaixo
]
for sql, _ in steps: run(as_user('F', sql), None)
xp = run(as_user('F', "perform 1;"), None)
t('F: XP total coerente com o livro-razão e nível', 'F',
  f"assert (select xp_total from my_progress())=(select sum(xp) from xp_events), 'xp_total != soma do livro-razão';"
  "assert (select level from my_progress())=(select level from user_stats), 'nível';"
  f"assert (select xp_total from my_progress())=130+{extra}, 'F deveria ter '||(130+{extra})||' XP, tem '||(select xp_total from my_progress());")
t('F: repetir ações não gera XP', 'F',
  f"update library_entries set rating=5 where mal_id=10; update library_entries set status='pausado' where mal_id=10; update library_entries set status='concluido' where mal_id=10;"
  f"assert (select xp_total from my_progress())=130+{extra}, 'XP duplicado ao repetir ações';")
t('F: apagar e recriar o anime NÃO dá XP de novo', 'F',
  f"delete from library_entries where mal_id=10; insert into library_entries(mal_id,status,rating,is_favorite,title) values (10,'concluido',9,true,'F10');"
  f"assert (select xp_total from my_progress())=130+{extra}, 'farm por apagar/recriar';")

# --- fraude direta pelo cliente ---
def denied(name, user, stmt):
    t(name, user, f"begin {stmt}; raise exception 'DEVERIA TER FALHADO'; exception when insufficient_privilege then null; end;")
denied('cliente não insere em xp_events', 'F', "insert into xp_events(user_id,action,source_key,xp) values (auth.uid(),'x','k',999)")
denied('cliente não altera user_stats', 'F', "update user_stats set xp_total=99999")
denied('cliente não insere user_achievements', 'F', "insert into user_achievements(user_id,code) values (auth.uid(),'lenda_oculta')")
denied('cliente não lê catálogo (segredos)', 'F', "perform * from achievements")
denied('cliente não chama funções privadas', 'F', "perform private.grant_xp(auth.uid(),'x','k2',999,false,'x',now())")
t('equip_title recusa título bloqueado', 'F', "begin perform equip_title('lenda'); raise exception 'DEVERIA TER FALHADO'; exception when raise_exception then if sqlerrm like 'DEVERIA%' then raise; end if; end;")
t('equip_title aceita título liberado', 'F', "perform equip_title('novato'); assert (select title_code from my_progress())='novato', 'título não equipado';")
t('my_titles: aprendiz só com nível 3', 'F', f"assert (select unlocked from my_titles() where code='aprendiz')={'true' if night else 'false'}, 'aprendiz (nível '||(select level from my_progress())||')';")

# --- isolamento entre usuários ---
t('B não vê dados de F nem de C', 'B', "assert (select count(*) from xp_events)=0 and (select count(*) from user_stats)=0 and (select count(*) from user_achievements)=0, 'vazamento entre usuários';")
t('B não pode equipar com sessão de outro (uid próprio)', 'B', "assert (select xp_total from my_progress())=0, 'B deveria ter 0 XP';")

# --- máscara de conquistas secretas ---
t('list_achievements mascara segredos', 'B',
  "assert (select count(*) from list_achievements())=21, 'catálogo incompleto';"
  "assert (select count(*) from list_achievements() where is_secret and name='???' and code is null and description not like '%madrugada%')=6, 'segredos vazando';")

# --- notificações ---
t('pop_new_achievements entrega uma vez', 'F',
  f"assert (select count(*) from pop_new_achievements())={4 + (1 if night else 0)}, 'conquistas novas';"
  "assert (select count(*) from pop_new_achievements())=0, 'não deveria repetir';")

# --- teto diário (E) ---
rows = ",".join(f"({100+i},'concluido',{8},true,'E{i}')" for i in range(10))
t('E: 10 animes completos no mesmo dia', 'E', f"insert into library_entries(mal_id,status,rating,is_favorite,title) values {rows};")
t('teto diário de 500 XP em ações', 'E',
  "assert (select coalesce(sum(xp),0) from xp_events where action<>'conquista')=500, 'teto diário violado: '||(select sum(xp) from xp_events where action<>'conquista');"
  "assert (select xp_today from my_progress())=500 and (select daily_cap from my_progress())=500, 'xp_today';"
  "assert (select xp_total from my_progress())=(select sum(xp) from xp_events), 'livro-razão';"
  "assert (select level from my_progress())=(select floor(sqrt(xp_total/50.0))::int+1 from user_stats), 'nível';")

# --- idempotência da migração ---
before = run("select user_id, xp_total, level from public.user_stats order by 1")
run((root / 'supabase/fase3.sql').read_text(), 'fase3.sql reexecutado (idempotente)')
after = run("select user_id, xp_total, level from public.user_stats order by 1")
if before != after:
    fails += 1; print('FALHA reexecução alterou XP')
else: print('OK   reexecução não altera XP')

print('\nRESULTADO:', 'TUDO OK' if not fails else f'{fails} FALHA(S)')
sys.exit(1 if fails else 0)
