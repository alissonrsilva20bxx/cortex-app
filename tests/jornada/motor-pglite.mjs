// Harness do motor da Jornada (J10, #160) -- prova de comportamento sem
// Supabase: aplica TODAS as migrations do repositório num Postgres limpo em
// memória (PGlite), com stubs mínimos do que o Supabase fornece (papéis,
// auth.users/auth.uid(), storage, publication e o `alter default
// privileges` que concede EXECUTE a anon/authenticated -- o furo da 0032),
// e exercita as RPCs e o motor. Não toca Supabase de verdade.
//
// Fora do `npm test` de propósito: o PGlite não é dependência do app.
// Rodar (baixa o pacote no cache do npx, não mexe no package.json):
//   npx -y -p @electric-sql/pglite@0.2 node tests/jornada/motor-pglite.mjs supabase/migrations
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.argv[2] ?? "supabase/migrations";
const db = new PGlite();
const log = (...a) => console.log(...a);
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
await db.exec(BOOT);

const arquivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
let falhas = 0;
for (const f of arquivos) {
  try { await db.exec(readFileSync(join(DIR, f), "utf-8")); }
  catch (e) { falhas++; log(`ERRO  ${f}: ${e.message}`); }
}
log(`migrations: ${arquivos.length - falhas}/${arquivos.length} aplicadas sem erro`);
if (falhas) process.exit(1);
for (const f of ["0034_jornada_contadores.sql", "0035_jornada_rpcs.sql"]) {
  try { await db.exec(readFileSync(join(DIR, f), "utf-8")); log(`ok    ${f} reaplicada (idempotente)`); }
  catch (e) { log(`ERRO  ${f} reaplicada: ${e.message}`); process.exit(1); }
}

let ok = true;
const espera = (cond, msg) => { log(`${cond ? "PASSA" : "FALHA"} ${msg}`); ok &&= !!cond; };
const A = "aaaaaaaa-0000-4000-8000-00000000000a";
const B = "bbbbbbbb-0000-4000-8000-00000000000b";
const C = "cccccccc-0000-4000-8000-00000000000c";
const D = "dddddddd-0000-4000-8000-00000000000d";
const ITEM = "11111111-0000-4000-8000-000000000001";
const ITEM2 = "11111111-0000-4000-8000-000000000002";
const POST = "22222222-0000-4000-8000-000000000001";
let seq = 0;
const chave = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

await db.exec(`
  insert into auth.users (id, email) values ('${A}','a@x'),('${B}','b@x'),('${C}','c@x'),('${D}','d@x');
  insert into public.rede_perfis (user_id, nome_exibicao, cor_avatar) values ('${A}', 'A', 'rosa'), ('${B}', 'B', 'rosa');
  insert into public.rede_wishlist_items (id, user_id, nome, cor, valor_alvo, valor_atual)
    values ('${ITEM}', '${B}', 'Viagem', 'rosa', 100, 100),
           ('${ITEM2}', '${A}', 'Curso', 'rosa', 1000, 600);
  insert into public.rede_posts (id, autor_id, categoria, texto) values ('${POST}', '${A}', 'dica', 'x');
`).catch(async (e) => {
  log("seed falhou:", e.message);
  process.exit(1);
});

async function como(role, sub, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false); set role ${role};`);
  try { return await fn(); } finally { await db.exec("reset role;"); }
}
async function tenta(sql) {
  try { const r = await db.query(sql); return { ok: true, rows: r.rows }; }
  catch (e) { return { ok: false, erro: e.message.split("\n")[0] }; }
}
// O motor direto (como dona do banco), com o dia controlado.
// (o 4º argumento é ignorado: a meta agora é conferida na Wishlist inteira)
async function aplica(user, acao, dia, _ref = null, k = chave()) {
  const r = await db.query(`select private.jornada_aplicar($1, $2, $3::date, $4) as r`, [user, acao, dia, k]);
  const res = r.rows[0].r;
  const s = await db.query(`select glow_total, public.jornada_estagio_de(glow_total) as e from public.jornada_saldo where user_id = $1`, [user]);
  return { ...res, fila: res.comemoracoes, glow_total: s.rows[0].glow_total, estagio: s.rows[0].e };
}
const um = async (sql) => (await db.query(sql)).rows[0];
const saldo = async (u) => um(`select * from public.jornada_saldo where user_id = '${u}'`);
const acao = async (u, a) => um(`select * from public.jornada_acoes where user_id = '${u}' and acao = '${a}'`);
const periodo = async (u, tipo, fechado = false) =>
  um(`select inicio::text, contadores from public.jornada_periodos where user_id = '${u}' and tipo = '${tipo}' and fechado = ${fechado}`);
const contador = async (u, k) => (await um(`select coalesce((select total from public.jornada_contadores where user_id = '${u}' and chave = '${k}'), 0) as t`)).t;
const tipos = (r) => r.fila.map((f) => f.tipo).join(",");

// ---------------------------------------------------------------- permissões
await como("anon", null, async () => {
  const r = await tenta(`select public.jornada_registrar('despesa', '${chave()}', 'Europe/Lisbon')`);
  espera(!r.ok, `anon não chama jornada_registrar (${r.erro ?? "chamou!"})`);
  const r2 = await tenta(`select public.jornada_estado()`);
  espera(!r2.ok, `anon não chama jornada_estado (${r2.erro ?? "chamou!"})`);
});
await como("authenticated", C, async () => {
  for (const [nome, sql] of [
    ["jornada_aplicar", `select private.jornada_aplicar('${C}', 'despesa', current_date, 'abcdefgh1')`],
    ["jornada_creditar_dica", `select private.jornada_creditar_dica('${POST}', 'dica_ajudou')`],
    ["jornada_regra", `select * from private.jornada_regra('despesa')`],
    ["jornada_somar_glow", `select private.jornada_somar_glow('${C}', 'organizar', 999)`],
    ["jornada_estagio_no_perfil", `select private.jornada_estagio_no_perfil('${A}')`],
  ]) {
    const r = await tenta(sql);
    espera(!r.ok, `authenticated não chama private.${nome} (${r.erro ?? "chamou!"})`);
  }
  // Nenhum parâmetro de id de usuária: a assinatura não tem como.
  const args = await db.query(`select pg_get_function_identity_arguments(p.oid) as a, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('jornada_registrar', 'jornada_estado')`);
  espera(args.rows.every((r) => !/uuid/.test(r.a.replace("p_chave uuid", "").replace("p_ref uuid", ""))), `RPCs públicas sem id de usuária: ${args.rows.map((r) => r.proname + "(" + r.a + ")").join("; ")}`);
});
await como("authenticated", null, async () => {
  const r = await tenta(`select public.jornada_registrar('despesa', '${chave()}', 'Europe/Lisbon')`);
  espera(!r.ok && /sem sessão/.test(r.erro), `sem auth.uid() a RPC recusa (${r.erro ?? "aceitou!"})`);
});

// ---------------------------------------------------------------- RPC pública, fuso
const reg = (acao, k, fuso, desl) =>
  tenta(`select public.jornada_registrar('${acao}', ${k === null ? "null" : `'${k}'`}${fuso !== undefined ? `, ${fuso === null ? "null" : `'${fuso}'`}` : ""}${desl !== undefined ? `, ${desl}` : ""}) as r`);
await como("authenticated", C, async () => {
  let x = await reg("despesa", chave());
  espera(!x.ok && /fuso ausente/.test(x.erro), `sem fuso nem deslocamento a RPC recusa (${x.erro ?? "aceitou!"})`);
  x = await reg("dica_ajudou", chave(), "Europe/Lisbon");
  espera(!x.ok && /não permitida/.test(x.erro), `cliente não registra dica_ajudou (${x.erro ?? "aceitou!"})`);
  x = await reg("despesa", null, "Europe/Lisbon");
  espera(!x.ok && /chave/.test(x.erro), `sem chave a RPC recusa (${x.erro ?? "aceitou!"})`);
  x = await reg("despesa", "x'; drop", "Europe/Lisbon");
  espera(!x.ok, `chave fora do formato é recusada (${x.erro ?? "aceitou!"})`);
  x = await reg("despesa", chave(), "Marte/Base", 9999);
  espera(!x.ok && /deslocamento/.test(x.erro), `deslocamento absurdo é recusado (${x.erro ?? "aceitou!"})`);
  x = await reg("despesa", chave(), "UTC", -180);
  espera(x.ok && x.rows[0].r.comemoracoes[0]?.ganhou === true, "fuso 'UTC' genérico + deslocamento: usa o deslocamento");
  const semFuso = await db.query(`select fuso from public.jornada_preferencias where user_id = '${C}'`);
  espera((semFuso.rows[0]?.fuso ?? null) === null, "'UTC' genérico não é guardado como fuso dela");
  // Formato da #187: chave de reserva sem crypto.randomUUID (`${Date.now()}-...`).
  x = await reg("despesa", "1760000000000-12345678", "America/Sao_Paulo", -180);
  espera(x.ok, `chave de reserva da J11 é aceita (${x.erro ?? "ok"})`);
  const k = chave();
  x = await reg("receita", k, "America/Sao_Paulo", -180);
  const rr = x.ok && x.rows[0].r;
  espera(rr && rr.comemoracoes[0]?.tipo === "pequena" && rr.comemoracoes[0].glow === 5 && rr.comemoracoes[0].ganhou === true && typeof rr.comemoracoes[0].id === "string",
    "registrar devolve { estado, comemoracoes } com a pequena (+5, ganhou, id)");
  espera(rr && typeof rr.estado?.glowTotal === "number" && rr.estado.glowPorPilar && rr.estado.preferencias?.mostrarNoPerfil === false,
    "o estado vem no formato EstadoJornada da J11 (camelCase)");
  x = await reg("receita", k, "America/Sao_Paulo", -180);
  espera(x.ok && x.rows[0].r.duplicada === true && x.rows[0].r.comemoracoes.length === 0 && x.rows[0].r.estado.glowTotal === rr.estado.glowTotal,
    "mesma chave pela RPC: duplicada, sem comemoração, estado igual");
  const comFuso = await db.query(`select fuso from public.jornada_preferencias where user_id = '${C}'`);
  espera(comFuso.rows[0]?.fuso === "America/Sao_Paulo", `fuso válido do aparelho é guardado (${comFuso.rows[0]?.fuso})`);
  const est = await tenta(`select public.jornada_estado() as e`);
  // 2 despesas + 1 receita (+15) + Mês a mês I (+20)
  espera(est.ok && est.rows[0].e.glowTotal === 35 && est.rows[0].e.selos.mes_a_mes === 1, `estado da própria: glow 35 (2 despesas, 1 receita, Mês a mês I) e selo Mês a mês I (${est.ok && est.rows[0].e.glowTotal})`);
});
await como("authenticated", D, async () => {
  const est = await tenta(`select public.jornada_estado() as e`);
  espera(est.ok && est.rows[0].e.glowTotal === 0 && Object.keys(est.rows[0].e.selos).length === 0 && est.rows[0].e.capitulo.missoes.length === 3,
    "estado de outra pessoa vem zerado (só a própria): 0 Glow, sem selos, capítulo com 3 missões");
});

// ---------------------------------------------------------------- limite do dia
const D1 = "2026-10-06"; // terça
let r;
for (let i = 1; i <= 3; i++) {
  r = await aplica(D, "despesa", D1);
  espera(r.concedeu && r.fila[0]?.tipo === "pequena" && r.fila[0].glow === 5, `despesa ${i}/3 dentro do limite concede +5`);
}
r = await aplica(D, "despesa", D1);
const a4 = await acao(D, "despesa");
espera(!r.concedeu && r.glow_ganho === 0 && a4.contagem_total === 4, `4ª despesa: registra (contagem 4) e NÃO concede (glow_ganho ${r.glow_ganho})`);
espera(r.fila.length === 1 && r.fila[0].tipo === "pequena" && r.fila[0].glow === 0 && r.fila[0].ganhou === false, "4ª despesa: pequena com glow 0 e ganhou false (a contagem segue)");
espera((await periodo(D, "mes")).contadores.despesa === 4, "contador do mês conta as 4 despesas");
r = await aplica(D, "despesa", "2026-10-07");
espera(r.concedeu, "no dia seguinte o limite zerou e concede de novo");

// ---------------------------------------------------------------- duplicada
const k1 = chave();
const r1 = await aplica(D, "receita", D1, null, k1);
const s1 = await saldo(D);
const r2 = await aplica(D, "receita", D1, null, k1);
const s2 = await saldo(D);
espera(r1.concedeu && r2.duplicada && !r2.concedeu && s1.glow_total === s2.glow_total && (await acao(D, "receita")).contagem_total === 1,
  "chamada duplicada (mesma chave) não concede nem conta duas vezes");

// ---------------------------------------------------------------- atendimento
const g0 = (await saldo(D)).glow_total;
r = await aplica(D, "atendimento", D1);
espera(r.glow_ganho === 0 && !r.concedeu && r.contou_no_dia && r.fila.length === 1 && r.fila[0].glow === 0 && (await saldo(D)).glow_total === g0,
  "atendimento não concede Glow (marca o dia)");
r = await aplica(D, "atendimento", D1);
espera(!r.contou_no_dia && (await contador(D, "dias_atendimento")) === 1 && (await acao(D, "atendimento")).contagem_total === 2,
  "2º atendimento no dia: registra, mas o dia ativo conta 1 vez");

// ---------------------------------------------------------------- ordem da fila
// B: 95 de Glow, meta de 100 já cheia. Guardar dá pequena(+15) -> selo
// Rumo à meta I (+20) -> estágio (Em movimento) -> meta concluída (+100).
await db.exec(`insert into public.jornada_saldo (user_id, glow_total, glow_prosperar) values ('${B}', 95, 95)`);
r = await aplica(B, "guardar_meta", D1, ITEM);
log("   fila:", JSON.stringify(r.fila.map((f) => [f.tipo, f.selo ?? f.estagio ?? f.glow])));
espera(tipos(r).startsWith("pequena,selo") && tipos(r).includes("estagio") && tipos(r).endsWith("meta"),
  `fila na ordem pequena -> selo -> estágio -> meta (${tipos(r)})`);
espera(new Set(r.fila.map((f) => f.id)).size === r.fila.length && r.fila.every((f) => f.adiada === false), "ids únicos e nada adiado (não é atendimento)");
espera(r.glow_total === 95 + 15 + 20 + 20 + 100 && r.estagio === 1, `Glow 250 (+15, Rumo à meta I +20, Mês a mês I +20, meta +100) e estágio Em movimento (${r.glow_total}, ${r.estagio})`);
const dB = await db.query(`select item from public.jornada_destravados where user_id = '${B}' order by item`);
espera(dB.rows.map((x) => x.item).join(",") === "icone_estagio_1,moldura_estagio_1,tema_estagio_1", "estágio novo destrava moldura, ícone e tema");
r = await aplica(B, "guardar_meta", "2026-10-07", ITEM);
espera(!tipos(r).includes("meta"), "meta concluída só dá +100 uma vez");

// ---------------------------------------------------------------- estágio não zera
await db.exec(`update public.jornada_saldo set glow_total = 2990 where user_id = '${C}'`);
r = await aplica(C, "comprovante_cofre", D1);
espera(r.estagio === 4 && tipos(r).includes("estagio"), `2990 + 10 = Icônica (estágio ${r.estagio})`);
await db.exec(`update public.jornada_saldo set glow_total = 4490 where user_id = '${C}'`);
r = await aplica(C, "comprovante_cofre", D1);
const fe = r.fila.find((f) => f.tipo === "estagio");
espera(r.estagio === 5 && fe?.de === 4 && fe?.estagio === 5, `passar de Icônica não zera: vira Icônica II (estágio ${r.estagio})`);
await como("authenticated", C, async () => {
  const e = (await db.query(`select public.jornada_estado() as e`)).rows[0].e;
  espera(e.estagio === 5 && e.glowInicioEstagio === 4500 && e.glowProximoEstagio === 6000, `estado: estágio 5, de 4500 a 6000 (${e.estagio}, ${e.glowInicioEstagio}, ${e.glowProximoEstagio})`);
});

// ---------------------------------------------------------------- dia forte, semana firme
const E = "eeeeeeee-0000-4000-8000-00000000000e";
await db.exec(`insert into auth.users (id, email) values ('${E}', 'e@x')`);
// Em ordem cronológica, como no app. Seg e ter: dia forte (3 com Glow).
for (const dia of ["2026-10-12", "2026-10-13"]) {
  await aplica(E, "despesa", dia);
  await aplica(E, "atendimento", dia); // não conta pro dia forte
  await aplica(E, "receita", dia);
  if (dia === "2026-10-12") espera(((await periodo(E, "semana")).contadores.dias_fortes ?? 0) === 0, "2 ações com Glow + atendimento não fazem dia forte");
  await aplica(E, "planejar", dia);
}
const sem = await periodo(E, "semana");
espera(sem.contadores.dias_fortes === 2 && !sem.contadores.firme, "3ª ação com Glow faz o dia forte (2 dias)");
await aplica(E, "despesa", "2026-10-14");
await aplica(E, "despesa", "2026-10-14");
await aplica(E, "despesa", "2026-10-14");
r = await aplica(E, "despesa", "2026-10-14"); // acima do limite: não conta
espera((await periodo(E, "semana")).contadores.dias_fortes === 3, "qua: 3 despesas = dia forte (a 4ª, acima do limite, não muda nada)");
r = await aplica(E, "planejar", "2026-10-15");
const sem2 = await periodo(E, "semana");
espera(sem2.contadores.dias_fortes === 3 && sem2.contadores.firme === 1 && !tipos(r).includes("selo") && (await contador(E, "semanas_firmes")) === 1, "3º dia forte da semana = semana firme");
espera(await um(`select nivel from public.jornada_selos where user_id = '${E}' and selo = 'semana_firme'`).then((x) => x?.nivel === 1), "semana firme dá o selo Semana firme I");
espera((await periodo(E, "mes")).contadores.semanas_firmes === 1, "semana firme conta no mês em que termina");

// ---------------------------------------------------------------- capítulo (outubro)
const F = "ffffffff-0000-4000-8000-00000000000f";
await db.exec(`insert into auth.users (id, email) values ('${F}', 'f@x')`);
// Outubro: 3 descansos, 12 despesas, 4 comprovantes.
for (const d of ["2026-10-01", "2026-10-02"]) await aplica(F, "descanso", d);
for (let i = 0; i < 12; i++) await aplica(F, "despesa", `2026-10-${String(3 + (i % 4)).padStart(2, "0")}`);
for (let i = 0; i < 4; i++) await aplica(F, "comprovante_cofre", "2026-10-08");
const antes = (await saldo(F)).glow_total;
r = await aplica(F, "descanso", "2026-10-09");
log("   fila:", JSON.stringify(r.fila.map((f) => [f.tipo, f.selo ?? f.capitulo?.mes ?? ""])));
espera(r.fila.some((f) => f.tipo === "capitulo" && f.glow === 40 && f.capitulo?.mes === 10 && f.capitulo?.ano === 2026),
  "3ª missão cumprida fecha o capítulo de outubro (+40)");
espera((await um(`select count(*)::int n from public.jornada_colecao where user_id = '${F}' and ano = 2026 and mes = 10`)).n === 1, "coleção ganha outubro");
const s3 = await saldo(F);
espera(s3.glow_total - antes === r.glow_ganho && s3.glow_total === s3.glow_organizar + s3.glow_prosperar + s3.glow_proteger + s3.glow_conectar + 40,
  "o +40 do capítulo vai só pro total (não pra pilar)");
r = await aplica(F, "descanso", "2026-10-10");
espera(!r.fila.some((f) => f.tipo === "capitulo"), "capítulo não fecha duas vezes");

// ---------------------------------------------------------------- viradas
await aplica(F, "despesa", "2026-11-02"); // segunda, novo mês
const fechadoMes = await periodo(F, "mes", true);
const corrMes = await periodo(F, "mes");
espera(fechadoMes.inicio === "2026-10-01" && fechadoMes.contadores.despesa === 12 && corrMes.inicio === "2026-11-01" && corrMes.contadores.despesa === 1,
  "virada de mês: outubro vira o retrato fechado, novembro recomeça");
espera((await contador(F, "meses_na_jornada")) === 2, "meses na Jornada = 2");
await como("authenticated", F, async () => {
  const e = (await db.query(`select public.jornada_estado(null, 0) as e`)).rows[0].e;
  espera(e.periodos.ultimoFechado.mes?.inicio === "2026-10-01", "estado mostra o retrato do último mês fechado");
});

// Semana que atravessa a virada conta pro mês em que termina (§6).
const G = "99999999-0000-4000-8000-000000000009";
await db.exec(`insert into auth.users (id, email) values ('${G}', 'g@x');
  insert into public.rede_perfis (user_id, nome_exibicao, cor_avatar) values ('${G}', 'G', 'rosa');
  insert into public.rede_wishlist_items (id, user_id, nome, cor, valor_alvo, valor_atual)
    values ('11111111-0000-4000-8000-000000000009', '${G}', 'X', 'rosa', 9000, 10);`);
await aplica(G, "guardar_meta", "2026-09-30", "11111111-0000-4000-8000-000000000009"); // qua; semana 28/9–4/10
espera(!(await periodo(G, "mes")).contadores.semanas_guardou, "guardar em 30/9 (semana termina em outubro) não conta pra setembro");
await aplica(G, "despesa", "2026-10-01");
espera((await periodo(G, "mes")).contadores.semanas_guardou === 1, "...e outubro já começa com essa semana");
await aplica(G, "guardar_meta", "2026-10-02", "11111111-0000-4000-8000-000000000009");
espera((await periodo(G, "mes")).contadores.semanas_guardou === 1, "guardar de novo na mesma semana não conta outra semana");

// ---------------------------------------------------------------- marcos
r = await aplica(A, "guardar_meta", D1, ITEM2); // 600 guardados
espera(r.fila.filter((f) => f.tipo === "marco").map((f) => f.marco).join() === "500", "€ 600 guardados: marco de 500 (+50)");
await db.exec(`update public.rede_wishlist_items set valor_atual = 100 where id = '${ITEM2}'`);
await aplica(A, "guardar_meta", "2026-10-07", ITEM2);
await db.exec(`update public.rede_wishlist_items set valor_atual = 600 where id = '${ITEM2}'`);
r = await aplica(A, "guardar_meta", "2026-10-08", ITEM2);
espera(!r.fila.some((f) => f.tipo === "marco") && (await um(`select count(*)::int n from public.jornada_marcos where user_id = '${A}'`)).n === 1,
  "saldo cai e sobe de novo: o marco não dá Glow outra vez");

// ---------------------------------------------------------------- dica
const conectarAntes = (await saldo(A)).glow_conectar;
const rd = (await db.query(`select private.jornada_creditar_dica('${POST}', 'dica_ajudou') as r`)).rows[0].r;
espera((await saldo(A)).glow_conectar === conectarAntes + 5 + 20 && rd.comemoracoes.some((f) => f.selo === "mao_amiga"),
  "crédito de dica vai pra autora (+5 Conectar e selo Mão amiga I +20 Conectar)");

// ---------------------------------------------------------------- Em casa (7 dias) e Um ano (12 meses)
const H = "12121212-0000-4000-8000-000000000012";
await db.exec(`insert into auth.users (id, email) values ('${H}', 'h@x')`);
for (let d = 1; d <= 6; d++) await aplica(H, "abrir_jornada", `2026-03-0${d}`);
espera(!(await um(`select 1 as x from public.jornada_selos where user_id = '${H}' and selo = 'em_casa'`)), "6 dias de uso: ainda sem Em casa");
r = await aplica(H, "abrir_jornada", "2026-03-07");
espera(r.fila.some((f) => f.selo === "em_casa" && f.glow === 20), "7º dia de uso: Em casa (+20)");
for (let m = 4; m <= 14; m++) {
  const ano = m > 12 ? 2027 : 2026; const mes = m > 12 ? m - 12 : m;
  r = await aplica(H, "abrir_jornada", `${ano}-${String(mes).padStart(2, "0")}-01`);
  if (m === 14) espera(r.fila.some((f) => f.selo === "um_ano"), "12º mês na Jornada: Um ano");
  else if (r.fila.some((f) => f.selo === "um_ano")) espera(false, `Um ano cedo demais (mês ${m})`);
}
espera((await um(`select nivel from public.jornada_selos where user_id = '${H}' and selo = 'mes_a_mes'`)).nivel === 3, "Mês a mês chegou ao III (6+ meses)");

for (const [g, ini, prox] of [[0, 0, 100], [99, 0, 100], [100, 100, 400], [1199, 400, 1200], [2999, 1200, 3000], [3000, 3000, 4500], [6001, 6000, 7500]]) {
  const x = await um(`select public.jornada_inicio_do_estagio(${g}) as i, public.jornada_proximo_estagio_em(${g}) as p`);
  espera(x.i === ini && x.p === prox, `Glow ${g}: estágio de ${ini} a ${prox} (${x.i}, ${x.p})`);
}

// ---------------------------------------------------------------- atendimento adia o grande
const I = "13131313-0000-4000-8000-000000000013";
await db.exec(`insert into auth.users (id, email) values ('${I}', 'i@x')`);
r = await aplica(I, "atendimento", D1); // 1ª chamada: selo Mês a mês I
espera(r.fila[0].tipo === "pequena" && r.fila[0].adiada === false && r.fila.some((f) => f.tipo === "selo" && f.adiada === true),
  "atendimento: a pequena vem na hora; o selo vem adiada pra próxima abertura");

// ---------------------------------------------------------------- meta: o servidor decide sozinho
const J = "14141414-0000-4000-8000-000000000014";
await db.exec(`insert into auth.users (id, email) values ('${J}', 'j@x');
  insert into public.rede_perfis (user_id, nome_exibicao, cor_avatar) values ('${J}', 'J', 'rosa');
  insert into public.rede_wishlist_items (id, user_id, nome, cor, valor_alvo, valor_atual)
    values ('11111111-0000-4000-8000-000000000014', '${J}', 'X', 'rosa', 200, 50);`);
await como("authenticated", J, async () => {
  const x = await reg("meta_concluida", chave(), "Europe/Lisbon", 60);
  espera(!x.ok && /não permitida/.test(x.erro), `meta_concluida não é ação do cliente (${x.erro ?? "aceitou!"})`);
  const ab = await reg("abrir_jornada", chave(), "Europe/Lisbon", 60);
  espera(ab.ok && ab.rows[0].r.comemoracoes.some((c) => c.selo === "primeiros_passos") && ab.rows[0].r.estado.selos.primeiros_passos === 1,
    "abrir_jornada pela RPC: o selo Primeiros passos é alcançável");
});
r = await aplica(J, "guardar_meta", D1);
espera(!r.fila.some((f) => f.tipo === "meta"), "guardar com a meta não cheia: sem +100");
await db.exec(`update public.rede_wishlist_items set valor_atual = 200 where user_id = '${J}'`);
r = await aplica(J, "guardar_meta", "2026-10-07");
espera(r.fila.filter((f) => f.tipo === "meta").length === 1, "guardar com a meta cheia de verdade: +100 uma vez");

// ---------------------------------------------------------------- nada de diário
const tempo = await db.query(`
  select table_name || '.' || column_name as c from information_schema.columns
  where table_schema = 'public' and table_name like 'jornada_%'
    and data_type in ('date', 'timestamp with time zone', 'timestamp without time zone', 'time without time zone')
  order by 1`);
// jornada_semana_dias.dia (0036, ordem do operador): a marca de cada dia da
// SEMANA CORRENTE (só forte | descanso, nada do que foi feito), apagada na
// primeira chamada da semana seguinte. Qualquer outra data nova é erro.
espera(tempo.rows.map((x) => x.c).join() === "jornada_acoes.dia,jornada_periodos.inicio,jornada_semana_dias.dia", `as únicas datas continuam ${tempo.rows.map((x) => x.c).join()}`);
const linhasAcao = await um(`select count(*)::int n from public.jornada_acoes where user_id = '${F}'`);
espera(linhasAcao.n <= 5, `uma linha por ação, não por evento (${linhasAcao.n} linhas depois de ~20 chamadas)`);
const fns = await db.query(`
  select n.nspname || '.' || p.proname as f, p.prosecdef, array_to_string(p.proconfig, ',') as cfg
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.proname like 'jornada_%'`);
espera(fns.rows.every((x) => /search_path=/.test(x.cfg ?? "")), `toda função jornada_* tem search_path fixo (${fns.rows.length} funções)`);
const execAnon = await db.query(`
  select n.nspname || '.' || p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.proname like 'jornada_%' and has_function_privilege('anon', p.oid, 'execute')`);
espera(execAnon.rows.length === 0, `anon não executa nenhuma função jornada_* (${execAnon.rows.map((x) => x.f).join() || "nenhuma"})`);

log(ok ? "\nRESULTADO: TUDO PASSOU" : "\nRESULTADO: HOUVE FALHA");
process.exit(ok ? 0 : 1);
