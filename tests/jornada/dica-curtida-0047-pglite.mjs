// Migration 0047 (curtida em dica conta "Sua dica ajudou") num Postgres de
// verdade (PGlite), com o mesmo "Supabase de mentira" do
// tests/atendimentos/trava-status-0046-pglite.mjs (papéis, auth.users,
// auth.uid()). Testa os DOIS caminhos, cada um num banco limpo:
//   1. sem a 0047 (como o banco está hoje): curtir pela sessão, como o
//      alternarCurtida do app faz, grava a curtida sem erro e não credita
//      nada (a missão da dica fica parada, igual a hoje);
//   2. com a 0047: a curtida de outra pessoa numa dica dá o crédito à
//      autora; curtir a própria dica, descurtir e curtir de novo, curtir
//      post de outra categoria e curtida repetida não contam; 3 pessoas
//      diferentes fecham o "Sua dica ajudar 3 vezes" do mês; se o crédito
//      falhar, a curtida grava igual; a sessão não lê a tabela de pares nem
//      chama as funções internas.
// NÃO aplica nada em lugar nenhum: é um Postgres em memória.
// Uso (o mesmo do motor):
//   npx -y -p @electric-sql/pglite@0.2 node tests/jornada/dica-curtida-0047-pglite.mjs supabase/migrations
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.argv[2] ?? "supabase/migrations";
const A0047 = "0047_jornada_dica_curtida.sql";
const BOOT = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claim.role', true)
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select '{}'::jsonb
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (
  id text primary key, name text, owner uuid, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[],
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb, created_at timestamptz default now(),
  updated_at timestamptz default now(), last_accessed_at timestamptz
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
grant usage on schema storage to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create publication supabase_realtime;
alter default privileges grant execute on functions to anon, authenticated, service_role;
`;

let falhas = 0;
const ok = (n, c, x) => {
  if (!c) falhas++;
  console.log(
    `${c ? "PASSA" : "FALHA"} ${n} ${x === undefined ? "" : JSON.stringify(x)}`
  );
};

const todos = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
if (!todos.includes(A0047)) {
  console.log(`FALHA a ${A0047} não está no diretório`);
  process.exit(1);
}

const AUTORA = "aaaaaaaa-0000-4000-8000-00000000000a";
const B = "bbbbbbbb-0000-4000-8000-00000000000b";
const C = "cccccccc-0000-4000-8000-00000000000c";
const D = "dddddddd-0000-4000-8000-00000000000d";
const DICA = "22222222-0000-4000-8000-000000000001";
const OUTRA = "22222222-0000-4000-8000-000000000002";
const DICA2 = "22222222-0000-4000-8000-000000000003";

/** Banco limpo com as migrations `arquivos` e as 4 contas na Rede. */
async function banco(arquivos) {
  const db = new PGlite();
  await db.exec(BOOT);
  let erros = 0;
  for (const f of arquivos) {
    try {
      await db.exec(readFileSync(join(DIR, f), "utf-8"));
    } catch (e) {
      erros++;
      console.log(`ERRO  ${f}: ${e.message}`);
    }
  }
  console.log(
    `migrations: ${arquivos.length - erros}/${arquivos.length} aplicadas sem erro`
  );
  if (erros) process.exit(1);
  const contas = [AUTORA, B, C, D];
  await db.exec(`
    insert into auth.users (id, email) values
      ${contas.map((u, i) => `('${u}', 'u${i}@x')`).join(", ")};
    insert into public.rede_convites (codigo_hash, usado_por, usado_em, expira_em) values
      ${contas.map((u, i) => `('h${i}', '${u}', now(), now() + interval '1 day')`).join(", ")};
    insert into public.rede_posts (id, autor_id, categoria, texto) values
      ('${DICA}', '${AUTORA}', 'dica', 'dica'),
      ('${OUTRA}', '${AUTORA}', 'conquista', 'conquista'),
      ('${DICA2}', '${AUTORA}', 'dica', 'falha');
  `);
  return db;
}

/** Roda `sql` como a sessão (authenticated) da conta `uid`. Devolve a
 * mensagem de erro (ou null). */
async function como(db, uid, sql) {
  await db.exec(`
    select set_config('request.jwt.claims', '${JSON.stringify({ role: "authenticated", sub: uid })}', false);
    select set_config('request.jwt.claim.sub', '${uid}', false);
    set role authenticated;`);
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return e.message;
  } finally {
    await db.exec("reset role;");
  }
}
// O mesmo SQL que o alternarCurtida (lib/rede/feed.ts) gera: upsert com
// ignoreDuplicates e delete.
const curtir = (db, uid, post) =>
  como(
    db,
    uid,
    `insert into public.rede_curtidas (post_id, user_id) values ('${post}', '${uid}')
     on conflict (post_id, user_id) do nothing`
  );
const descurtir = (db, uid, post) =>
  como(
    db,
    uid,
    `delete from public.rede_curtidas where post_id = '${post}' and user_id = '${uid}'`
  );
const um = async (db, sql) => (await db.query(sql)).rows[0];
const ajudou = async (db) =>
  (
    await um(
      db,
      `select coalesce((select contagem_total from public.jornada_acoes
        where user_id = '${AUTORA}' and acao = 'dica_ajudou'), 0)::int n`
    )
  ).n;
const conectar = async (db) =>
  (
    await um(
      db,
      `select coalesce((select glow_conectar from public.jornada_saldo
        where user_id = '${AUTORA}'), 0)::int n`
    )
  ).n;
const curtidas = async (db, post) =>
  (
    await um(
      db,
      `select count(*)::int n from public.rede_curtidas where post_id = '${post}'`
    )
  ).n;

// ── 1. Sem a 0047 (o banco de hoje) ─────────────────────────────
console.log("-- caminho 1: sem a 0047");
{
  const db = await banco(todos.filter((f) => f !== A0047));
  const e = await curtir(db, B, DICA);
  ok("curtir dica grava a curtida sem erro", !e && (await curtida(db, B)), e);
  ok("e não credita nada (igual a hoje)", (await ajudou(db)) === 0);
  const e2 = await descurtir(db, B, DICA);
  ok("descurtir sem erro", !e2 && (await curtidas(db, DICA)) === 0, e2);
  await db.close();
}

async function curtida(db, uid) {
  return !!(await um(
    db,
    `select 1 as x from public.rede_curtidas where post_id = '${DICA}' and user_id = '${uid}'`
  ));
}

// ── 2. Com a 0047 ───────────────────────────────────────────────
console.log("-- caminho 2: com a 0047");
{
  const db = await banco(todos);
  const glow0 = await conectar(db);

  let e = await curtir(db, B, DICA);
  ok("curtida de outra pessoa grava", !e && (await curtida(db, B)), e);
  ok("e credita a autora (dica_ajudou = 1)", (await ajudou(db)) === 1);
  const glow1 = await conectar(db);
  ok(
    "a autora ganha Glow no Conectar (+5 e o selo Mão amiga I +20)",
    glow1 === glow0 + 5 + 20,
    { antes: glow0, depois: glow1 }
  );
  ok(
    "o selo Mão amiga é da autora",
    !!(await um(
      db,
      `select 1 as x from public.jornada_selos where user_id = '${AUTORA}' and selo = 'mao_amiga'`
    ))
  );
  ok(
    "quem curtiu não ganha nada na Jornada",
    !(await um(
      db,
      `select 1 as x from public.jornada_acoes where user_id = '${B}'`
    ))
  );

  e = await curtir(db, B, DICA);
  ok("curtida repetida (upsert) não conta de novo", !e && (await ajudou(db)) === 1, e);

  e = await descurtir(db, B, DICA);
  const e2 = await curtir(db, B, DICA);
  ok(
    "descurtir e curtir de novo não conta de novo",
    !e && !e2 && (await curtida(db, B)) && (await ajudou(db)) === 1,
    [e, e2]
  );

  e = await curtir(db, AUTORA, DICA);
  ok(
    "curtir a própria dica grava, mas não conta",
    !e && (await curtida(db, AUTORA)) && (await ajudou(db)) === 1,
    e
  );

  e = await curtir(db, C, OUTRA);
  ok(
    "curtir post de outra categoria grava, mas não conta",
    !e && (await curtidas(db, OUTRA)) === 1 && (await ajudou(db)) === 1,
    e
  );

  e = await curtir(db, C, DICA);
  const e3 = await curtir(db, D, DICA);
  ok("3 pessoas diferentes: dica_ajudou = 3", !e && !e3 && (await ajudou(db)) === 3, [e, e3]);

  const mes = await um(
    db,
    `select private.jornada_progresso(p.contadores, 'dica_ajudou')::int n
     from public.jornada_periodos p
     where p.user_id = '${AUTORA}' and p.tipo = 'mes' and not p.fechado`
  );
  const missao = await um(
    db,
    `select alvo from private.jornada_missoes(12) where chave = 'dica_ajudou'`
  );
  ok(
    'o mês conta 3: fecha o "Sua dica ajudar 3 vezes" (dezembro, alvo 3)',
    mes?.n === 3 && missao?.alvo === 3,
    { mes: mes?.n, alvo: missao?.alvo }
  );

  // A sessão não enxerga nem chama o que é interno.
  e = await como(db, B, "select * from private.jornada_dica_creditos");
  ok("a sessão não lê a tabela de pares", /permission denied/.test(e ?? ""), e);
  e = await como(db, B, "select private.jornada_dica_curtida()");
  ok("a sessão não chama a função do gatilho", !!e, e);
  e = await como(db, B, `select private.jornada_creditar_dica('${DICA}', 'dica_ajudou')`);
  ok("a sessão não chama o crédito direto", /permission denied/.test(e ?? ""), e);
  ok("e nada mudou com essas tentativas", (await ajudou(db)) === 3);

  // O crédito falha (motor quebrado): a curtida grava igual, o par não
  // fica guardado e a próxima curtida tenta de novo.
  await db.exec(`
    alter function private.jornada_creditar_dica(uuid, text) rename to jornada_creditar_dica_ok;
    create function private.jornada_creditar_dica(p_post uuid, p_tipo text)
    returns jsonb language plpgsql set search_path = '' as $f$
    begin raise exception 'motor quebrado'; end; $f$;
  `);
  e = await curtir(db, B, DICA2);
  ok(
    "crédito falhou: a curtida grava sem erro",
    !e && (await curtidas(db, DICA2)) === 1 && (await ajudou(db)) === 3,
    e
  );
  ok(
    "e o par não fica guardado",
    !(await um(
      db,
      `select 1 as x from private.jornada_dica_creditos where post_id = '${DICA2}'`
    ))
  );
  await db.exec(`
    drop function private.jornada_creditar_dica(uuid, text);
    alter function private.jornada_creditar_dica_ok(uuid, text) rename to jornada_creditar_dica;
  `);
  await descurtir(db, B, DICA2);
  e = await curtir(db, B, DICA2);
  ok("motor de volta: a nova curtida credita", !e && (await ajudou(db)) === 4, e);

  // Aplicar duas vezes não quebra nem duplica o gatilho.
  try {
    await db.exec(readFileSync(join(DIR, A0047), "utf-8"));
    const n = await um(
      db,
      `select count(*)::int n from pg_trigger
       where tgrelid = 'public.rede_curtidas'::regclass and tgname = 'rede_curtidas_credita_dica'`
    );
    ok("rodar a 0047 de novo não quebra (1 gatilho)", n.n === 1, n);
  } catch (err) {
    ok("rodar a 0047 de novo não quebra", false, err.message);
  }

  // Apagar o post leva junto os pares.
  await db.exec(`delete from public.rede_posts where id = '${DICA}'`);
  ok(
    "apagar a dica apaga os pares dela",
    !(await um(
      db,
      `select 1 as x from private.jornada_dica_creditos where post_id = '${DICA}'`
    ))
  );
  await db.close();
}

console.log(falhas ? `${falhas} falha(s)` : "migration 0047: tudo certo");
process.exit(falhas ? 1 : 0);
