// J16 (#166) — smoke do motor da Jornada no PGlite, nos pontos do ticket.
//
// Mesmo princípio do harness da J10 (`motor-pglite.mjs`): aplica TODAS as
// migrations do repositório num Postgres limpo em memória, com os stubs
// mínimos do Supabase, e exercita o motor. Não toca Supabase de verdade.
// O bloco de stubs é lido do próprio `motor-pglite.mjs` (uma fonte só).
//
// Fora do `npm test` de propósito (o PGlite não é dependência do app):
//   PGLITE=<caminho do index.js do @electric-sql/pglite> \
//     node tests/jornada/j16-motor-smoke.mjs [pasta das migrations]
//
// Os valores esperados (Glow, limite, pilar) saem da tabela da §3 da spec,
// não deste arquivo.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const DIR = process.argv[2] ?? join(ROOT, "supabase/migrations");
const alvoPglite = process.env.PGLITE
  ? pathToFileURL(process.env.PGLITE).href
  : "@electric-sql/pglite";
const { PGlite } = await import(alvoPglite);

const harness = readFileSync(join(HERE, "motor-pglite.mjs"), "utf-8");
const BOOT = harness.match(/const BOOT = `([\s\S]*?)`;/)[1];

const db = new PGlite();
await db.exec(BOOT);
for (const f of readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(readFileSync(join(DIR, f), "utf-8"));

const log = (...a) => console.log(...a);
let ok = true;
const espera = (cond, msg) => {
  log(`${cond ? "PASSA" : "FALHA"} ${msg}`);
  ok &&= !!cond;
};
const secao = (t) => log(`\n## ${t}`);

// ----------------------------------------------------- spec §3 como fonte
const spec = readFileSync(
  join(ROOT, "docs/jornada/spec-sua-jornada.md"),
  "utf-8"
).replace(/\r\n/g, "\n");
const s3 = spec.slice(spec.indexOf("## 3."), spec.indexOf("## 4."));
const linhas = s3
  .split("\n")
  .filter((l) => /^\| (Lançar|Planejar|Guardar|Tirar|"Isso|Registrar)/.test(l))
  .map((l) =>
    l
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim())
  );
// A ordem da tabela da §3 é a ordem destas chaves (conferida pelo rótulo).
const CHAVES = [
  ["despesa", /despesa/],
  ["receita", /receita/],
  ["planejar", /Planejar/],
  ["guardar_meta", /meta/],
  ["comprovante_cofre", /comprovante/],
  ["descanso", /descanso/],
  ["dica_ajudou", /ajudou/],
  ["dica_protegeu", /protegeu/],
  ["atendimento", /atendimento/],
];
const REGRA = {};
CHAVES.forEach(([chave, re], i) => {
  const [rotulo, glow, limite, pilar] = linhas[i] ?? [];
  if (!re.test(rotulo ?? "")) throw new Error(`§3 linha ${i}: ${rotulo}`);
  REGRA[chave] = {
    glow: Number(glow.replace(/[^\d]/g, "")),
    limite: /(\d+)x/.test(limite) ? Number(limite.match(/(\d+)x/)[1]) : null,
    pilar: /—/.test(pilar) ? null : pilar.toLowerCase(),
  };
});

// ------------------------------------------------------------- utilidades
const uuid = (n) =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
let seq = 0;
const chave = () =>
  `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
async function usuaria(n) {
  const id = uuid(n);
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [
    id,
    `u${n}@teste`,
  ]);
  return id;
}
async function aplica(user, acao, dia) {
  return (
    await db.query(
      `select private.jornada_aplicar($1, $2, $3::date, $4) as r`,
      [user, acao, dia, chave()]
    )
  ).rows[0].r;
}
const pequena = (r) => r.comemoracoes.find((c) => c.tipo === "pequena");
const tipos = (r) => r.comemoracoes.map((c) => c.tipo);
async function como(user, fn) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`
  );
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}
const um = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const ORDEM = ["pequena", "selo", "estagio", "capitulo", "marco", "meta"];
const naOrdem = (r) => {
  const idx = tipos(r).map((t) => ORDEM.indexOf(t));
  return idx.every((v, i) => i === 0 || idx[i - 1] <= v);
};
const D1 = "2026-10-05"; // segunda
const D2 = "2026-10-06";

// ---------------------------------------------------------- 1. conta nova
secao("1. conta nova");
const nova = await usuaria(1);
const e0 = await como(
  nova,
  async () =>
    (await db.query(`select public.jornada_estado('Europe/Lisbon', 60) as e`))
      .rows[0].e
);
espera(
  e0.glowTotal === 0 &&
    e0.estagio === 0 &&
    Object.keys(e0.selos).length === 0 &&
    e0.colecao.length === 0 &&
    e0.marcos.length === 0,
  `vazia: Glow 0, estágio 0, sem selo, coleção e marcos vazios`
);
espera(
  e0.capitulo.missoes.length === 3 &&
    e0.capitulo.missoes.every((m) => m.progresso === 0),
  `capítulo do mês com 3 missões, todas em 0`
);
espera(
  ["semana", "mes", "ano"].every(
    (t) => Object.keys(e0.periodos.corrente[t].contadores).length === 0
  ) && Object.keys(e0.periodos.ultimoFechado).length === 0,
  `períodos correntes sem contador e nenhum fechado`
);
espera(
  e0.preferencias.somLigado === true &&
    e0.preferencias.modoDiscreto === false &&
    e0.preferencias.mostrarNoPerfil === false,
  `preferências padrão: som ligado, discreto desligado, perfil desligado`
);

// ------------------------------------------- 2. cada ação, uma vez (§3)
secao("2. cada ação da §3, uma vez: Glow e pilar");
const u2 = await usuaria(2);
for (const [acao] of CHAVES) {
  const r = await aplica(u2, acao, D1);
  const p = pequena(r);
  const regra = REGRA[acao];
  espera(
    p &&
      p.glow === regra.glow &&
      (regra.pilar === null || p.pilar === regra.pilar),
    `${acao}: +${regra.glow}${regra.pilar ? ` em ${regra.pilar}` : ""} (veio ${p?.glow} em ${p?.pilar})`
  );
}

// --------------------------------------------- 3. acima do limite diário
secao("3. acima do limite diário: registra e não dá Glow");
for (const [acao] of CHAVES) {
  const { limite } = REGRA[acao];
  if (!limite) continue;
  // Já foi 1x no passo 2: completa o limite e passa 1.
  for (let i = 1; i < limite; i++) await aplica(u2, acao, D1);
  const antes = await um(
    `select contagem_total n from public.jornada_acoes where user_id = $1 and acao = $2`,
    [u2, acao]
  );
  const r = await aplica(u2, acao, D1);
  const depois = await um(
    `select contagem_total n from public.jornada_acoes where user_id = $1 and acao = $2`,
    [u2, acao]
  );
  const p = pequena(r);
  espera(
    p && p.glow === 0 && p.ganhou === false && depois.n === antes.n + 1,
    `${acao} ${limite + 1}ª vez no dia: conta (${antes.n} → ${depois.n}), Glow 0`
  );
}
{
  const r = await aplica(u2, "despesa", D2);
  espera(
    pequena(r)?.glow === REGRA.despesa.glow,
    `no dia seguinte o limite volta (+${pequena(r)?.glow})`
  );
}

// ---------------------------------------------------- 4. atendimento
secao("4. atendimento: dia ativo, sem Glow, comemoração grande adiada");
const u4 = await usuaria(4);
await db.exec(
  `insert into public.jornada_preferencias (user_id, fuso) values ('${u4}', 'Europe/Lisbon')`
);
const r4 = await como(
  u4,
  async () =>
    (
      await db.query(
        `select public.jornada_registrar('atendimento', $1, 'Europe/Lisbon', 60) as r`,
        [chave()]
      )
    ).rows[0].r
);
const p4 = r4.comemoracoes.find((c) => c.tipo === "pequena");
const grandes4 = r4.comemoracoes.filter((c) => c.tipo !== "pequena");
espera(
  p4 && p4.glow === 0,
  `a pequena do atendimento não tem Glow (${p4?.glow})`
);
espera(p4 && p4.adiada === false, `a pequena do atendimento toca na hora`);
espera(
  grandes4.length > 0 && grandes4.every((c) => c.adiada === true),
  `o que vem junto (${grandes4.map((c) => c.tipo + ":" + (c.selo ?? "")).join(", ")}) chega com adiada = true`
);
espera(
  (r4.estado.periodos.corrente.semana.contadores.atendimento ?? 0) === 1 &&
    r4.estado.glowTotal === grandes4.reduce((s, c) => s + c.glow, 0),
  `o dia conta como ativo (atendimento: ${r4.estado.periodos.corrente.semana.contadores.atendimento}) e o único Glow é o do prêmio que veio junto (${r4.estado.glowTotal})`
);
const r4b = await como(
  u4,
  async () =>
    (
      await db.query(
        `select public.jornada_registrar('atendimento', $1, 'Europe/Lisbon', 60) as r`,
        [chave()]
      )
    ).rows[0].r
);
espera(
  (r4b.estado.periodos.corrente.semana.contadores.atendimento ?? 0) === 1,
  `2º atendimento no mesmo dia não conta outro dia (atendimento: ${r4b.estado.periodos.corrente.semana.contadores.atendimento})`
);

// ------------------------------------------ 5. cascata, na ordem certa
secao("5. cascata numa chamada só, na ordem pequena → selo → estágio → meta");
const u5 = await usuaria(5);
await db.exec(`
  insert into public.rede_perfis (user_id, nome_exibicao, cor_avatar) values ('${u5}', 'C', 'rosa');
  insert into public.rede_wishlist_items (id, user_id, nome, cor, valor_alvo, valor_atual)
    values ('${uuid(501)}', '${u5}', 'Curso', 'rosa', 600, 600);
`);
const r5 = await aplica(u5, "guardar_meta", D1);
espera(
  tipos(r5).includes("selo") &&
    tipos(r5).includes("estagio") &&
    tipos(r5).includes("marco") &&
    tipos(r5).includes("meta"),
  `uma ação dispara selo, estágio, marco e meta (${tipos(r5).join(" → ")})`
);
espera(naOrdem(r5), `a fila vem na ordem do contrato`);
espera(
  new Set(r5.comemoracoes.map((c) => c.id)).size === r5.comemoracoes.length,
  `cada comemoração tem id único`
);
const saldo5 = await um(
  `select glow_total g from public.jornada_saldo where user_id = $1`,
  [u5]
);
espera(
  saldo5.g === r5.comemoracoes.reduce((s, c) => s + c.glow, 0),
  `o Glow somado na fila = o saldo (${saldo5.g})`
);

// ------------------------------------------------ 6. marco 1x na vida
secao("6. marco de dinheiro 1x na vida");
await db.exec(
  `update public.rede_wishlist_items set valor_atual = 0 where user_id = '${u5}'`
);
await aplica(u5, "guardar_meta", D2);
await db.exec(
  `update public.rede_wishlist_items set valor_atual = 600 where user_id = '${u5}'`
);
const r6 = await aplica(u5, "guardar_meta", "2026-10-07");
const marcos6 = await um(
  `select count(*)::int n from public.jornada_marcos where user_id = $1 and marco = 500`,
  [u5]
);
espera(
  !tipos(r6).includes("marco") && marcos6.n === 1,
  `tirar e voltar a guardar € 500 não dá o marco de novo (${marcos6.n} linha, fila ${tipos(r6).join(" → ")})`
);
espera(
  !tipos(r6).includes("meta"),
  `a mesma meta concluída de novo não dá o prêmio de novo`
);

// ------------------------------------------------------ 7. Icônica II
secao("7. Icônica não zera: vira Icônica II");
const u7 = await usuaria(7);
await aplica(u7, "comprovante_cofre", D1);
await db.exec(
  `update public.jornada_saldo set glow_total = 4490 where user_id = '${u7}'`
);
const r7 = await aplica(u7, "comprovante_cofre", D1);
const est7 = r7.comemoracoes.find((c) => c.tipo === "estagio");
const s7 = await um(
  `select glow_total g, public.jornada_estagio_de(glow_total) e from public.jornada_saldo where user_id = $1`,
  [u7]
);
espera(
  s7.e === 5 && est7?.de === 4 && est7?.estagio === 5 && s7.g >= 4500,
  `4490 + 10 = Icônica II (estágio ${s7.e}, de ${est7?.de} pra ${est7?.estagio}, Glow ${s7.g})`
);
const e7 = await como(
  u7,
  async () =>
    (await db.query(`select public.jornada_estado('Europe/Lisbon', 60) as e`))
      .rows[0].e
);
espera(
  e7.glowInicioEstagio === 4500 && e7.glowProximoEstagio === 6000,
  `a barra da Icônica II vai de 4500 a 6000 (${e7.glowInicioEstagio} → ${e7.glowProximoEstagio})`
);

// --------------------------------------------- 8. ação repetida (rede)
secao("8. a mesma chamada reenviada não conta duas vezes");
const u8 = await usuaria(8);
await db.exec(
  `insert into public.jornada_preferencias (user_id, fuso) values ('${u8}', 'Europe/Lisbon')`
);
const k8 = chave();
const [a8, b8] = await como(u8, async () => [
  (
    await db.query(
      `select public.jornada_registrar('despesa', $1, 'Europe/Lisbon', 60) as r`,
      [k8]
    )
  ).rows[0].r,
  (
    await db.query(
      `select public.jornada_registrar('despesa', $1, 'Europe/Lisbon', 60) as r`,
      [k8]
    )
  ).rows[0].r,
]);
espera(
  b8.duplicada === true &&
    a8.estado.glowTotal === b8.estado.glowTotal &&
    b8.comemoracoes.length === 0,
  `reenvio com a mesma chave: duplicada, Glow igual (${a8.estado.glowTotal}), sem comemoração nova`
);

// ----------------------------------------------- 9. nenhum diário no banco
secao("9. o que as tabelas da J09 guardam (só leitura)");
const cols = await db.query(`
  select c.table_name t, c.column_name c, c.data_type d
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name like 'jornada\\_%'
  order by c.table_name, c.ordinal_position`);
const porTabela = {};
for (const r of cols.rows) (porTabela[r.t] ??= []).push(`${r.c} ${r.d}`);
for (const [t, cs] of Object.entries(porTabela))
  log(`   ${t}: ${cs.join(", ")}`);
const datas = cols.rows.filter((r) => /date|timestamp/.test(r.d));
log(`   colunas de data: ${datas.map((r) => `${r.t}.${r.c}`).join(", ")}`);
const listas = cols.rows.filter((r) => r.d === "ARRAY");
log(`   colunas de lista: ${listas.map((r) => `${r.t}.${r.c}`).join(", ")}`);
const linhasAcoes = await um(
  `select count(*)::int n from public.jornada_acoes where user_id = $1`,
  [u2]
);
espera(
  linhasAcoes.n <= CHAVES.length + 1,
  `uma linha por ação, não por evento: ${linhasAcoes.n} linhas depois de ${seq} chamadas no total`
);
const periodosU2 = await db.query(
  `select tipo, fechado, inicio, contadores from public.jornada_periodos where user_id = $1`,
  [u2]
);
espera(
  periodosU2.rows.every((p) =>
    Object.values(p.contadores).every((v) => typeof v === "number")
  ) && periodosU2.rows.length <= 6,
  `períodos: no máximo 1 aberto + 1 fechado por tipo (${periodosU2.rows.length}), só números`
);

log(`\nRESULTADO: ${ok ? "TUDO PASSOU" : "HOUVE FALHA"}`);
process.exit(ok ? 0 : 1);
