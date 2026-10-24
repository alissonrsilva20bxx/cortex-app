// Bug C do ESTADO, lado do Postgres (PGlite, Postgres de verdade em
// memória, com o mesmo "Supabase de mentira" do
// tests/jornada/dica-curtida-0047-pglite.mjs). Testa os DOIS caminhos, cada
// um num banco limpo:
//   1. sem a 0042 e a 0044 (pode ser o banco de hoje): o Postgres recusa a
//      coluna `prazo` (42703) e a tabela `guardar_historico` (42P01), os
//      erros que lib/bancoSemMigracao.ts reconhece; criar o Desejo sem prazo
//      e somar em `valor_atual` (o que o app faz nesse caso) funcionam pela
//      sessão; e a "Meta atual" da Jornada (`jornada_estado`, 0036/0039) lê
//      o valor guardado;
//   2. com tudo aplicado: prazo e histórico gravam, e a Jornada lê igual.
// NÃO aplica nada em lugar nenhum: é um Postgres em memória.
// Uso (o mesmo do motor):
//   npx -y -p @electric-sql/pglite@0.2 node tests/desejo/desejo-sem-migracoes-pglite.mjs supabase/migrations
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.argv[2] ?? "supabase/migrations";
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
// As migrations do Desejo/Guardar e as que dependem delas (0045 só cria
// índices em guardar_historico).
const DO_DESEJO = /^004[245]_/;

const ELA = "aaaaaaaa-0000-4000-8000-00000000000a";
const DESEJO = "33333333-0000-4000-8000-000000000001";

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
  await db.exec(`
    insert into auth.users (id, email) values ('${ELA}', 'ela@x');
    insert into public.rede_convites (codigo_hash, usado_por, usado_em, expira_em)
      values ('h0', '${ELA}', now(), now() + interval '1 day');
    insert into public.rede_perfis (user_id, nome_exibicao, cor_avatar)
      values ('${ELA}', 'Ela', '#FF7AB6');
  `);
  return db;
}

/** Roda `sql` como a sessão (authenticated) dela. Devolve { erro, codigo, linhas }. */
async function como(db, sql) {
  await db.exec(`
    select set_config('request.jwt.claims', '${JSON.stringify({ role: "authenticated", sub: ELA })}', false);
    select set_config('request.jwt.claim.sub', '${ELA}', false);
    set role authenticated;`);
  try {
    const r = await db.query(sql);
    return { erro: null, codigo: null, linhas: r.rows };
  } catch (e) {
    return { erro: e.message, codigo: e.code ?? null, linhas: [] };
  } finally {
    await db.exec("reset role;");
  }
}

// O SQL que o PostgREST gera para o que o app pede.
const criarComPrazo = `insert into public.rede_wishlist_items (id, user_id, nome, cor, valor_alvo, prazo)
  values ('${DESEJO}', '${ELA}', 'Cadeira', '#FF7AB6', 300, '2026-12-24') returning *`;
const criarSemPrazo = `insert into public.rede_wishlist_items (id, user_id, nome, cor, valor_alvo)
  values ('${DESEJO}', '${ELA}', 'Cadeira', '#FF7AB6', 300) returning *`;
const historico = `insert into public.guardar_historico (user_id, desejo_id, valor)
  values ('${ELA}', '${DESEJO}', 120) returning id`;
const somar = (v) => `update public.rede_wishlist_items set valor_atual = ${v}
  where id = '${DESEJO}' and user_id = '${ELA}' returning valor_atual`;
const estado = `select public.jornada_estado('Europe/Lisbon', 0) as e`;

async function metaDaJornada(db) {
  const r = await como(db, estado);
  return { erro: r.erro, meta: r.linhas[0]?.e?.dinheiro?.meta ?? null };
}

// ── 1. Sem a 0042 e a 0044 ──────────────────────────────────────
console.log("-- caminho 1: sem a 0042 e a 0044");
{
  const db = await banco(todos.filter((f) => !DO_DESEJO.test(f)));
  const p = await como(db, criarComPrazo);
  ok("criar com prazo é recusado com 42703 (coluna prazo)", p.codigo === "42703" && /prazo/.test(p.erro), p);
  const c = await como(db, criarSemPrazo);
  ok("criar sem prazo grava pela sessão", !c.erro && c.linhas.length === 1, c.erro);
  const h = await como(db, historico);
  ok("histórico é recusado com 42P01 (guardar_historico)", h.codigo === "42P01" && /guardar_historico/.test(h.erro), h);
  const s = await como(db, somar(120));
  ok("somar em valor_atual grava pela sessão", !s.erro && Number(s.linhas[0]?.valor_atual) === 120, s.erro);
  const j = await metaDaJornada(db);
  ok(
    "a Meta atual da Jornada lê o Desejo com 120",
    !j.erro && j.meta?.nome === "Cadeira" && Number(j.meta?.atual) === 120 && Number(j.meta?.alvo) === 300,
    j
  );
  await db.close();
}

// ── 2. Com tudo aplicado ────────────────────────────────────────
console.log("-- caminho 2: com a 0042 e a 0044");
{
  const db = await banco(todos);
  const c = await como(db, criarComPrazo);
  ok("criar com prazo grava", !c.erro && String(c.linhas[0]?.prazo ?? "").length > 0, c.erro);
  const h = await como(db, historico);
  ok("histórico grava pela sessão", !h.erro && h.linhas.length === 1, h.erro);
  const s = await como(db, somar(120));
  ok("somar em valor_atual grava", !s.erro, s.erro);
  const j = await metaDaJornada(db);
  ok("a Meta atual da Jornada lê o Desejo com 120", !j.erro && Number(j.meta?.atual) === 120, j);
  await db.close();
}

console.log(falhas ? `${falhas} FALHA(S)` : "tudo certo");
process.exit(falhas ? 1 : 0);
