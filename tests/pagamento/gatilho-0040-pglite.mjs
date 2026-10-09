// Migration 0040 (assinatura só pelo servidor) junto do motor de migrations:
// num Postgres de verdade (PGlite), com o mesmo "Supabase de mentira" do
// tests/jornada/motor-pglite.mjs (papéis, auth.users, auth.uid()), aplica
// TODAS as migrations do repositório e testa o gatilho na tabela real
// `configuracoes`, com a RLS de verdade (policy "owner full access"):
//   - a sessão da usuária (authenticated/anon) não muda assinatura_status
//     nem trial_started_at, e o resto da linha muda;
//   - a sessão não APAGA a própria linha (antes dava para apagar e inserir
//     de novo, recomeçando o teste);
//   - inserir pela sessão nasce 'trial' com o teste contado do CADASTRO da
//     conta (auth.users.created_at), nunca de agora;
//   - o service role (webhook do Stripe) e o próprio banco mudam.
// NÃO aplica nada em lugar nenhum: é um Postgres em memória.
// Uso (o mesmo do motor):
//   npx -y -p @electric-sql/pglite@0.2 node tests/pagamento/gatilho-0040-pglite.mjs supabase/migrations
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.argv[2] ?? "supabase/migrations";
const db = new PGlite();
await db.exec(`
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
`);

let falhas = 0;
const arquivos = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
for (const f of arquivos) {
  try {
    await db.exec(readFileSync(join(DIR, f), "utf-8"));
  } catch (e) {
    falhas++;
    console.log(`ERRO  ${f}: ${e.message}`);
  }
}
console.log(
  `migrations: ${arquivos.length - falhas}/${arquivos.length} aplicadas sem erro`
);
if (falhas) process.exit(1);
if (!arquivos.includes("0040_assinatura_so_servidor.sql")) {
  console.log("FALHA a 0040 não está no diretório");
  process.exit(1);
}
// O Supabase dá às sessões acesso às tabelas (a RLS é que filtra).
await db.exec(
  "grant all on all tables in schema public to anon, authenticated, service_role;"
);

const U1 = "11111111-1111-1111-1111-111111111111";
const U2 = "22222222-2222-2222-2222-222222222222";
const ok = (n, c, x) => {
  if (!c) falhas++;
  console.log(
    `${c ? "PASSA" : "FALHA"} ${n} ${x === undefined ? "" : JSON.stringify(x)}`
  );
};

/** Roda `sql` como o papel `papel` com a sessão da conta `uid`. */
async function como(papel, uid, sql) {
  await db.exec(`
    select set_config('request.jwt.claims', '${JSON.stringify({ role: papel, sub: uid ?? "" })}', false);
    select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);
    set role ${papel};`);
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return e.message;
  } finally {
    await db.exec("reset role;");
  }
}
async function semJwt(sql) {
  await db.exec(
    "select set_config('request.jwt.claims', '', false); select set_config('request.jwt.claim.sub', '', false);"
  );
  await db.exec(sql);
}
const linha = async (uid) =>
  (
    await db.query(
      `select assinatura_status::text, trial_started_at::date::text d, pin_hash from configuracoes where user_id = '${uid}'`
    )
  ).rows[0];

// Cadastro (handle_new_user cria a linha de configuracoes).
await semJwt(
  `insert into auth.users (id, email, created_at) values ('${U1}', 'a@b.c', '2026-10-01'), ('${U2}', 'c@d.e', '2026-10-05');
   update configuracoes set trial_started_at = '2026-10-01' where user_id = '${U1}';`
);

let e = await como(
  "authenticated",
  U1,
  `update configuracoes set assinatura_status='ativa', trial_started_at='2099-01-01', pin_hash='abc' where user_id='${U1}'`
);
let r = await linha(U1);
ok(
  "sessão da usuária não se dá a assinatura nem estica o teste; o resto da linha muda",
  !e &&
    r.assinatura_status === "trial" &&
    r.d === "2026-10-01" &&
    r.pin_hash === "abc",
  { erro: e, linha: r }
);

e = await como(
  "anon",
  null,
  `update configuracoes set assinatura_status='ativa' where user_id='${U1}'`
);
r = await linha(U1);
ok("anon também não", r.assinatura_status === "trial", r);

// A brecha que a revisão achou: apagar e inserir de novo recomeçava o teste.
e = await como(
  "authenticated",
  U1,
  `delete from configuracoes where user_id='${U1}'`
);
r = await linha(U1);
ok(
  "a sessão NÃO apaga a própria linha (o teste não recomeça)",
  Boolean(e) && r && r.d === "2026-10-01",
  { erro: e, linha: r }
);

// Se a linha sumir por outro caminho, inserir pela sessão usa o cadastro.
await semJwt(`delete from configuracoes where user_id='${U2}'`);
e = await como(
  "authenticated",
  U2,
  `insert into configuracoes (user_id, assinatura_status, trial_started_at) values ('${U2}', 'ativa', '2099-01-01')`
);
r = await linha(U2);
ok(
  "inserir pela sessão nasce 'trial' e o teste conta do cadastro (05/10), não de hoje",
  !e && r && r.assinatura_status === "trial" && r.d === "2026-10-05",
  { erro: e, linha: r }
);

e = await como(
  "service_role",
  null,
  `update configuracoes set assinatura_status='ativa' where user_id='${U1}'`
);
r = await linha(U1);
ok(
  "service role (webhook do Stripe) muda",
  !e && r.assinatura_status === "ativa",
  {
    erro: e,
    linha: r,
  }
);

e = await como(
  "service_role",
  null,
  `delete from configuracoes where user_id='${U2}'`
);
ok("service role apaga (limpeza do servidor)", !e && !(await linha(U2)), e);

await semJwt(
  `update configuracoes set assinatura_status='vencida' where user_id='${U1}'`
);
r = await linha(U1);
ok(
  "o próprio banco (sem JWT: SQL Editor, handle_new_user) muda",
  r.assinatura_status === "vencida",
  r
);

console.log(falhas ? `${falhas} falha(s)` : "gatilho 0040: tudo certo");
process.exit(falhas ? 1 : 0);
