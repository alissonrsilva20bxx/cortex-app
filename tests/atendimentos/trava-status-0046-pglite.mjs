// Migration 0046 (trava do status do atendimento) junto do motor de
// migrations: num Postgres de verdade (PGlite), com o mesmo "Supabase de
// mentira" do tests/pagamento/gatilho-0040-pglite.mjs (papéis, auth.users,
// auth.uid()), aplica TODAS as migrations do repositório e testa o gatilho
// na tabela real `jobs`, com a RLS de verdade:
//   - a sessão da usuária faz cada mudança que a tela faz (Novo, Editar,
//     Confirmar, Concluir, Não aconteceu, Cliente desmarcou);
//   - a sessão NÃO conclui atendimento futuro nem confirma depois do horário;
//   - a folga de fuso: o horário daqui a 10 h já se conclui (há fuso em que
//     já chegou), o de daqui a 20 h não;
//   - linha antiga fora da regra continua editável no que não é status,
//     data nem hora;
//   - o service role e o próprio banco (SQL Editor) não passam pela trava.
// NÃO aplica nada em lugar nenhum: é um Postgres em memória.
// Uso (o mesmo do motor):
//   npx -y -p @electric-sql/pglite@0.2 node tests/atendimentos/trava-status-0046-pglite.mjs supabase/migrations
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
if (!arquivos.includes("0046_jobs_trava_status.sql")) {
  console.log("FALHA a 0046 não está no diretório");
  process.exit(1);
}
await db.exec(
  "grant all on all tables in schema public to anon, authenticated, service_role;"
);

const U1 = "11111111-1111-1111-1111-111111111111";
const ok = (n, c, x) => {
  if (!c) falhas++;
  console.log(
    `${c ? "PASSA" : "FALHA"} ${n} ${x === undefined ? "" : JSON.stringify(x)}`
  );
};

/** Roda `sql` como o papel `papel` com a sessão da conta `uid`. Devolve a
 * mensagem de erro (ou null). */
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
const usuaria = (sql) => como("authenticated", U1, sql);
async function semJwt(sql) {
  await db.exec(
    "select set_config('request.jwt.claims', '', false); select set_config('request.jwt.claim.sub', '', false);"
  );
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return e.message;
  }
}
const RECUSA = "Este status não vale para o horário do atendimento.";

// Horários (o gatilho compara data + hora com agora em UTC).
const FUTURO = "current_date + 3, '10:00'"; // daqui a dias: antes em todo fuso
const PASSADO = "current_date - 3, '10:00'"; // há dias: chegou em todo fuso
const daquiA = (h) =>
  `((now() at time zone 'UTC') + interval '${h} hours')::date, ((now() at time zone 'UTC') + interval '${h} hours')::time`;

let n = 0;
/** Cria um atendimento pela sessão da usuária; devolve [id, erro]. */
async function novo(status, quando) {
  const id = `00000000-0000-0000-0000-${String(++n).padStart(12, "0")}`;
  const e = await usuaria(
    `insert into jobs (id, user_id, cliente_nome, data, hora, valor, modalidade, status)
     values ('${id}', '${U1}', 'c', ${quando}, 100, 'online', '${status}')`
  );
  return [id, e];
}
const status = async (id) =>
  (await db.query(`select status::text s from jobs where id = '${id}'`)).rows[0]
    ?.s;
const mudar = (id, s) =>
  usuaria(`update jobs set status = '${s}' where id = '${id}'`);

await semJwt(`insert into auth.users (id, email) values ('${U1}', 'a@b.c');`);

// ── Formulário Novo ─────────────────────────────────────────────
let [id, e] = await novo("agendado", FUTURO);
ok("Novo: agendado no futuro", !e, e);
[id, e] = await novo("confirmado", FUTURO);
ok("Novo: confirmado no futuro", !e, e);
[id, e] = await novo("agendado", PASSADO);
ok("Novo: agendado no passado", !e, e);
[id, e] = await novo("concluído", PASSADO);
ok("Novo: concluído no passado (registrar o que já aconteceu)", !e, e);
[id, e] = await novo("cancelado", PASSADO);
ok("Novo: não aconteceu no passado", !e, e);
[id, e] = await novo("concluído", FUTURO);
ok("Novo: concluído no FUTURO é recusado", e === RECUSA, e);
[id, e] = await novo("cancelado", FUTURO);
ok("Novo: cancelado no FUTURO é recusado", e === RECUSA, e);
[id, e] = await novo("confirmado", PASSADO);
ok("Novo: confirmado no PASSADO é recusado", e === RECUSA, e);

// ── Botões (mudarStatus) ────────────────────────────────────────
[id] = await novo("agendado", FUTURO);
e = await mudar(id, "concluído");
ok("Concluir antes do horário é recusado", e === RECUSA && (await status(id)) === "agendado", e);
e = await mudar(id, "confirmado");
ok("Confirmar antes do horário", !e && (await status(id)) === "confirmado", e);
e = await mudar(id, "cancelado");
ok("Cliente desmarcou (confirmado, antes do horário)", !e && (await status(id)) === "cancelado", e);
[id] = await novo("agendado", FUTURO);
e = await mudar(id, "cancelado");
ok("Cliente desmarcou (agendado, antes do horário)", !e, e);

[id] = await novo("agendado", PASSADO);
e = await mudar(id, "confirmado");
ok("Confirmar depois do horário é recusado", e === RECUSA, e);
e = await mudar(id, "concluído");
ok("Concluir (agendado, depois do horário)", !e && (await status(id)) === "concluído", e);
[id] = await novo("agendado", PASSADO);
e = await mudar(id, "cancelado");
ok("Não aconteceu (agendado, depois do horário)", !e, e);

// Confirmado que ficou para trás (a pessoa confirmou, o horário chegou).
await semJwt(
  `insert into jobs (id, user_id, cliente_nome, data, hora, valor, modalidade, status)
   values ('00000000-0000-0000-0000-0000000000c1', '${U1}', 'c', ${PASSADO}, 100, 'online', 'confirmado'),
          ('00000000-0000-0000-0000-0000000000c2', '${U1}', 'c', ${PASSADO}, 100, 'online', 'confirmado')`
);
e = await mudar("00000000-0000-0000-0000-0000000000c1", "concluído");
ok("Concluir (confirmado, depois do horário)", !e, e);
e = await mudar("00000000-0000-0000-0000-0000000000c2", "cancelado");
ok("Não aconteceu (confirmado, depois do horário)", !e, e);

// ── Formulário Editar ───────────────────────────────────────────
[id] = await novo("concluído", PASSADO);
e = await mudar(id, "agendado");
ok("Editar: concluído volta para agendado", !e, e);
e = await mudar(id, "concluído");
e = await mudar(id, "cancelado");
ok("Editar: concluído vira não aconteceu", !e && (await status(id)) === "cancelado", e);
e = await mudar(id, "concluído");
ok("Editar: não aconteceu vira concluído", !e && (await status(id)) === "concluído", e);
e = await usuaria(`update jobs set data = current_date - 5 where id = '${id}'`);
ok("Editar: concluído muda para outro dia passado", !e, e);
e = await usuaria(`update jobs set data = current_date + 5 where id = '${id}'`);
ok("Editar: concluído levado para o futuro (sem trocar o status) é recusado", e === RECUSA, e);
e = await usuaria(
  `update jobs set data = current_date + 5, status = 'agendado' where id = '${id}'`
);
ok("Editar: levar para o futuro voltando para agendado (o que a tela faz)", !e, e);
e = await usuaria(
  `update jobs set data = current_date + 6, status = 'confirmado' where id = '${id}'`
);
ok("Editar: futuro como confirmado", !e && (await status(id)) === "confirmado", e);

// ── Folga de fuso ───────────────────────────────────────────────
[id, e] = await novo("concluído", daquiA(10));
ok("Concluído daqui a 10 h passa (em algum fuso já chegou)", !e, e);
[id, e] = await novo("concluído", daquiA(20));
ok("Concluído daqui a 20 h é recusado (não chegou em fuso nenhum)", e === RECUSA, e);
[id, e] = await novo("confirmado", daquiA(-10));
ok("Confirmado de 10 h atrás passa (em algum fuso ainda não chegou)", !e, e);
[id, e] = await novo("confirmado", daquiA(-20));
ok("Confirmado de 20 h atrás é recusado", e === RECUSA, e);

// ── Linha antiga fora da regra (o bug antigo) ───────────────────
const ANTIGA = "00000000-0000-0000-0000-0000000000a1";
e = await semJwt(
  `insert into jobs (id, user_id, cliente_nome, data, hora, valor, modalidade, status)
   values ('${ANTIGA}', '${U1}', 'c', ${FUTURO}, 100, 'online', 'concluído')`
);
ok("SQL Editor (sem JWT) grava sem trava", !e, e);
e = await usuaria(
  `update jobs set valor = 150, cliente_nome = 'd', observacoes = 'x', local = null where id = '${ANTIGA}'`
);
ok("Linha antiga: editar nome, valor e observações passa", !e, e);
e = await usuaria(
  `update jobs set status = 'concluído', data = data, hora = hora, valor = 160 where id = '${ANTIGA}'`
);
ok("Linha antiga: salvar o formulário inteiro sem mudar status/data/hora passa", !e, e);
e = await mudar(ANTIGA, "cancelado");
ok("Linha antiga: concluído futuro não vira cancelado antes do horário", e === RECUSA, e);
e = await mudar(ANTIGA, "agendado");
ok("Linha antiga: volta para agendado", !e, e);

// ── Fora da sessão da usuária ───────────────────────────────────
[id] = await novo("agendado", FUTURO);
e = await como("service_role", null, `update jobs set status = 'concluído' where id = '${id}'`);
ok("service role não passa pela trava", !e && (await status(id)) === "concluído", e);

// ── Erro com código e dica ──────────────────────────────────────
try {
  await db.exec(`
    select set_config('request.jwt.claims', '${JSON.stringify({ role: "authenticated", sub: U1 })}', false);
    select set_config('request.jwt.claim.sub', '${U1}', false);
    set role authenticated;`);
  await db.exec(
    `insert into jobs (user_id, cliente_nome, data, hora, valor, modalidade, status)
     values ('${U1}', 'c', ${FUTURO}, 100, 'online', 'concluído')`
  );
  ok("recusa traz código 23514", false);
} catch (err) {
  ok("recusa traz código 23514 e detalhe", err.code === "23514" && /novo para concluído/.test(err.detail ?? ""), {
    code: err.code,
    detail: err.detail,
  });
} finally {
  await db.exec("reset role;");
}

console.log(falhas ? `${falhas} falha(s)` : "gatilho 0046: tudo certo");
process.exit(falhas ? 1 : 0);
