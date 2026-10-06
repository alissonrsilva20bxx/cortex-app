import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * J10 (#160): o motor da Jornada no servidor.
 *
 * Duas partes:
 *  1. Contrato (roda sempre): lê a spec e as migrations como texto e afirma
 *     que os números do motor são EXATAMENTE os da spec, que a fila sai na
 *     ordem combinada e que toda função valida auth.uid()/tem search_path
 *     fixo/não fica executável por anon.
 *  2. Comportamento (só com Supabase LOCAL, mesmo harness de tests/rede):
 *     chama a RPC de verdade como uma usuária de teste. Sem as variáveis
 *     SUPABASE_TEST_* (ver tests/rede/support/env.ts), ou com o Supabase
 *     local desligado, a suíte é pulada.
 */

const raiz = path.resolve(__dirname, "../..");
const ler = (arquivo: string) =>
  readFileSync(path.join(raiz, arquivo), "utf-8");

const spec = ler("docs/jornada/spec-sua-jornada.md");
const sql0034 = ler("supabase/migrations/0034_jornada_contadores.sql");
const sql0035 = ler("supabase/migrations/0035_jornada_rpcs.sql");
const servidor = ler("lib/jornada/servidor.ts");

/** Linhas de tabela markdown de uma seção da spec ("## 3." até a próxima "## "). */
function linhasDaSecao(numero: number): string[][] {
  const inicio = spec.indexOf(`## ${numero}.`);
  const fim = spec.indexOf("\n## ", inicio + 1);
  return spec
    .slice(inicio, fim === -1 ? undefined : fim)
    .split("\n")
    .filter((l) => l.startsWith("|") && !/^\|\s*-/.test(l))
    .map((l) =>
      l
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim())
    );
}

/** Corpo de uma função SQL: de "create or replace function nome(" até "$$;". */
function corpoDaFuncao(sql: string, nome: string): string {
  const inicio = sql.indexOf(`create or replace function ${nome}(`);
  expect(inicio, `função ${nome} existe`).toBeGreaterThanOrEqual(0);
  const abre = sql.indexOf("$$", inicio);
  const fecha = sql.indexOf("$$;", abre + 2);
  return sql.slice(inicio, fecha + 3);
}

const PILAR: Record<string, string> = {
  Organizar: "organizar",
  Prosperar: "prosperar",
  Proteger: "proteger",
  Conectar: "conectar",
};

describe("J10 contrato: números do motor = spec", () => {
  it("§3: Glow, limite por dia e pilar de cada ação", () => {
    const acaoDaLinha: [RegExp, string][] = [
      [/^Lançar despesa$/, "despesa"],
      [/^Lançar receita/, "receita"],
      [/^Planejar o dia seguinte$/, "planejar"],
      [/^Guardar dinheiro numa meta$/, "guardar_meta"],
      [/^Guardar comprovante no Cofre$/, "comprovante_cofre"],
      [/^Tirar um dia de descanso$/, "descanso"],
      [/^"Isso me ajudou"/, "dica_ajudou"],
      [/^"Isso me protegeu"/, "dica_protegeu"],
      [/^Registrar atendimento$/, "atendimento"],
    ];
    const daSpec = new Map<
      string,
      { glow: number; limite: number; pilar: string | null }
    >();
    for (const [rotulo, glow, limite, pilar] of linhasDaSecao(3)) {
      const par = acaoDaLinha.find(([re]) => re.test(rotulo));
      if (!par) continue;
      daSpec.set(par[1], {
        glow: Number(glow.replace(/[^\d]/g, "")),
        // atendimento: "— (só marca o dia como ativo, 1x/dia)"
        limite: par[1] === "atendimento" ? 1 : Number(limite.replace(/x$/, "")),
        pilar: PILAR[pilar] ?? null,
      });
    }
    expect(daSpec.size).toBe(9);

    const regra = corpoDaFuncao(sql0035, "private.jornada_regra");
    const doSql = new Map<
      string,
      { glow: number; limite: number; pilar: string | null }
    >();
    for (const m of regra.matchAll(
      /\('([a-z_]+)',\s*(\d+),\s*(\d+),\s*(?:'([a-z]+)'|null),\s*(?:true|false)\)/g
    )) {
      doSql.set(m[1], {
        glow: Number(m[2]),
        limite: Number(m[3]),
        pilar: m[4] ?? null,
      });
    }
    for (const [acao, esperado] of daSpec) {
      expect(doSql.get(acao), acao).toEqual(esperado);
    }
    // Além das 9 da spec, só abrir_jornada (0 Glow, alimenta "Primeiros passos").
    expect([...doSql.keys()].filter((k) => !daSpec.has(k))).toEqual([
      "abrir_jornada",
    ]);
    expect(doSql.get("abrir_jornada")?.glow).toBe(0);
  });

  it("§3: prêmios de uma vez (meta +100, marco +50, capítulo +40, selo 20/30/50)", () => {
    const motor = corpoDaFuncao(sql0035, "private.jornada_aplicar");
    expect(motor).toContain(
      "perform private.jornada_somar_glow(p_user, 'prosperar', 100);"
    );
    expect(motor).toContain(
      "perform private.jornada_somar_glow(p_user, 'prosperar', 50);"
    );
    // Capítulo vai só pro total (pilar nulo).
    expect(motor).toContain(
      "perform private.jornada_somar_glow(p_user, null, 40);"
    );
    expect(corpoDaFuncao(sql0035, "private.jornada_glow_nivel")).toContain(
      "when 1 then 20 when 2 then 30 when 3 then 50"
    );
    expect(corpoDaFuncao(sql0035, "private.jornada_marcos_def")).toContain(
      "array[500, 1000, 2500, 5000]"
    );
    const marcosSpec = linhasDaSecao(7)
      .map(([marco]) => Number(marco.replace(/[^\d]/g, "")))
      .filter((n) => n > 0);
    expect(marcosSpec).toEqual([500, 1000, 2500, 5000]);
  });

  it("§4: cortes de estágio, e Icônica N a cada 1.500 (nunca zera)", () => {
    const linhas = linhasDaSecao(4).filter(([, g]) => /^[\d.]+$/.test(g));
    const corte = (nome: string) =>
      Number(linhas.find(([e]) => e === nome)?.[1].replace(/\./g, ""));
    const estagio = corpoDaFuncao(sql0034, "public.jornada_estagio_de");
    expect(estagio).toContain(`when glow >= ${corte("Em movimento")} then 1`);
    expect(estagio).toContain(`when glow >= ${corte("Organizada")} then 2`);
    expect(estagio).toContain(`when glow >= ${corte("Prosperando")} then 3`);
    const passo = corte("Icônica II") - corte("Icônica");
    expect(passo).toBe(1500);
    expect(estagio).toContain(
      `when glow >= ${corte("Icônica")} then 4 + (glow - ${corte("Icônica")}) / ${passo}`
    );
  });

  it("§5: os 11 selos, com contador, níveis e pilar da spec", () => {
    const chaveDoSelo: Record<string, string> = {
      "Primeiros passos": "primeiros_passos",
      Planejadora: "planejadora",
      "Mão amiga": "mao_amiga",
      "Semana firme": "semana_firme",
      "Rumo à meta": "rumo_a_meta",
      "Tudo guardado": "tudo_guardado",
      "Descansar conta": "descansar_conta",
      Guardiã: "guardia",
      "Em casa": "em_casa",
      "Mês a mês": "mes_a_mes",
      "Um ano": "um_ano",
    };
    const n = (c: string) => (c === "—" ? null : Number(c));
    const daSpec = linhasDaSecao(5)
      .filter(([nome]) => nome in chaveDoSelo)
      .map(([nome, , i, ii, iii, pilar]) => [
        chaveDoSelo[nome],
        PILAR[pilar],
        n(i),
        n(ii),
        n(iii),
      ]);
    expect(daSpec).toHaveLength(11);

    const def = corpoDaFuncao(sql0035, "private.jornada_selos_def");
    const doSql = [
      ...def.matchAll(
        /\('([a-z_]+)',\s*'([a-z]+)',\s*'[a-z_]+',\s*(\d+),\s*(null(?:::integer)?|\d+),\s*(null(?:::integer)?|\d+)\)/g
      ),
    ].map((m) => [
      m[1],
      m[2],
      Number(m[3]),
      m[4].startsWith("null") ? null : Number(m[4]),
      m[5].startsWith("null") ? null : Number(m[5]),
    ]);
    expect(doSql).toEqual(daSpec);
  });

  it("§6: a trinca de missões de cada mês", () => {
    const missao: [RegExp, string][] = [
      [/^Planejar (\d+) dias$/, "planejar"],
      [/^Lançar (\d+) despesas$/, "despesa"],
      [/^Tirar (\d+) descansos$/, "descanso"],
      [/^Guardar dinheiro em (\d+) semanas$/, "semanas_guardou"],
      [/^Guardar (\d+) comprovantes no Cofre$/, "comprovante_cofre"],
      [/^◆ Sua dica ajudar (\d+) vezes$/, "dica_ajudou"],
      [/^Ter (\d+) dias fortes$/, "dias_fortes"],
      [/^◆ Sua dica proteger alguém (\d+) vez$/, "dica_protegeu"],
      [/^Ter (\d+) semanas firmes$/, "semanas_firmes"],
      [
        /^◆ Sua dica ajudar ou proteger (\d+) vezes$/,
        "dica_ajudou_ou_protegeu",
      ],
    ];
    const meses = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    const daSpec: string[] = [];
    for (const [mes, , ...trinca] of linhasDaSecao(6)) {
      const m = meses.indexOf(mes) + 1;
      if (m === 0) continue;
      trinca.slice(0, 3).forEach((texto, i) => {
        const par = missao.find(([re]) => re.test(texto));
        expect(par, `missão reconhecida: "${texto}"`).toBeDefined();
        daSpec.push(`${m}/${i + 1}/${par![1]}/${texto.match(par![0])![1]}`);
      });
    }
    expect(daSpec).toHaveLength(36);

    const doSql = [
      ...corpoDaFuncao(sql0035, "private.jornada_missoes").matchAll(
        /\((\d+), (\d+), '([a-z_]+)', (\d+)\)/g
      ),
    ].map((m) => `${m[1]}/${m[2]}/${m[3]}/${m[4]}`);
    expect(doSql).toEqual(daSpec);
  });
});

describe("J10 contrato: ordem da fila", () => {
  const ORDEM = [
    "pequena",
    "missao",
    "selo",
    "capitulo",
    "estagio",
    "marco",
    "meta",
  ];

  it("o motor concatena a fila na ordem pequena -> selo -> estágio -> meta", () => {
    const motor = corpoDaFuncao(sql0035, "private.jornada_aplicar");
    expect(motor).toContain(
      "'fila', f_pequena || f_missao || f_selo || f_capitulo || f_estagio || f_marco || f_meta"
    );
    const doSql = new Map(
      [...motor.matchAll(/'ordem', (\d), 'tipo', '([a-z]+)'/g)].map((m) => [
        m[2],
        Number(m[1]),
      ])
    );
    expect(ORDEM.map((t) => doSql.get(t))).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("os tipos do cliente (servidor.ts) têm os mesmos números de ordem", () => {
    const doTs = new Map(
      [...servidor.matchAll(/ordem: (\d);\s+tipo: "([a-z]+)"/g)].map((m) => [
        m[2],
        Number(m[1]),
      ])
    );
    expect(ORDEM.map((t) => doTs.get(t))).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("o estágio é calculado depois de TODO o Glow da chamada", () => {
    const motor = corpoDaFuncao(sql0035, "private.jornada_aplicar");
    const ultimaSoma = motor.lastIndexOf("perform private.jornada_somar_glow(");
    const estagio = motor.indexOf(
      "v_e1 := public.jornada_estagio_de(v_glow_depois);"
    );
    expect(estagio).toBeGreaterThan(ultimaSoma);
  });
});

describe("J10 contrato: segurança das funções", () => {
  const funcoes = (sql: string) =>
    [...sql.matchAll(/create or replace function ([a-z_.]+)\(/g)].map(
      (m) => m[1]
    );

  it("toda função jornada_* tem search_path fixo e vazio", () => {
    for (const [sql, nome] of [
      ...funcoes(sql0034).map((f) => [sql0034, f] as const),
      ...funcoes(sql0035).map((f) => [sql0035, f] as const),
    ]) {
      expect(corpoDaFuncao(sql, nome), nome).toContain("set search_path = ''");
    }
  });

  it("toda função é revogada de anon/authenticated nomeando as roles (furo da 0032)", () => {
    for (const sql of [sql0034, sql0035]) {
      for (const nome of funcoes(sql)) {
        const revoke = new RegExp(
          `revoke all on function ${nome.replace(".", "\\.")}\\([^)]*\\)\\s+from public, anon, authenticated, service_role;`
        );
        expect(sql, nome).toMatch(revoke);
      }
    }
  });

  it("as RPCs públicas validam auth.uid() na primeira linha e não recebem id de usuária", () => {
    for (const nome of ["public.jornada_registrar", "public.jornada_estado"]) {
      const corpo = corpoDaFuncao(sql0035, nome);
      expect(corpo).toContain("security definer");
      const assinatura = corpo.slice(0, corpo.indexOf(")\nreturns"));
      expect(assinatura).not.toMatch(/user|usuaria|autor/i);
      const codigo = corpo.slice(corpo.indexOf("declare"));
      expect(codigo).toMatch(/^declare\n\s+v_uid uuid := auth\.uid\(\);/);
      const begin = codigo.slice(codigo.indexOf("begin"));
      expect(begin).toMatch(
        /^begin\n\s+if v_uid is null then\n\s+raise exception 'jornada: sem sessão'/
      );
    }
  });

  it("o motor e o crédito de dica não são executáveis por ninguém de fora", () => {
    for (const nome of [
      "private.jornada_aplicar",
      "private.jornada_creditar_dica",
    ]) {
      expect(sql0035).not.toMatch(
        new RegExp(`grant execute on function ${nome.replace(".", "\\.")}`)
      );
    }
    expect(sql0035).toMatch(
      /grant execute on function public\.jornada_registrar\(text, uuid, uuid, text, integer\)\s+to authenticated;/
    );
  });

  it("o cliente não registra 'Isso me ajudou/protegeu' (Glow da autora)", () => {
    const corpo = corpoDaFuncao(sql0035, "public.jornada_registrar");
    const permitidas = corpo.slice(
      corpo.indexOf("not in ("),
      corpo.indexOf(") then", corpo.indexOf("not in ("))
    );
    expect(permitidas).not.toContain("dica_");
  });

  it("lib/jornada/servidor.ts não carrega regra nenhuma (só tipos e chamada)", () => {
    expect(servidor).not.toMatch(/\b(?:1200|1500|3000)\b/);
    expect(servidor).not.toMatch(/limite\s*[:=]/);
    expect(servidor).toContain('rpc("jornada_registrar"');
    expect(servidor).toContain('rpc("jornada_estado"');
  });
});

// ------------------------------------------------------------------ comportamento
// Só roda com as chaves do Supabase local E com ele no ar: sem `supabase
// start`, a suíte é pulada em vez de virar falha de ambiente.
async function supabaseLocalNoAr(): Promise<boolean> {
  const url = process.env.SUPABASE_TEST_URL;
  if (
    !url ||
    !process.env.SUPABASE_TEST_ANON_KEY ||
    !process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
  ) {
    return false;
  }
  try {
    const resposta = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: process.env.SUPABASE_TEST_ANON_KEY },
      signal: AbortSignal.timeout(2000),
    });
    return resposta.status < 500;
  } catch {
    return false;
  }
}
const temSupabaseLocal = await supabaseLocalNoAr();

describe.skipIf(!temSupabaseLocal)("J10 motor contra o Supabase local", () => {
  type Item = { ordem: number; tipo: string; [k: string]: unknown };
  type Resposta = {
    duplicada: boolean;
    concedeu: boolean;
    contou_no_dia: boolean;
    glow_ganho: number;
    glow_total: number;
    estagio: number;
    fila: Item[];
  };
  // Import tardio: sem env, tests/rede/support/env.ts lança ao ler as chaves.
  let suporte: {
    admin: SupabaseClient;
    criar: () => Promise<{ id: string; client: SupabaseClient }>;
    apagar: (u: { id: string }) => Promise<void>;
  };
  const usuarias: { id: string; client: SupabaseClient }[] = [];

  beforeAll(async () => {
    const clients = await import("../rede/support/clients");
    const users = await import("../rede/support/testUsers");
    suporte = {
      admin: clients.adminClient() as unknown as SupabaseClient,
      criar: async () => {
        const u = await users.createTestUser();
        usuarias.push(u as never);
        return { id: u.id, client: u.client as unknown as SupabaseClient };
      },
      apagar: (u) => users.deleteTestUser(u as never),
    };
  });

  afterAll(async () => {
    for (const u of usuarias) await suporte.apagar(u);
  });

  async function registra(
    client: SupabaseClient,
    acao: string,
    chave: string = randomUUID(),
    ref: string | null = null
  ): Promise<Resposta> {
    const { data, error } = await client.rpc("jornada_registrar", {
      p_acao: acao,
      p_chave: chave,
      p_ref: ref,
      p_fuso: "Europe/Lisbon",
      p_deslocamento_min: null,
    });
    expect(error).toBeNull();
    return data as Resposta;
  }

  it("dentro do limite concede; acima registra e não concede", async () => {
    const u = await suporte.criar();
    for (let i = 0; i < 3; i++) {
      const r = await registra(u.client, "despesa");
      expect(r.concedeu).toBe(true);
      expect(r.fila[0]).toMatchObject({ tipo: "pequena", glow: 5 });
    }
    const quarta = await registra(u.client, "despesa");
    expect(quarta.concedeu).toBe(false);
    expect(quarta.fila).toEqual([]);
    const { data } = await u.client
      .from("jornada_acoes")
      .select("contagem_total, ganhos_no_dia")
      .eq("acao", "despesa")
      .single();
    expect(data).toEqual({ contagem_total: 4, ganhos_no_dia: 3 });
  });

  it("chamada duplicada não concede duas vezes", async () => {
    const u = await suporte.criar();
    const chave = randomUUID();
    const [a, b] = await Promise.all([
      registra(u.client, "receita", chave),
      registra(u.client, "receita", chave),
    ]);
    expect([a.duplicada, b.duplicada].sort()).toEqual([false, true]);
    const { data } = await u.client
      .from("jornada_acoes")
      .select("contagem_total")
      .eq("acao", "receita")
      .single();
    expect(data?.contagem_total).toBe(1);
  });

  it("atendimento não concede Glow", async () => {
    const u = await suporte.criar();
    const r = await registra(u.client, "atendimento");
    expect(r.concedeu).toBe(false);
    expect(r.contou_no_dia).toBe(true);
    expect(r.fila.filter((f) => f.tipo === "pequena")).toEqual([]);
    const { data } = await u.client
      .from("jornada_saldo")
      .select("glow_organizar, glow_proteger")
      .single();
    expect(data).toEqual({ glow_organizar: 0, glow_proteger: 0 });
  });

  it("a fila sai na ordem pequena -> selo -> estágio -> meta", async () => {
    const u = await suporte.criar();
    const item = randomUUID();
    await suporte.admin
      .from("jornada_saldo")
      .insert({ user_id: u.id, glow_total: 95 });
    await suporte.admin
      .from("rede_perfis")
      .insert({ user_id: u.id, nome_exibicao: "T", cor_avatar: "rosa" });
    const { error } = await suporte.admin.from("rede_wishlist_items").insert({
      id: item,
      user_id: u.id,
      nome: "Meta",
      cor: "rosa",
      valor_alvo: 100,
      valor_atual: 100,
    });
    expect(error).toBeNull();
    const r = await registra(u.client, "guardar_meta", randomUUID(), item);
    const tipos = r.fila.map((f) => f.tipo);
    expect(tipos[0]).toBe("pequena");
    expect(tipos.indexOf("selo")).toBeGreaterThan(0);
    expect(tipos.indexOf("estagio")).toBeGreaterThan(tipos.lastIndexOf("selo"));
    expect(tipos.at(-1)).toBe("meta");
    const ordens = r.fila.map((f) => f.ordem);
    expect(ordens).toEqual([...ordens].sort((x, y) => x - y));
  });

  it("estágio não zera ao passar de Icônica: vira Icônica II", async () => {
    const u = await suporte.criar();
    await suporte.admin
      .from("jornada_saldo")
      .insert({ user_id: u.id, glow_total: 4490 });
    const r = await registra(u.client, "comprovante_cofre");
    expect(r.estagio).toBe(5);
    expect(r.fila.find((f) => f.tipo === "estagio")).toMatchObject({
      de: 4,
      para: 5,
    });
  });
});
