// Migration 0049 (entrada na Rede pelo teste ou pela assinatura) num
// Postgres de verdade (PGlite), com o mesmo "Supabase de mentira" do
// tests/pagamento/gatilho-0040-pglite.mjs (papéis, auth.users, auth.uid()).
// Aplica TODAS as migrations do repositório e confere:
//   A. a regra por pessoa com a MESMA tabela de casos do app
//      (tests/rede/casos-acesso-rede.json, num instante fixo);
//   B. a RLS de verdade: quem está no teste entra sem convite, quem passou
//      do teste não, convite antigo e assinatura entram; N1 (conversa e
//      denúncia olham a outra pessoa pela regra); a 0040 impede esticar o
//      teste; código e beta não são mais chamáveis pela sessão;
//   C. o rollback (supabase/migrations-rollback) volta ao "só convite", e
//      a 0049 aplica de novo depois dele;
//   D. sem a 0040, a 0049 para com erro e não aplica nada.
// NÃO aplica nada em lugar nenhum: é um Postgres em memória.
// Uso (da raiz do repositório):
//   npx -y -p @electric-sql/pglite@0.2 node tests/rede/acesso-0049-pglite.mjs .
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.argv[2] ?? ".";
const DIR = join(RAIZ, "supabase/migrations");
const ROLLBACK = join(
  RAIZ,
  "supabase/migrations-rollback/0049_rede_acesso_por_teste.rollback.sql"
);
const CASOS = JSON.parse(
  readFileSync(join(RAIZ, "tests/rede/casos-acesso-rede.json"), "utf-8")
);

const BASE = `
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
-- Como o Supabase: toda tabela e função nova nasce com grant para os
-- papéis da API; as migrations revogam o que não querem (a RLS filtra).
alter default privileges grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const arquivos = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** Um Postgres novo com as migrations (menos as de `pular`). */
async function banco(pular = []) {
  const db = new PGlite();
  await db.exec(BASE);
  const erros = {};
  for (const f of arquivos) {
    if (pular.includes(f)) continue;
    try {
      await db.exec(readFileSync(join(DIR, f), "utf-8"));
    } catch (e) {
      erros[f] = e.message;
    }
  }
  return { db, erros };
}

let falhas = 0;
const ok = (n, c, x) => {
  if (!c) falhas++;
  console.log(
    `${c ? "PASSA" : "FALHA"} ${n} ${x === undefined ? "" : JSON.stringify(x)}`
  );
};

const { db, erros } = await banco();
ok(
  `migrations: ${arquivos.length - Object.keys(erros).length}/${arquivos.length} aplicadas sem erro`,
  Object.keys(erros).length === 0,
  erros
);
if (!arquivos.includes("0049_rede_acesso_por_teste.sql")) {
  console.log("FALHA a 0049 não está no diretório");
  process.exit(1);
}

async function semJwt(sql) {
  await db.exec(
    "select set_config('request.jwt.claims', '', false); select set_config('request.jwt.claim.sub', '', false);"
  );
  return db.query(sql);
}
/** Roda `sql` como o papel `papel` com a sessão `uid`: { erro, linhas }. */
async function como(papel, uid, sql) {
  await db.exec(`
    select set_config('request.jwt.claims', '${JSON.stringify({ role: papel, sub: uid ?? "" })}', false);
    select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);
    set role ${papel};`);
  try {
    const r = await db.query(sql);
    return { erro: null, linhas: r.rows };
  } catch (e) {
    return { erro: e.message, linhas: [] };
  } finally {
    await db.exec("reset role;");
  }
}
const membro = async (uid) =>
  (await como("authenticated", uid, "select public.rede_is_member() as m"))
    .linhas[0]?.m;

let n = 0;
const novoId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

/** Conta com a linha de configuracoes do jeito pedido (null = sem linha). */
async function conta({ status, inicio, convite, perfil }) {
  const id = novoId();
  await semJwt(
    `insert into auth.users (id, email, created_at) values ('${id}', '${id}@t.t', ${inicio ? `'${inicio}'` : "now()"})`
  );
  if (status === null) {
    await semJwt(`delete from public.configuracoes where user_id = '${id}'`);
  } else {
    await semJwt(
      `update public.configuracoes set assinatura_status = '${status}', trial_started_at = '${inicio}' where user_id = '${id}'`
    );
  }
  if (convite) {
    await semJwt(
      `insert into public.rede_convites (codigo_hash, usado_por, usado_em, expira_em) values ('h-${id}', '${id}', now(), now() + interval '1 day')`
    );
  }
  if (perfil) {
    await semJwt(
      `insert into public.rede_perfis (user_id, nome_exibicao, cor_avatar) values ('${id}', 'P', '#000')`
    );
  }
  return id;
}

// ── A. a tabela de casos, no instante fixo da tabela ──
for (const c of CASOS.casos) {
  const id = await conta({
    status: c.assinatura_status,
    inicio: c.trial_started_at,
    convite: c.convite,
  });
  const r = await semJwt(
    `select private.rede_usuario_e_membro_em('${id}', '${CASOS.agora}') as m`
  );
  ok(`caso: ${c.nome}`, r.rows[0].m === (c.espera !== null), {
    banco: r.rows[0].m,
    espera: c.espera,
  });
}

// ── B. a RLS de verdade, com o relógio de agora ──
const dias = (k) => new Date(Date.now() - k * 86_400_000).toISOString();
const T1 = await conta({ status: "trial", inicio: dias(2) });
const T2 = await conta({ status: "trial", inicio: dias(1) });
const V = await conta({ status: "trial", inicio: dias(40) });
const VP = await conta({ status: "vencida", inicio: dias(40), perfil: true });
const C = await conta({ status: "trial", inicio: dias(40), convite: true });
const A = await conta({ status: "ativa", inicio: dias(40) });

ok("no teste, sem convite: está na Rede", (await membro(T1)) === true);
ok("teste acabou, sem convite: fora", (await membro(V)) === false);
ok("convite antigo depois do teste: dentro (N4)", (await membro(C)) === true);
ok("assinatura ativa: dentro", (await membro(A)) === true);

let r = await como(
  "authenticated",
  T1,
  `insert into public.rede_posts (autor_id, categoria, texto) values ('${T1}', 'dica', 'oi')`
);
ok("no teste publica no feed", !r.erro, r.erro);
r = await como(
  "authenticated",
  V,
  `insert into public.rede_posts (autor_id, categoria, texto) values ('${V}', 'dica', 'oi')`
);
ok("teste acabou: não publica", Boolean(r.erro), r.erro);
r = await como(
  "authenticated",
  T2,
  "select count(*)::int as n from public.rede_posts"
);
ok("outra no teste lê o feed", r.linhas[0]?.n === 1, r);
r = await como(
  "authenticated",
  V,
  "select count(*)::int as n from public.rede_posts"
);
ok("teste acabou: não lê o feed", r.linhas[0]?.n === 0, r);

// N1: conversa 1:1 olha a OUTRA pessoa pela regra.
r = await como(
  "authenticated",
  T1,
  `select public.rede_criar_conversa_1a1('${T2}') as id`
);
ok(
  "N1: duas no teste, sem convite, abrem conversa",
  !r.erro && r.linhas[0]?.id,
  r.erro
);
r = await como(
  "authenticated",
  T1,
  `select public.rede_criar_conversa_1a1('${V}') as id`
);
ok(
  "N1: com quem saiu da Rede, não abre",
  /participantes invalidos/.test(r.erro ?? ""),
  r.erro
);
r = await como(
  "authenticated",
  T1,
  `select public.rede_criar_conversa_1a1('${C}') as id`
);
ok("N1: com quem tem convite antigo, abre", !r.erro, r.erro);

// N1: denúncia de usuária.
const denuncia = (de, alvo) =>
  como(
    "authenticated",
    de,
    `insert into public.rede_denuncias (denunciante_id, alvo_tipo, alvo_id, motivo) values ('${de}', 'usuario', '${alvo}', 'spam')`
  );
r = await denuncia(T1, T2);
ok("N1: denuncia outra que está no teste", !r.erro, r.erro);
r = await denuncia(T1, VP);
ok("N1: denuncia quem já esteve na Rede (tem perfil)", !r.erro, r.erro);
r = await denuncia(T1, V);
ok("N1: quem nunca esteve na Rede não é alvo", Boolean(r.erro), r.erro);
r = await denuncia(V, T1);
ok("fora da Rede não denuncia", Boolean(r.erro), r.erro);

// N2: com a 0040, a sessão não estica o teste nem se dá a assinatura.
r = await como(
  "authenticated",
  V,
  `update public.configuracoes set trial_started_at = now(), assinatura_status = 'ativa' where user_id = '${V}'`
);
ok(
  "0040: a usuária fora da Rede não se coloca de volta",
  (await membro(V)) === false,
  r.erro
);

// Código e beta somem; a regra não fica exposta na API.
r = await como(
  "authenticated",
  T1,
  "select public.rede_resgatar_convite('x', 'y')"
);
ok(
  "resgatar código: recusado pela sessão",
  /permission denied/.test(r.erro ?? ""),
  r.erro
);
r = await como("authenticated", T1, "select public.rede_gerar_convite('x')");
ok(
  "gerar código: recusado pela sessão",
  /permission denied/.test(r.erro ?? ""),
  r.erro
);
r = await como(
  "authenticated",
  T1,
  `select public.rede_aprovar_solicitacao_beta('${T1}')`
);
ok(
  "aprovar beta: recusado pela sessão",
  /permission denied/.test(r.erro ?? ""),
  r.erro
);
r = await como("anon", null, "select public.rede_resgatar_convite('x', 'y')");
ok(
  "resgatar código: recusado para anon",
  /permission denied/.test(r.erro ?? ""),
  r.erro
);
r = await semJwt(
  "select has_function_privilege('service_role', 'public.rede_resgatar_convite(text, text)', 'execute') as p"
);
ok("o service role continua podendo", r.rows[0].p === true);
r = await como(
  "authenticated",
  T1,
  `select private.rede_usuario_e_membro('${A}')`
);
ok(
  "ninguém pergunta pela API se OUTRA pessoa assina",
  /permission denied/.test(r.erro ?? ""),
  r.erro
);

// ── C. rollback, e a 0049 de novo ──
await semJwt("select 1");
await db.exec(readFileSync(ROLLBACK, "utf-8"));
ok(
  "rollback: no teste sem convite volta a ficar fora",
  (await membro(T1)) === false
);
ok("rollback: convite antigo segue dentro", (await membro(C)) === true);
r = await como(
  "authenticated",
  T1,
  `select public.rede_criar_conversa_1a1('${T2}') as id`
);
ok("rollback: conversa volta a exigir convite", Boolean(r.erro), r.erro);
r = await semJwt(
  "select has_function_privilege('authenticated', 'public.rede_resgatar_convite(text, text)', 'execute') as p, (select count(*)::int from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'private' and p.proname like 'rede_usuario_e_membro%') as f"
);
ok(
  "rollback: resgatar volta para authenticated; funções novas apagadas",
  r.rows[0].p === true && r.rows[0].f === 0,
  r.rows[0]
);
try {
  await db.exec(
    readFileSync(join(DIR, "0049_rede_acesso_por_teste.sql"), "utf-8")
  );
  ok("0049 aplica de novo depois do rollback", (await membro(T1)) === true);
} catch (e) {
  ok("0049 aplica de novo depois do rollback", false, e.message);
}

// ── D. sem a 0040, a 0049 para e não aplica nada ──
const sem0040 = await banco(["0040_assinatura_so_servidor.sql"]);
const erro0049 = sem0040.erros["0049_rede_acesso_por_teste.sql"] ?? "";
const outros = Object.keys(sem0040.erros).filter(
  (f) => f !== "0049_rede_acesso_por_teste.sql"
);
const funcoes = await sem0040.db.query(
  "select count(*)::int as f from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'private' and p.proname like 'rede_usuario_e_membro%'"
);
ok(
  "sem a 0040: a 0049 para com o aviso e não cria nada",
  /aplique antes a 0040/.test(erro0049) &&
    outros.length === 0 &&
    funcoes.rows[0].f === 0,
  { erro0049, outros, funcoes: funcoes.rows[0].f }
);

console.log(falhas ? `${falhas} falha(s)` : "0049: tudo certo");
process.exit(falhas ? 1 : 0);
