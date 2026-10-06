import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ACOES,
  ACOES_DA_DICA,
  TIPOS_COMEMORACAO,
  TIPOS_MISSAO,
} from "../../lib/jornada/estado";

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
    // Além das 9 da spec, só abrir_jornada (0 Glow, contador do selo
    // "Primeiros passos", §5).
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
  // Ordem dos tipos de comemoração no contrato da J11 (TIPOS_COMEMORACAO).
  const ORDEM = ["pequena", "selo", "estagio", "capitulo", "marco", "meta"];

  it("o motor concatena a fila na ordem pequena -> selo -> estágio -> meta", () => {
    const motor = corpoDaFuncao(sql0035, "private.jornada_aplicar");
    expect(motor).toContain(
      "f_pequena || f_selo || f_estagio || f_capitulo || f_marco || f_meta"
    );
    // Cada lista só recebe itens do seu tipo.
    for (const tipo of ORDEM) {
      const trechos = motor
        .split(`f_${tipo} := `)
        .slice(1)
        .map((t) => t.slice(0, t.indexOf(";\n")))
        .filter((t) => !t.startsWith("'[]'"));
      expect(trechos.length, tipo).toBeGreaterThan(0);
      for (const t of trechos) expect(t, tipo).toContain(`'tipo', '${tipo}'`);
    }
  });

  it("o cliente (TIPOS_COMEMORACAO de estado.ts) tem a mesma ordem", () => {
    expect([...TIPOS_COMEMORACAO]).toEqual(ORDEM);
  });

  it("o estágio é calculado depois de TODO o Glow da chamada", () => {
    const motor = corpoDaFuncao(sql0035, "private.jornada_aplicar");
    const ultimaSoma = motor.lastIndexOf("perform private.jornada_somar_glow(");
    const estagio = motor.indexOf(
      "v_e1 := public.jornada_estagio_de(v_glow_depois);"
    );
    expect(estagio).toBeGreaterThan(ultimaSoma);
  });

  it("atendimento adia as comemorações grandes (não a pequena)", () => {
    const motor = corpoDaFuncao(sql0035, "private.jornada_aplicar");
    expect(motor).toContain(
      "'adiada', p_acao = 'atendimento' and x.item ->> 'tipo' <> 'pequena'"
    );
  });

  it("as missões usam os nomes de tipo da J11", () => {
    const tiposTs: string[] = [...TIPOS_MISSAO];
    const missoes = corpoDaFuncao(sql0035, "private.jornada_missoes");
    const doSql = [...missoes.matchAll(/\('[a-z_]+', '([a-z_]+)'\)/g)].map(
      (m) => m[1]
    );
    expect([...doSql].sort()).toEqual([...tiposTs].sort());
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
      /grant execute on function public\.jornada_registrar\(text, text, text, integer\)\s+to authenticated;/
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

  it("o servidor aceita EXATAMENTE as ações que o cliente oferece (ACOES)", () => {
    const corpo = corpoDaFuncao(sql0035, "public.jornada_registrar");
    const inicio = corpo.indexOf("not in (");
    const permitidas = [
      ...corpo
        .slice(inicio, corpo.indexOf(") then", inicio))
        .matchAll(/'([a-z_]+)'/g),
    ].map((m) => m[1]);
    expect([...permitidas].sort()).toEqual([...ACOES].sort());
    // Toda ação oferecida tem regra no motor; as de dica também (autora).
    const regra = corpoDaFuncao(sql0035, "private.jornada_regra");
    for (const a of [...ACOES, ...ACOES_DA_DICA]) {
      expect(regra, a).toContain(`('${a}',`);
    }
    // "Primeiros passos" (§5) conta a ação que o cliente consegue enviar.
    expect(ACOES).toContain("abrir_jornada");
    expect(corpoDaFuncao(sql0035, "private.jornada_selos_def")).toMatch(
      /\('primeiros_passos',\s*'organizar',\s*'abrir_jornada'/
    );
  });

  it("todo selo é alcançável: a fonte dele é uma ação do cliente, da dica ou um contador do motor", () => {
    const def = corpoDaFuncao(sql0035, "private.jornada_selos_def");
    const fontes = [
      ...def.matchAll(/\('[a-z_]+',\s*'[a-z]+',\s*'([a-z_]+)'/g),
    ].map((m) => m[1]);
    expect(fontes).toHaveLength(11);
    const motor = corpoDaFuncao(sql0035, "private.jornada_aplicar");
    const total = corpoDaFuncao(sql0035, "private.jornada_total");
    for (const f of fontes) {
      const alcancavel =
        (ACOES as readonly string[]).includes(f) ||
        (ACOES_DA_DICA as readonly string[]).includes(f) ||
        // dias_<acao> por dia (planejar, descanso), sempre de uma ação do cliente
        (f.startsWith("dias_") &&
          (ACOES as readonly string[]).includes(f.replace("dias_", ""))) ||
        motor.includes(`'${f}'`) ||
        total.includes(`when '${f}'`);
      expect(alcancavel, f).toBe(true);
    }
  });

  it("lib/jornada/servidor.ts não carrega regra nenhuma nem redeclara o contrato", () => {
    expect(servidor).not.toMatch(/\b(?:1200|1500|3000)\b/);
    // Uma fonte só: os tipos vêm de estado.ts, nada é redeclarado aqui.
    expect(servidor).toMatch(/from "\.\/estado"/);
    expect(servidor).not.toMatch(/export (type|interface) /);
    // E o cliente chama as RPCs só por aqui.
    const cliente = ler("lib/jornada/cliente.ts");
    expect(cliente).toMatch(/from "\.\/servidor"/);
    expect(cliente).not.toContain('"jornada_registrar"');
    expect(cliente).not.toContain('"jornada_estado"');
    expect(servidor).not.toMatch(/limite\s*[:=]/);
    expect(servidor).toContain('chamar(client, "jornada_registrar"');
    expect(servidor).toContain('chamar(client, "jornada_estado"');
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
  type Item = {
    id: string;
    tipo: string;
    glow: number;
    ganhou: boolean;
    adiada: boolean;
    [k: string]: unknown;
  };
  type Resposta = {
    duplicada: boolean;
    estado: { glowTotal: number; estagio: number; [k: string]: unknown };
    comemoracoes: Item[];
  };
  // Import tardio: sem env, tests/rede/support/env.ts lança ao ler as chaves.
  let suporte: {
    admin: SupabaseClient;
    anon: SupabaseClient;
    criar: () => Promise<{ id: string; client: SupabaseClient }>;
    apagar: (u: { id: string }) => Promise<void>;
  };
  const usuarias: { id: string; client: SupabaseClient }[] = [];

  beforeAll(async () => {
    const clients = await import("../rede/support/clients");
    const users = await import("../rede/support/testUsers");
    suporte = {
      admin: clients.adminClient() as unknown as SupabaseClient,
      anon: clients.anonClient() as unknown as SupabaseClient,
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

  const pedido = (acao: string, chave: string = randomUUID()) => ({
    p_acao: acao,
    p_chave: chave,
    p_fuso: "Europe/Lisbon",
    p_deslocamento_min: 60,
  });

  async function registra(
    client: SupabaseClient,
    acao: string,
    chave?: string
  ): Promise<Resposta> {
    const { data, error } = await client.rpc(
      "jornada_registrar",
      pedido(acao, chave)
    );
    expect(error).toBeNull();
    return data as Resposta;
  }

  async function contagem(client: SupabaseClient, acao: string) {
    const { data } = await client
      .from("jornada_acoes")
      .select("contagem_total, ganhos_no_dia")
      .eq("acao", acao)
      .single();
    return data as { contagem_total: number; ganhos_no_dia: number } | null;
  }

  async function wishlist(userId: string, alvo: number, atual: number) {
    await suporte.admin
      .from("rede_perfis")
      .upsert({ user_id: userId, nome_exibicao: "T", cor_avatar: "rosa" });
    const id = randomUUID();
    const { error } = await suporte.admin.from("rede_wishlist_items").insert({
      id,
      user_id: userId,
      nome: "Meta",
      cor: "rosa",
      valor_alvo: alvo,
      valor_atual: atual,
    });
    expect(error).toBeNull();
    return id;
  }

  it("a usuária vem do auth.uid(): sem sessão a RPC recusa", async () => {
    const { error } = await suporte.anon.rpc(
      "jornada_registrar",
      pedido("despesa")
    );
    expect(error).not.toBeNull();
  });

  it("dentro do limite concede; acima a contagem sobe e não concede", async () => {
    const u = await suporte.criar();
    for (let i = 0; i < 3; i++) {
      const r = await registra(u.client, "despesa");
      expect(r.comemoracoes[0]).toMatchObject({
        tipo: "pequena",
        glow: 5,
        ganhou: true,
      });
    }
    const antes = (await registra(u.client, "receita")).estado.glowTotal;
    const quarta = await registra(u.client, "despesa");
    expect(quarta.comemoracoes[0]).toMatchObject({
      tipo: "pequena",
      glow: 0,
      ganhou: false,
    });
    expect(quarta.estado.glowTotal).toBe(antes);
    expect(await contagem(u.client, "despesa")).toEqual({
      contagem_total: 4,
      ganhos_no_dia: 3,
    });
  });

  it("chamada duplicada não concede nem conta duas vezes", async () => {
    const u = await suporte.criar();
    const chave = randomUUID();
    const [a, b] = await Promise.all([
      registra(u.client, "receita", chave),
      registra(u.client, "receita", chave),
    ]);
    expect([a.duplicada, b.duplicada].sort()).toEqual([false, true]);
    expect((await contagem(u.client, "receita"))?.contagem_total).toBe(1);
  });

  it("atendimento não concede Glow e adia o que for grande", async () => {
    const u = await suporte.criar();
    const r = await registra(u.client, "atendimento");
    expect(r.comemoracoes[0]).toMatchObject({ tipo: "pequena", glow: 0 });
    // A 1ª chamada da vida dá o selo Mês a mês: ele vem, mas adiado.
    const grandes = r.comemoracoes.filter((c) => c.tipo !== "pequena");
    expect(grandes.length).toBeGreaterThan(0);
    expect(grandes.every((c) => c.adiada)).toBe(true);
    const { data } = await u.client
      .from("jornada_saldo")
      .select("glow_organizar, glow_proteger")
      .single();
    expect(data).toEqual({ glow_organizar: 0, glow_proteger: 0 });
  });

  it("cascata: a fila sai na ordem pequena -> selo -> estágio -> meta", async () => {
    const u = await suporte.criar();
    await suporte.admin
      .from("jornada_saldo")
      .insert({ user_id: u.id, glow_total: 95 });
    await wishlist(u.id, 100, 100);
    const r = await registra(u.client, "guardar_meta");
    const tipos = r.comemoracoes.map((f) => f.tipo);
    expect(tipos[0]).toBe("pequena");
    expect(tipos.indexOf("selo")).toBeGreaterThan(0);
    expect(tipos.indexOf("estagio")).toBeGreaterThan(tipos.lastIndexOf("selo"));
    expect(tipos.at(-1)).toBe("meta");
    expect(new Set(r.comemoracoes.map((c) => c.id)).size).toBe(tipos.length);
  });

  it("cascata: marco de dinheiro conta uma vez na vida", async () => {
    const u = await suporte.criar();
    const item = await wishlist(u.id, 5000, 600);
    const r1 = await registra(u.client, "guardar_meta");
    expect(
      r1.comemoracoes.filter((c) => c.tipo === "marco").map((c) => c.marco)
    ).toEqual([500]);
    await suporte.admin
      .from("rede_wishlist_items")
      .update({ valor_atual: 100 })
      .eq("id", item);
    await registra(u.client, "guardar_meta");
    await suporte.admin
      .from("rede_wishlist_items")
      .update({ valor_atual: 600 })
      .eq("id", item);
    const r3 = await registra(u.client, "guardar_meta");
    expect(r3.comemoracoes.some((c) => c.tipo === "marco")).toBe(false);
  });

  it("cascata: a missão do mês avança pelo contador do mês", async () => {
    const u = await suporte.criar();
    const r = await registra(u.client, "despesa");
    const estado = r.estado as unknown as {
      capitulo: { missoes: { tipo: string; progresso: number }[] };
      periodos: { corrente: { mes: { contadores: Record<string, number> } } };
    };
    expect(estado.periodos.corrente.mes.contadores.despesa).toBe(1);
    for (const m of estado.capitulo.missoes) {
      if (m.tipo === "lancar_despesas") expect(m.progresso).toBe(1);
    }
  });

  it("estágio não zera ao passar de Icônica: vira Icônica II", async () => {
    const u = await suporte.criar();
    await suporte.admin
      .from("jornada_saldo")
      .insert({ user_id: u.id, glow_total: 4490 });
    const r = await registra(u.client, "comprovante_cofre");
    expect(r.estado.estagio).toBe(5);
    expect(r.comemoracoes.find((f) => f.tipo === "estagio")).toMatchObject({
      de: 4,
      estagio: 5,
    });
  });
});
