// Migration 0040 (assinatura só pelo servidor), num Postgres de verdade
// (PGlite): a sessão da usuária (authenticated/anon) não muda
// assinatura_status nem trial_started_at; o service role (webhook do
// Stripe) e o próprio banco mudam. Mesmo jeito de rodar do motor-pglite:
//   npx -y -p @electric-sql/pglite@0.2 node tests/pagamento/gatilho-0040-pglite.mjs supabase/migrations/0040_assinatura_so_servidor.sql
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
await db.exec(`create type assinatura_status as enum ('trial','ativa','vencida');
create table public.configuracoes (user_id text primary key, tema text, pin_hash text,
  trial_started_at timestamptz not null default now(), assinatura_status assinatura_status not null default 'trial');`);
await db.exec(readFileSync(process.argv[2], "utf8"));
const sessao = async (papel, sql) => {
  await db.exec(
    `select set_config('request.jwt.claims', '${JSON.stringify({ role: papel })}', false);`
  );
  await db.exec(sql);
};
const ver = async () =>
  (
    await db.query(
      "select assinatura_status, trial_started_at::date::text d, pin_hash from configuracoes where user_id='u1'"
    )
  ).rows[0];
let falhas = 0;
const ok = (n, c, x) => {
  if (!c) falhas++;
  console.log(`${c ? "PASSA" : "FALHA"} ${n} ${JSON.stringify(x)}`);
};
await sessao(
  "service_role",
  "insert into configuracoes(user_id, trial_started_at) values ('u1', '2026-10-01')"
);
await sessao(
  "authenticated",
  "update configuracoes set assinatura_status='ativa', trial_started_at='2099-01-01', pin_hash='abc' where user_id='u1'"
);
let r = await ver();
ok(
  "sessão da usuária não se dá a assinatura nem estica o teste; o resto da linha muda",
  r.assinatura_status === "trial" &&
    r.d === "2026-10-01" &&
    r.pin_hash === "abc",
  r
);
await sessao(
  "anon",
  "update configuracoes set assinatura_status='ativa' where user_id='u1'"
);
r = await ver();
ok("anon também não", r.assinatura_status === "trial", r);
await sessao(
  "authenticated",
  "insert into configuracoes(user_id, assinatura_status, trial_started_at) values ('u2','ativa','2099-01-01')"
);
const u2 = (
  await db.query(
    "select assinatura_status, trial_started_at::date = now()::date hoje from configuracoes where user_id='u2'"
  )
).rows[0];
ok(
  "inserir pela sessão nasce 'trial' e teste de hoje",
  u2.assinatura_status === "trial" && u2.hoje === true,
  u2
);
await sessao(
  "service_role",
  "update configuracoes set assinatura_status='ativa' where user_id='u1'"
);
r = await ver();
ok("service role (webhook do Stripe) muda", r.assinatura_status === "ativa", r);
await db.exec("select set_config('request.jwt.claims', '', false);");
await db.exec(
  "update configuracoes set assinatura_status='vencida' where user_id='u1'"
);
r = await ver();
ok(
  "o próprio banco (sem JWT, ex.: handle_new_user/migrations) muda",
  r.assinatura_status === "vencida",
  r
);
console.log(falhas ? `${falhas} falha(s)` : "gatilho 0040: tudo certo");
process.exit(falhas ? 1 : 0);
