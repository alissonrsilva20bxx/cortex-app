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
//      a 0049 aplica de novo depois dele; com uma conta excluída entre o
//      rollback e a 0049, o Desejo dela some junto e tudo aplica de novo;
//   D. sem a 0040, a 0049 para com erro e não aplica nada;
//   E. com a 0040 desligada ou incompleta (um gatilho fora, desligado, com
//      outra função ou sem o update), a 0049 também para.
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

/** Um Postgres novo com as migrations (menos as de `pular`). `antes`: SQL
 * de administrador rodado logo antes de uma migration ({ arquivo: sql }). */
async function banco(pular = [], antes = {}) {
  const db = new PGlite();
  await db.exec(BASE);
  const erros = {};
  for (const f of arquivos) {
    if (pular.includes(f)) continue;
    try {
      if (antes[f]) await db.exec(antes[f]);
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

// Desejos são de Finanças, não da Rede: com o teste acabado (V, sem perfil
// na Rede), a dona cria, lê, edita e apaga os próprios Desejos. Ninguém lê
// nem mexe no Desejo de outra. Criar Desejo não cria perfil na Rede, e
// publicar no feed segue exigindo a Rede.
const desejo = (uid, sql) => como("authenticated", uid, sql);
r = await desejo(
  V,
  `insert into public.rede_wishlist_items (user_id, nome, cor, valor_alvo) values ('${V}', 'Cadeira', '#000', 500) returning id`
);
ok("Desejo: teste acabou, sem perfil, cria o próprio", !r.erro, r.erro);
const DV = r.linhas[0]?.id;
r = await desejo(
  V,
  "select count(*)::int as n from public.rede_wishlist_items"
);
ok("Desejo: teste acabou, lê o próprio", r.linhas[0]?.n === 1, r);
r = await desejo(
  V,
  `update public.rede_wishlist_items set nome = 'Cadeira nova', valor_alvo = 600 where id = '${DV}' returning nome`
);
ok(
  "Desejo: teste acabou, edita o próprio",
  r.linhas[0]?.nome === "Cadeira nova",
  r
);
r = await desejo(
  V,
  `insert into public.guardar_historico (user_id, desejo_id, valor) values ('${V}', '${DV}', 50)`
);
ok("Desejo: teste acabou, guarda dinheiro no próprio", !r.erro, r.erro);
r = await desejo(
  T1,
  "select count(*)::int as n from public.rede_wishlist_items"
);
ok("Desejo: outra (na Rede) não lê o Desejo de V", r.linhas[0]?.n === 0, r);
r = await desejo(
  T1,
  `update public.rede_wishlist_items set nome = 'x' where id = '${DV}' returning id`
);
ok("Desejo: outra não edita o Desejo de V", r.linhas.length === 0, r);
r = await desejo(
  T1,
  `delete from public.rede_wishlist_items where id = '${DV}' returning id`
);
ok("Desejo: outra não apaga o Desejo de V", r.linhas.length === 0, r);
r = await desejo(
  T1,
  `insert into public.rede_wishlist_items (user_id, nome, cor, valor_alvo) values ('${V}', 'Forjado', '#000', 1)`
);
ok("Desejo: outra não cria Desejo em nome de V", Boolean(r.erro), r.erro);
r = await desejo(
  V,
  `insert into public.rede_wishlist_items (user_id, nome, cor, valor_alvo) values ('${T1}', 'Forjado', '#000', 1)`
);
ok("Desejo: V não cria Desejo em nome de outra", Boolean(r.erro), r.erro);
r = await semJwt(
  `select (select count(*)::int from public.rede_perfis where user_id = '${V}') as perfis`
);
ok(
  "Desejo: criar Desejo não põe V na Rede (sem perfil, fora)",
  r.rows[0].perfis === 0 && (await membro(V)) === false,
  r.rows[0]
);
r = await desejo(
  V,
  `insert into public.rede_posts (autor_id, categoria, texto) values ('${V}', 'dica', 'Compartilhando meu Desejo')`
);
ok("Desejo: teste acabou, não compartilha no feed", Boolean(r.erro), r.erro);
r = await desejo(
  T1,
  `insert into public.rede_wishlist_items (user_id, nome, cor, valor_alvo) values ('${T1}', 'Viagem', '#000', 900)`
);
ok("Desejo: no teste, sem perfil, também cria", !r.erro, r.erro);
r = await desejo(
  V,
  `delete from public.rede_wishlist_items where id = '${DV}' returning id`
);
ok("Desejo: teste acabou, apaga o próprio", r.linhas.length === 1, r);
r = await desejo(
  V,
  `insert into public.rede_wishlist_items (user_id, nome, cor, valor_alvo) values ('${V}', 'Fica', '#000', 100)`
);
ok("Desejo: V cria outro (para o rollback)", !r.erro, r.erro);

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
  V,
  "select count(*)::int as n from public.rede_wishlist_items"
);
ok(
  "rollback: o Desejo de V continua lá (nada apagado)",
  r.linhas[0]?.n === 1,
  r
);
r = await como(
  "authenticated",
  V,
  `insert into public.rede_wishlist_items (user_id, nome, cor, valor_alvo) values ('${V}', 'Novo', '#000', 1)`
);
ok("rollback: criar Desejo volta a exigir a Rede", Boolean(r.erro), r.erro);
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
  r = await como(
    "authenticated",
    V,
    `insert into public.rede_wishlist_items (user_id, nome, cor, valor_alvo) values ('${V}', 'De novo', '#000', 1)`
  );
  ok("0049 de novo: teste acabou cria Desejo", !r.erro, r.erro);
} catch (e) {
  ok("0049 aplica de novo depois do rollback", false, e.message);
}

// ── C2. conta excluída entre o rollback e a 0049 de novo ──
// O rollback deixa o Desejo de quem não tem perfil (nada apagado), mas ele
// segue preso à conta: excluir a conta apaga o Desejo (sem órfão), e a 0049
// e o rollback aplicam de novo sem erro.
const fkConta = () =>
  semJwt(
    "select coalesce(array_agg(conname::text order by conname), '{}') as nomes from pg_constraint where conrelid = 'public.rede_wishlist_items'::regclass and contype = 'f' and confrelid = 'auth.users'::regclass"
  ).then((x) => x.rows[0].nomes);
const X = await conta({ status: "vencida", inicio: dias(40) });
r = await desejo(
  X,
  `insert into public.rede_wishlist_items (user_id, nome, cor, valor_alvo) values ('${X}', 'Mesa', '#000', 300) returning id`
);
ok("ciclo: sem perfil, cria Desejo com a 0049", !r.erro, r.erro);
const DX = r.linhas[0]?.id;
const contaDesejo = async () =>
  (
    await semJwt(
      `select count(*)::int as n from public.rede_wishlist_items where id = '${DX}'`
    )
  ).rows[0].n;
try {
  await db.exec(readFileSync(ROLLBACK, "utf-8"));
  ok("ciclo: rollback deixa o Desejo", (await contaDesejo()) === 1);
  await semJwt(`delete from auth.users where id = '${X}'`);
  ok(
    "ciclo: excluir a conta depois do rollback apaga o Desejo (sem órfão)",
    (await contaDesejo()) === 0
  );
} catch (e) {
  ok("ciclo: rollback e exclusão da conta", false, e.message);
}
try {
  await db.exec(
    readFileSync(join(DIR, "0049_rede_acesso_por_teste.sql"), "utf-8")
  );
  const nomes = await fkConta();
  ok(
    "ciclo: 0049 aplica de novo, com uma só chave para a conta",
    nomes.length === 1 && nomes[0] === "rede_wishlist_items_user_id_fkey",
    nomes
  );
} catch (e) {
  ok("ciclo: 0049 aplica de novo depois da conta excluída", false, e.message);
}
try {
  await db.exec(readFileSync(ROLLBACK, "utf-8"));
  const nomes = await fkConta();
  ok(
    "ciclo: rollback de novo, com a chave direta para a conta",
    nomes.length === 1 && nomes[0] === "rede_wishlist_items_user_id_conta_fkey",
    nomes
  );
} catch (e) {
  ok("ciclo: rollback de novo", false, e.message);
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

// ── E. a 0040 aplicada mas desligada ou incompleta: a 0049 também para ──
// A guarda confere os DOIS gatilhos da 0040, ligados (pg_trigger.tgenabled),
// na tabela certa, com a função certa e os eventos certos.
const ANTES_0049 = "0049_rede_acesso_por_teste.sql";
for (const [caso, sql] of [
  [
    "gatilho da assinatura desligado",
    "alter table public.configuracoes disable trigger configuracoes_assinatura_so_servidor;",
  ],
  [
    "gatilho da assinatura só em réplica",
    "alter table public.configuracoes enable replica trigger configuracoes_assinatura_so_servidor;",
  ],
  [
    "gatilho do delete ausente",
    "drop trigger configuracoes_sem_delete_pela_sessao on public.configuracoes;",
  ],
  [
    "gatilho do delete desligado",
    "alter table public.configuracoes disable trigger configuracoes_sem_delete_pela_sessao;",
  ],
  [
    "gatilho da assinatura com outra função",
    `drop trigger configuracoes_assinatura_so_servidor on public.configuracoes;
     create function public.gatilho_que_deixa_passar() returns trigger
       language plpgsql as $$ begin return new; end; $$;
     create trigger configuracoes_assinatura_so_servidor
       before insert or update on public.configuracoes
       for each row execute function public.gatilho_que_deixa_passar();`,
  ],
  [
    "gatilho da assinatura só no insert (sem update)",
    `drop trigger configuracoes_assinatura_so_servidor on public.configuracoes;
     create trigger configuracoes_assinatura_so_servidor
       before insert on public.configuracoes
       for each row execute function public.configuracoes_assinatura_so_servidor();`,
  ],
]) {
  const b = await banco([], { [ANTES_0049]: sql });
  const erro = b.erros[ANTES_0049] ?? "";
  const outrosErros = Object.keys(b.erros).filter((f) => f !== ANTES_0049);
  const f = await b.db.query(
    "select count(*)::int as f from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'private' and p.proname like 'rede_usuario_e_membro%'"
  );
  ok(
    `0040 ${caso}: a 0049 para com o aviso e não cria nada`,
    /aplique antes a 0040/.test(erro) &&
      outrosErros.length === 0 &&
      f.rows[0].f === 0,
    { erro, outrosErros, funcoes: f.rows[0].f }
  );
}
// O "ligado sempre" (enable always) também protege: a 0049 aplica.
{
  const b = await banco([], {
    [ANTES_0049]:
      "alter table public.configuracoes enable always trigger configuracoes_assinatura_so_servidor;",
  });
  ok(
    "0040 com gatilho ligado sempre (always): a 0049 aplica",
    Object.keys(b.erros).length === 0,
    b.erros
  );
}

console.log(falhas ? `${falhas} falha(s)` : "0049: tudo certo");
process.exit(falhas ? 1 : 0);
