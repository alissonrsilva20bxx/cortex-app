// Migration 0048 (desfazer o descanso de hoje) num Postgres de verdade
// (PGlite), com o mesmo "Supabase de mentira" do
// tests/jornada/dica-curtida-0047-pglite.mjs (papéis, auth.users,
// auth.uid()). Testa os DOIS caminhos, cada um num banco limpo:
//   1. sem a 0048 (como o banco está hoje): o descanso de hoje conta pela
//      sessão como o app manda (chave fixa do dia); a RPC de desfazer não
//      existe e a chamada falha (o app então desfaz só no aparelho), sem
//      mexer no que já contou;
//   2. com a 0048: desfazer tira o Glow (saldo, pilar e período), os
//      contadores e a marca do ritmo; marcar de novo hoje conta outra vez,
//      uma vez só (mesma chave e outra chave não somam); desfazer de novo
//      não muda nada; dia forte continua forte; sem sessão é recusado; a
//      outra conta não é afetada;
//   3. com a 0048: o descanso de ontem não é desfeito (só o de hoje).
// NÃO aplica nada em lugar nenhum: é um Postgres em memória.
// Uso (o mesmo do motor):
//   npx -y -p @electric-sql/pglite@0.2 node tests/jornada/desfazer-descanso-0048-pglite.mjs supabase/migrations
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.argv[2] ?? "supabase/migrations";
const A0048 = "0048_jornada_desfazer_descanso.sql";
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
if (!todos.includes(A0048)) {
  console.log(`FALHA a ${A0048} não está no diretório`);
  process.exit(1);
}

const ELA = "aaaaaaaa-0000-4000-8000-00000000000a";
const OUTRA = "bbbbbbbb-0000-4000-8000-00000000000b";

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
  await db.exec(`insert into auth.users (id, email) values
    ('${ELA}', 'ela@x'), ('${OUTRA}', 'outra@x');`);
  return db;
}

/** Roda `sql` como a sessão (authenticated) da conta `uid` (null = sem
 * sessão). Devolve { linha, erro }. */
async function como(db, uid, sql) {
  await db.exec(`
    select set_config('request.jwt.claims', '${JSON.stringify({ role: "authenticated", sub: uid ?? "" })}', false);
    select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);
    set role authenticated;`);
  try {
    return { linha: (await db.query(sql)).rows[0], erro: null };
  } catch (e) {
    return { linha: null, erro: e.message };
  } finally {
    await db.exec("reset role;");
  }
}

const hoje = async (db) =>
  (await db.query(`select (now() at time zone 'UTC')::date::text d`)).rows[0].d;
// O mesmo que o app manda: registrarNoServidor e desfazerDescansoNoServidor
// (lib/jornada/servidor.ts), com o fuso "UTC" e deslocamento 0.
const registrar = (db, uid, acao, chave) =>
  como(db, uid, `select public.jornada_registrar('${acao}', '${chave}', 'UTC', 0) r`);
const desfazer = (db, uid) =>
  como(db, uid, `select public.jornada_desfazer_descanso('UTC', 0) r`);

const um = async (db, sql) => (await db.query(sql)).rows[0];
const glow = async (db, uid = ELA) =>
  (await um(db, `select coalesce((select glow_total from public.jornada_saldo where user_id = '${uid}'), 0)::int n`)).n;
const proteger = async (db) =>
  (await um(db, `select coalesce((select glow_proteger from public.jornada_saldo where user_id = '${ELA}'), 0)::int n`)).n;
const diasDescanso = async (db) =>
  (await um(db, `select coalesce((select total from public.jornada_contadores where user_id = '${ELA}' and chave = 'dias_descanso'), 0)::int n`)).n;
const periodo = async (db, chave) =>
  (await um(db, `select coalesce((select (contadores ->> '${chave}')::int from public.jornada_periodos where user_id = '${ELA}' and tipo = 'semana' and not fechado), 0)::int n`)).n;
const marcaDeHoje = async (db, d) =>
  (await um(db, `select coalesce((select marca from public.jornada_semana_dias where user_id = '${ELA}' and dia = '${d}'), '') m`)).m;
const feitas = (r) => r?.linha?.r?.estado?.feitasHoje ?? r?.linha?.r?.feitasHoje ?? {};

// ── 1. Sem a 0048 (o banco de hoje) ─────────────────────────────
console.log("-- caminho 1: sem a 0048");
{
  const db = await banco(todos.filter((f) => f !== A0048));
  const d = await hoje(db);
  const r = await registrar(db, ELA, "descanso", `descanso-${d}`);
  ok("o descanso de hoje conta (chave fixa do dia)", !r.erro && feitas(r).descanso === 1, r.erro);
  const g = await glow(db);
  ok("e dá Glow", g >= 10, g);
  const x = await desfazer(db, ELA);
  ok("desfazer falha: a RPC não existe (o app desfaz só no aparelho)", /jornada_desfazer_descanso/.test(x.erro ?? ""), x.erro);
  ok("e nada do que contou muda", (await glow(db)) === g && (await diasDescanso(db)) === 1);
  const r2 = await registrar(db, ELA, "descanso", `descanso-${d}`);
  ok("marcar de novo hoje (mesma chave) não conta duas vezes", r2.linha?.r?.duplicada === true && (await glow(db)) === g, r2.linha?.r?.duplicada);
  await db.close();
}

// ── 2. Com a 0048 ───────────────────────────────────────────────
console.log("-- caminho 2: com a 0048");
{
  const db = await banco(todos);
  const d = await hoje(db);
  const chave = `descanso-${d}`;

  const semSessao = await desfazer(db, null);
  ok("sem sessão é recusado", /sem sessão/.test(semSessao.erro ?? ""), semSessao.erro);

  const vazio = await desfazer(db, ELA);
  ok("sem descanso hoje, desfazer não muda nada", !vazio.erro && (await glow(db)) === 0, vazio.erro);

  const r = await registrar(db, ELA, "descanso", chave);
  const g1 = await glow(db);
  const p1 = await proteger(db);
  const pg1 = await periodo(db, "glow");
  ok("marcar: conta", !r.erro && feitas(r).descanso === 1, r.erro);
  ok("marcar: dias_descanso 1, período 1, marca descanso", (await diasDescanso(db)) === 1 && (await periodo(db, "descanso")) === 1 && (await marcaDeHoje(db, d)) === "descanso");

  const x = await desfazer(db, ELA);
  ok("desfazer: sem erro e hoje sai de feitasHoje", !x.erro && feitas(x).descanso === undefined, x.erro ?? feitas(x));
  ok("desfazer: tira os 10 de Glow do saldo e do pilar", (await glow(db)) === g1 - 10 && (await proteger(db)) === p1 - 10, [g1, await glow(db)]);
  ok("desfazer: tira o Glow do período", (await periodo(db, "glow")) === pg1 - 10, [pg1, await periodo(db, "glow")]);
  ok("desfazer: dias_descanso 0, período 0, sem marca no ritmo", (await diasDescanso(db)) === 0 && (await periodo(db, "descanso")) === 0 && (await marcaDeHoje(db, d)) === "");
  const semana = x.linha?.r?.semana?.dias ?? [];
  ok("desfazer: o estado devolvido não tem descanso no ritmo", !semana.includes("descanso"), semana);

  const r2 = await registrar(db, ELA, "descanso", chave);
  ok("marcar de novo hoje (mesma chave) conta outra vez", !r2.erro && r2.linha?.r?.duplicada !== true && feitas(r2).descanso === 1, r2.erro);
  ok("e só os 10 da ação (selo já ganho não volta a ser dado)", (await glow(db)) === g1, [g1, await glow(db)]);
  await registrar(db, ELA, "descanso", chave);
  await registrar(db, ELA, "descanso", "descanso-outra-chave");
  ok("marcar de novo (mesma ou outra chave) não soma: um por dia", (await glow(db)) === g1 && (await diasDescanso(db)) === 1, await glow(db));

  await desfazer(db, ELA);
  const g2 = await glow(db);
  await desfazer(db, ELA);
  ok("desfazer duas vezes: a segunda não muda nada", (await glow(db)) === g2 && g2 === g1 - 10 && (await diasDescanso(db)) === 0, [g1, g2]);

  // Dia forte continua forte.
  await registrar(db, ELA, "despesa", "despesa-0001");
  await registrar(db, ELA, "descanso", chave);
  ok("com dia forte, o descanso conta e a marca segue forte", (await marcaDeHoje(db, d)) === "forte" && (await diasDescanso(db)) === 1);
  await desfazer(db, ELA);
  ok("desfazer não tira o dia forte", (await marcaDeHoje(db, d)) === "forte" && (await diasDescanso(db)) === 0);

  // A outra conta não é afetada.
  await registrar(db, OUTRA, "descanso", chave);
  const go = await glow(db, OUTRA);
  await desfazer(db, ELA);
  ok("desfazer de uma conta não mexe na outra", (await glow(db, OUTRA)) === go && go >= 10, go);

  const direto = await como(db, ELA, `select private.jornada_somar_glow('${ELA}', 'proteger', 1)`);
  ok("a sessão não chama as funções internas", !!direto.erro, direto.erro);
  await db.close();
}

// ── 3. Com a 0048: só o descanso de HOJE ───────────────────────
console.log("-- caminho 3: descanso de ontem");
{
  const db = await banco(todos);
  const d = await hoje(db);
  const chave = `descanso-${d}`;

  // O descanso contou ONTEM (como o servidor guarda: dia e ganhos_no_dia),
  // com a chave daquele dia.
  await registrar(db, ELA, "descanso", "descanso-ontem");
  await db.exec(`
    update public.jornada_acoes set dia = dia - 1
    where user_id = '${ELA}' and acao = 'descanso';
    update public.jornada_semana_dias set dia = dia - 1
    where user_id = '${ELA}' and marca = 'descanso';`);
  const g0 = await glow(db);
  const x = await desfazer(db, ELA);
  ok(
    "descanso de ontem: desfazer hoje não tira nada (só o de hoje desfaz)",
    !x.erro && (await glow(db)) === g0 && (await diasDescanso(db)) === 1 && (await periodo(db, "descanso")) === 1,
    [g0, await glow(db), await diasDescanso(db)]
  );

  await db.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO PASSA");
process.exit(falhas ? 1 : 0);
