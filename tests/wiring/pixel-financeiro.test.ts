import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMockAppSeed } from "../../lib/mockAppData";
import {
  calcEarnings,
  formatBRL,
  monthConcludedCount,
  monthExpenses,
} from "../../lib/finance";
import { buildMovements } from "../../components/financeiro/movimentos";
import type { Despesa, Job, ReceitaAvulsa } from "../../lib/types";

/**
 * Pixel do Financeiro A (#206): trava a tela contra o PRÓPRIO mockup
 * normativo (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html),
 * não contra números copiados pra cá. Três partes:
 *
 *  1. Medidas: cada elemento do celular do Financeiro no mockup é achado
 *     pelo texto (ou, nos contêineres, por um pedaço único do estilo); o
 *     `style=""` dele vira a lista esperada, e o componente tem de ter um
 *     objeto de estilo com todos esses valores (os `...CARD` resolvidos).
 *  2. Tokens: os 16 blocos `.ph[data-tm][data-md]` do mockup = os blocos
 *     `--t-*` do styles/globals.css, valor a valor.
 *  3. Dados: o laboratório, no dia do mockup (quarta 23/09/2026), produz
 *     os números e as linhas que o mockup mostra.
 *
 * Teste de fiação: lê o fonte (o vitest daqui roda em node, sem JSX).
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");
const MOCKUP = read("docs/jornada/referencias/5-telas-8-temas-claro-escuro.html");
const CSS = read("styles/globals.css");

/** O celular do Financeiro no mockup (claro), até o próximo celular. */
function celular(tela: string, modo: "light" | "dark"): string {
  const ini = MOCKUP.indexOf(
    `<div class="ph" data-t="${tela}" data-tm="pink-neon" data-md="${modo}"`
  );
  if (ini === -1) throw new Error(`celular ${tela}/${modo} não achado`);
  const fim = MOCKUP.indexOf('<div class="ph"', ini + 10);
  return MOCKUP.slice(ini, fim === -1 ? undefined : fim);
}
const FIN = celular("financeiro", "light");

// ---------------------------------------------------------------------------
// Estilo: mockup (CSS inline) x componente (objetos de estilo do React)
// ---------------------------------------------------------------------------

type Estilo = Record<string, string>;

const camel = (p: string) => p.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
/** Sem aspas e sem espaço: "repeat(2, minmax(0, 1fr))" = repeat(2,minmax(0,1fr)). */
const norm = (v: string) => v.replace(/["'\s]/g, "");

/** `font-size:36px;font-weight:800` -> { fontSize: "36px", fontWeight: "800" }.
 * Propriedade repetida: vale a última (como no navegador). */
function cssInline(estilo: string): Estilo {
  const out: Estilo = {};
  for (const d of estilo.split(";")) {
    const i = d.indexOf(":");
    if (i === -1) continue;
    out[camel(d.slice(0, i).trim())] = norm(d.slice(i + 1));
  }
  return out;
}

/** O estilo do elemento do mockup cujo texto próprio começa com `texto`. */
function estiloDoTexto(texto: string): Estilo {
  const m = FIN.match(
    new RegExp(`<(\\w+) style="([^"]*)">(?:<svg[\\s\\S]*?</svg>)?${texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
  );
  if (!m) throw new Error(`"${texto}" não está no mockup do Financeiro`);
  return cssInline(m[2]);
}

/** O estilo inteiro do primeiro elemento do mockup cujo style contém `pedaco`. */
function estiloDoConteiner(pedaco: string): Estilo {
  const m = FIN.match(
    new RegExp(`style="([^"]*${pedaco.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"]*)"`)
  );
  if (!m) throw new Error(`nenhum style do mockup contém "${pedaco}"`);
  return cssInline(m[1]);
}

/** O estilo do elemento do mockup cujo style termina em `fim` (pra
 * separar o card pequeno do card do saldo, que começa igual). */
function estiloQueTermina(fim: string): Estilo {
  const m = FIN.match(
    new RegExp(`style="([^"]*${fim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})"`)
  );
  if (!m) throw new Error(`nenhum style do mockup termina em "${fim}"`);
  return cssInline(m[1]);
}

/** O estilo do elemento que abre logo antes de `filho` (o pai dele). */
function estiloDoPai(filho: string): Estilo {
  const i = FIN.indexOf(filho);
  if (i === -1) throw new Error(`"${filho}" não está no mockup`);
  const m = FIN.slice(0, i).match(/style="([^"]*)">$/);
  if (!m) throw new Error(`"${filho}" não abre logo depois de um pai com style`);
  return cssInline(m[1]);
}

/** Separa por vírgula de nível zero (fora de aspas, parênteses e chaves). */
function partes(corpo: string): string[] {
  const out: string[] = [];
  let nivel = 0;
  let aspas: string | null = null;
  let atual = "";
  for (const c of corpo) {
    if (aspas) {
      if (c === aspas) aspas = null;
    } else if (c === '"' || c === "'" || c === "`") aspas = c;
    else if ("([{".includes(c)) nivel++;
    else if (")]}".includes(c)) nivel--;
    else if (c === "," && nivel === 0) {
      out.push(atual);
      atual = "";
      continue;
    }
    atual += c;
  }
  if (atual.trim()) out.push(atual);
  return out.map((p) => p.trim()).filter(Boolean);
}

/**
 * Todos os objetos de estilo de um fonte: `style={{ ... }}` e
 * `const NOME[: CSSProperties] = { ... }`, com os `...NOME` resolvidos.
 */
function objetosDeEstilo(src: string): Estilo[] {
  /** O corpo entre `{` (em `abre`) e a `}` que o fecha. */
  const corpoDe = (abre: number): string => {
    let nivel = 0;
    for (let i = abre; i < src.length; i++) {
      if (src[i] === "{") nivel++;
      else if (src[i] === "}" && --nivel === 0) return src.slice(abre + 1, i);
    }
    return "";
  };
  const constantes: Record<string, string> = {};
  for (const m of src.matchAll(/const (\w+)(?:: CSSProperties)? = \{/g))
    constantes[m[1]] = corpoDe(m.index! + m[0].length - 1);
  const corpos = [
    ...Object.values(constantes),
    ...[...src.matchAll(/style=\{\{/g)].map((m) => corpoDe(m.index! + 7)),
  ];
  const ler = (corpo: string, fundo = 0): Estilo => {
    const out: Estilo = {};
    for (const p of partes(corpo)) {
      if (p.startsWith("...")) {
        const nome = p.slice(3).trim();
        if (constantes[nome] && fundo < 3)
          Object.assign(out, ler(constantes[nome], fundo + 1));
        continue;
      }
      const i = p.indexOf(":");
      if (i === -1) continue;
      out[p.slice(0, i).trim()] = norm(p.slice(i + 1));
    }
    return out;
  };
  return corpos.map((c) => ler(c));
}

/** Um valor do fonte bate com o do mockup: igual, ou um dos lados de um
 * ternário (`sobe ? "var(--t-gsoft)" : "var(--t-rsoft)"`). */
function bate(fonte: string | undefined, mockup: string): boolean {
  if (fonte === undefined) return false;
  if (fonte === mockup) return true;
  return fonte.includes("?") && fonte.split(/[?:]/).some((l) => l === mockup);
}

/** O fonte tem um objeto de estilo com todos os valores do mockup. */
function esperarEstilo(
  arquivos: string[],
  esperado: Estilo,
  descricao: string,
  ignorar: string[] = []
) {
  const alvo = Object.entries(esperado).filter(([k]) => !ignorar.includes(k));
  const objetos = arquivos.flatMap((a) => objetosDeEstilo(read(a)));
  const achou = objetos.some((o) => alvo.every(([k, v]) => bate(o[k], v)));
  if (!achou) {
    // Mensagem útil: o objeto mais parecido e o que falta nele.
    const melhor = objetos
      .map((o) => ({ o, falta: alvo.filter(([k, v]) => !bate(o[k], v)) }))
      .sort((a, b) => a.falta.length - b.falta.length)[0];
    throw new Error(
      `${descricao}: nenhum estilo em ${arquivos.join(", ")} tem ` +
        `${JSON.stringify(Object.fromEntries(alvo))}; o mais perto falta ` +
        `${JSON.stringify(Object.fromEntries(melhor?.falta ?? []))}`
    );
  }
}

const TAB = "components/financeiro/FinanceiroTab.tsx";
const HERO = "components/financeiro/FinanceiroHeroCard.tsx";
const VISAO = "components/financeiro/VisaoTab.tsx";
const LINK = "components/ui/LinkSecao.tsx";

describe("Pixel Financeiro A — medidas iguais às do mockup", () => {
  // [descrição, como achar no mockup, arquivos do app, props fora do teste]
  const CASOS: [string, () => Estilo, string[], string[]?][] = [
    // A coluna: o padding é da casca (app/page.tsx), não da tela.
    ["coluna da tela", () => estiloDoConteiner("padding:24px 16px 120px"), [TAB], ["padding"]],
    ["linha do cabeçalho", () => estiloDoPai('<div style="width:42px'), [TAB]],
    ['título "Financeiro"', () => estiloDoTexto("Financeiro<"), [TAB]],
    ["mês do cabeçalho", () => estiloDoTexto("Setembro de 2026"), [TAB]],
    ["grade dos cards", () => estiloDoConteiner("display:grid"), [HERO]],
    ['card "Saldo do mês"', () => estiloDoConteiner("grid-column:span 2"), [HERO]],
    ['rótulo "Saldo do mês"', () => estiloDoTexto("Saldo do mês"), [HERO]],
    ["pílula de variação", () => estiloDoTexto("-56% vs agosto"), [HERO]],
    ["saldo (36px)", () => estiloDoTexto("R$ 217"), [HERO], ["color"]],
    ["barra entrou x saiu", () => estiloDoConteiner("height:8px;border-radius:4px"), [HERO]],
    ['linha "Entrou / Saiu"', () => estiloDoConteiner("justify-content:space-between;font-size:11px"), [HERO]],
    ["card pequeno", () => estiloQueTermina("flex-direction:column;gap:6px;"), [HERO]],
    ['rótulo "Entradas"', () => estiloDoTexto("Entradas"), [HERO]],
    ["valor do card (20px)", () => estiloDoTexto("R$ 530"), [HERO]],
    ['apoio "lançamentos"', () => estiloDoTexto("4 lançamentos"), [HERO]],
    ['cabeçalho de "Recentes"', () => estiloDoConteiner("align-items:center;margin-top:4px"), [VISAO]],
    ['título "Recentes"', () => estiloDoTexto("Recentes"), [VISAO]],
    ['link "Extrato ›"', () => estiloDoTexto("Extrato ›"), [LINK]],
    ["card das listas", () => estiloDoConteiner("background:var(--t-card);border-radius:20px;padding:4px 16px"), [VISAO]],
    // A borda vem do divisor (só entre linhas); testada à parte.
    ["linha de Recentes", () => estiloDoConteiner("padding:11px 0"), [VISAO], ["borderBottom"]],
    ["data de Recentes", () => estiloDoTexto("22 SET"), [VISAO]],
    ["descrição de Recentes", () => estiloDoTexto("Almoço entre atendimentos"), [VISAO]],
    ['título "Mais lançamentos"', () => estiloDoTexto("Mais lançamentos"), [VISAO]],
    ["linha de Mais lançamentos", () => estiloDoConteiner("padding:12px 0"), [VISAO], ["borderBottom"]],
    ["avatar de Mais lançamentos", () => estiloDoConteiner("width:40px;height:40px;border-radius:12px"), [VISAO]],
    ["nome de Mais lançamentos", () => estiloDoTexto("Material de trabalho"), [VISAO]],
    ["data de Mais lançamentos", () => estiloDoTexto("18 set."), [VISAO]],
  ];

  for (const [descricao, mockup, arquivos, ignorar] of CASOS) {
    it(descricao, () => esperarEstilo(arquivos, mockup(), descricao, ignorar));
  }

  it("divisor entre linhas: a borda do mockup, só entre linhas (a última sem)", () => {
    expect(estiloDoConteiner("padding:11px 0").borderBottom).toBe(
      "1pxsolidvar(--t-line)"
    );
    expect(read(VISAO)).toContain(
      'i < total - 1 ? { borderBottom: "1px solid var(--t-line)" } : undefined;'
    );
  });

  it("valor das listas: 13px em Recentes e 14px em Mais lançamentos, 800, verde/vermelho do mockup", () => {
    const recente = estiloDoTexto("-R$ 28");
    const mais = estiloDoTexto("-R$ 64");
    const src = read(VISAO);
    expect(src).toContain(`<Valor m={m} tamanho="${recente.fontSize}" />`);
    expect(src).toContain(`<Valor m={m} tamanho="${mais.fontSize}" />`);
    expect(src).toMatch(
      new RegExp(`fontSize: tamanho,\\s*fontWeight: ${recente.fontWeight},`)
    );
    expect(src).toMatch(
      new RegExp(
        `color: m\\.positive \\? "var\\(--t-green\\)" : "${recente.color.replace(/[()]/g, "\\$&")}"`
      )
    );
  });

  it("barra entrou x saiu: verde e vermelho do mockup", () => {
    const src = read(HERO);
    expect(src).toContain('style={{ flex: totalEntradaMes, background: "var(--t-green)" }}');
    expect(src).toContain('style={{ flex: totalDespMes, background: "var(--t-red)" }}');
  });

  it("ícones dos 4 cards: mesma cor e mesmo traço do mockup", () => {
    const src = read(HERO);
    for (const [rotulo, cor] of [
      ["Entradas", "var(--t-green)"],
      ["Saídas", "var(--t-red)"],
      ["Meta", "var(--t-deep)"],
      ["Ticket médio", "var(--t-deep)"],
    ]) {
      const card = FIN.slice(
        FIN.lastIndexOf("<section", FIN.indexOf(`>${rotulo}</span>`)),
        FIN.indexOf(`>${rotulo}</span>`)
      );
      expect(card, rotulo).toContain(`<span style="color:${cor}">`);
      expect(src, rotulo).toContain(`<Icone cor="${cor}">`);
      for (const d of card.matchAll(/<path d="([^"]+)"/g))
        expect(src, `${rotulo}: ${d[1]}`).toContain(`<path d="${d[1]}" />`);
    }
  });

  it("cabeçalho: avatar e Novo são as peças da casca (desenho do mockup, toque de 44px)", () => {
    const src = read(TAB);
    expect(src).toContain(
      'import { AvatarAjustes, BotaoNovo } from "@/components/ui/cabecalho";'
    );
    expect(src).toMatch(/<AvatarAjustes\s+inicial=\{avatar\.inicial\}/);
    expect(src).toContain("<BotaoNovo onClick={acaoNovo}>Novo</BotaoNovo>");
  });

  it('"Extrato ›": desenho do mockup com toque de 44×44, sem crescer a linha', () => {
    const src = read(LINK);
    expect(src).toContain("const ALTURA_TEXTO = 18;");
    expect(src).toContain("const ALVO_MINIMO = 44;");
    expect(src).toContain("minHeight: `${ALVO_MINIMO}px`,");
    expect(src).toContain("minWidth: `${ALVO_MINIMO}px`,");
    expect(src).toContain("margin: `-${(ALVO_MINIMO - ALTURA_TEXTO) / 2}px 0`,");
    expect(read(VISAO)).toContain(
      "<LinkSecao onClick={onExtrato}>Extrato ›</LinkSecao>"
    );
  });
});

// ---------------------------------------------------------------------------
// Tokens --t-*: globals.css = mockup, nos 8 temas × claro/escuro
// ---------------------------------------------------------------------------

const TEMAS = [
  "grafite",
  "pink-neon",
  "purple",
  "crimson",
  "ocean",
  "gold",
  "emerald",
  "midnight",
] as const;

function variaveis(corpo: string): Record<string, string> {
  const out: Record<string, string> = {};
  // A última declaração do bloco do mockup vem sem ";".
  for (const m of corpo.matchAll(/(--t-[\w-]+)\s*:\s*([^;]+?)\s*(?=;|$)/g))
    out[m[1]] = m[2].replace(/\s+/g, "");
  return out;
}

describe("Pixel Financeiro A — tokens --t-* = os do mockup", () => {
  const bloco = CSS.slice(CSS.indexOf("/* ── Tokens do mockup normativo (--t-*)"));

  for (const tema of TEMAS)
    for (const modo of ["light", "dark"] as const) {
      it(`${tema} ${modo === "light" ? "claro" : "escuro"}`, () => {
        const mock = MOCKUP.match(
          new RegExp(`\\.ph\\[data-tm="${tema}"\\]\\[data-md="${modo}"\\]\\s*\\{([^}]*)\\}`)
        );
        expect(mock, "bloco do mockup").not.toBeNull();
        const seletor =
          modo === "light"
            ? `[data-mode="light"][data-theme="${tema}"]`
            : `[data-theme="${tema}"]`;
        // O seletor exato abre uma regra (sozinho ou numa lista com vírgula).
        const app = [...bloco.matchAll(/([^{}]+)\{([^}]*)\}/g)].find((r) =>
          r[1].split(",").some((s) => s.trim() === seletor)
        );
        expect(app, `bloco ${seletor} em globals.css`).toBeDefined();
        const esperado = variaveis(mock![1]);
        expect(Object.keys(esperado).length).toBeGreaterThan(20);
        expect(variaveis(app![2])).toEqual(esperado);
      });
    }
});

// ---------------------------------------------------------------------------
// Dados: o laboratório no dia do mockup produz o que o mockup mostra
// ---------------------------------------------------------------------------

describe("Pixel Financeiro A — dados do laboratório = os do mockup", () => {
  afterEach(() => vi.useRealTimers());

  /** Mesmo mapeamento de linha -> tipo do FinanceiroTab. */
  function seed() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 23, 10, 0)); // quarta 23/09/2026
    const t = buildMockAppSeed().tables as Record<string, Record<string, unknown>[]>;
    const jobs = t.jobs.map((r) => ({
      id: r.id,
      clienteNome: r.cliente_nome,
      data: r.data,
      hora: r.hora,
      valor: r.valor,
      status: r.status,
    })) as unknown as Job[];
    const despesas = t.despesas as unknown as Despesa[];
    const receitas = t.receitas_avulsas as unknown as ReceitaAvulsa[];
    return { jobs, despesas, receitas };
  }

  /** "R$ 530" -> o texto do app pelo mesmo formatBRL. */
  const brl = (n: number) => formatBRL(n).replace(/\u00a0/g, " ");
  const re = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /** O texto do mockup logo depois de `antes` (o valor de um rótulo). */
  const doMockup = (antes: RegExp) => {
    const m = FIN.match(antes);
    if (!m) throw new Error(`${antes} não está no mockup`);
    return m[1];
  };

  function numeros() {
    const { jobs, despesas, receitas } = seed();
    const noMes = (d: string) => d.startsWith("2026-09");
    const entrou = calcEarnings(jobs, receitas, "mes");
    const saiu = monthExpenses(despesas);
    const ref = new Date(2026, 7, 1);
    const prev =
      calcEarnings(jobs, receitas, "mes", ref) - monthExpenses(despesas, ref);
    const pct = Math.round(((entrou - saiu - prev) / Math.abs(prev)) * 100);
    return {
      jobs,
      despesas,
      receitas,
      entrou: brl(entrou),
      saiu: brl(saiu),
      saldo: brl(entrou - saiu),
      variacao: `${pct >= 0 ? "+" : ""}${pct}% vs agosto`,
      qtdEntradas: `${monthConcludedCount(jobs) + receitas.filter((r) => noMes(r.data)).length} lançamentos`,
      qtdSaidas: `${despesas.filter((d) => noMes(d.data)).length} lançamentos`,
    };
  }

  const MOCK = {
    entrou: () => doMockup(/<span>Entrou ([^<]+)<\/span>/),
    saiu: () => doMockup(/<span>Saiu ([^<]+)<\/span>/),
    saldo: () => doMockup(/letter-spacing:-1px">([^<]+)</),
    variacao: () => doMockup(/border-radius:999px;[^"]*">([^<]+)</),
    qtdEntradas: () => doMockup(/>Entradas<\/span><span[^>]*>[^<]+<\/span><span[^>]*>([^<]+)</),
    qtdSaidas: () => doMockup(/>Saídas<\/span><span[^>]*>[^<]+<\/span><span[^>]*>([^<]+)</),
  };

  it("iguais ao mockup: Saiu, quantidade de lançamentos de Entradas e de Saídas", () => {
    const app = numeros();
    expect(app.saiu).toBe(MOCK.saiu());
    expect(app.qtdEntradas).toBe(MOCK.qtdEntradas());
    expect(app.qtdSaidas).toBe(MOCK.qtdSaidas());
    // O card Saídas mostra o mesmo total do "Saiu".
    expect(FIN).toMatch(new RegExp(`>Saídas</span><span[^>]*>${re(MOCK.saiu())}<`));
  });

  /** As linhas de Recentes do mockup e do app: [data, descrição, valor]. */
  function recentes() {
    const { jobs, despesas, receitas } = numeros();
    const i = FIN.indexOf(">Recentes</h2>");
    const fim = FIN.indexOf(">Mais lançamentos</h2>");
    const mock = [
      ...FIN.slice(i, fim).matchAll(
        /font-weight:700;color:var\(--t-mut\)">([^<]+)<\/span><div[^>]*>([^<]+)<\/div><span[^>]*>([^<]+)</g
      ),
    ].map((m) => [m[1], m[2], m[3]]);
    const MES = ["", "JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const app = buildMovements(jobs, despesas, receitas)
      .slice(0, 3)
      .map((m) => {
        const [, mes, dia] = m.data.split("-");
        return [`${dia} ${MES[Number(mes)]}`, m.desc, `${m.positive ? "+" : "-"}${brl(m.valor)}`];
      });
    return { mock, app };
  }

  it("Recentes: as duas primeiras linhas iguais às do mockup (data, descrição, valor)", () => {
    const { mock, app } = recentes();
    expect(mock).toHaveLength(3);
    expect(app.slice(0, 2)).toEqual(mock.slice(0, 2));
  });

  /** As linhas de Mais lançamentos: [data, descrição, valor]. */
  function mais() {
    const { jobs, despesas, receitas } = numeros();
    const i = FIN.indexOf(">Mais lançamentos</h2>");
    const mock = [
      ...FIN.slice(i).matchAll(
        /font-size:14px;font-weight:700">([^<]+)<\/div><div style="font-size:11px;color:var\(--t-mut\)">([^<]+)<\/div><\/div><span[^>]*>([^<]+)</g
      ),
    ].map((m) => [m[2], m[1], m[3]]);
    const app = buildMovements(jobs, despesas, receitas)
      .slice(3)
      .map((m) => {
        const d = new Date(`${m.data}T00:00:00`);
        return [
          `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleDateString("pt-BR", { month: "short" })}`,
          m.desc,
          `${m.positive ? "+" : "-"}${brl(m.valor)}`,
        ];
      });
    return { mock, app };
  }

  it("Mais lançamentos: as saídas do mockup são as do laboratório (data, descrição, valor), na ordem", () => {
    const { mock, app } = mais();
    const saidas = (l: string[][]) => l.filter((x) => x[2].startsWith("-"));
    expect(saidas(mock).length).toBeGreaterThan(0);
    // O mockup mostra 6 linhas; o app mostra até 7 (top 10 - 3 recentes):
    // compara as saídas até a data da última linha do mockup.
    const ultima = mock[mock.length - 1][0];
    const ate = app.findIndex((x) => x[0] === ultima);
    expect(saidas(app.slice(0, ate + 1))).toEqual(saidas(mock));
  });

  /**
   * Divergências conhecidas, travadas dos DOIS lados. O mockup da Agenda
   * (que a #204 seguiu no laboratório) tem Camila Duarte concluída em
   * 20/09 por R$ 120; o do Financeiro tem Sônia Aparecida em 20/09 por
   * R$ 150 e Camila em 17/09. Um laboratório só não atende os dois sem
   * quebrar a Agenda, então vale o da Agenda e o Financeiro difere aqui.
   * Se um dos lados mudar (mockup ou laboratório), este teste cai e a
   * lista tem de ser revista.
   */
  it("divergências conhecidas (Agenda x Financeiro no mockup): Entrou, Saldo, variação e a 3ª linha de Recentes", () => {
    const app = numeros();
    const DIVERGENCIAS: [string, string, string][] = [
      // [o quê, mockup, app]
      ["Entrou", MOCK.entrou(), app.entrou],
      ["Saldo", MOCK.saldo(), app.saldo],
      ["variação", MOCK.variacao(), app.variacao],
    ];
    expect(DIVERGENCIAS.map(([o, m, a]) => [o, m, a])).toEqual([
      ["Entrou", "R$ 530", "R$ 500"],
      ["Saldo", "R$ 217", "R$ 187"],
      ["variação", "-56% vs agosto", "-62% vs agosto"],
    ]);
    const { mock, app: linhas } = recentes();
    expect([mock[2], linhas[2]]).toEqual([
      ["20 SET", "Sônia Aparecida", "+R$ 150"],
      ["20 SET", "Camila Duarte", "+R$ 120"],
    ]);
    // Entradas de Mais lançamentos: as do mockup não existem no
    // laboratório (que segue a Agenda); as do laboratório são as de antes.
    const m2 = mais();
    const entradas = (l: string[][]) => l.filter((x) => x[2].startsWith("+"));
    expect(entradas(m2.mock)).toEqual([
      ["20 set.", "Sônia Aparecida", "+R$ 150"],
      ["17 set.", "Camila Duarte", "+R$ 120"],
      ["14 set.", "Renata Ferreira", "+R$ 110"],
    ]);
    expect(entradas(m2.app)).toEqual([
      ["19 set.", "Venda de kit de esmaltes", "+R$ 60"],
      ["14 set.", "Comissão de indicação", "+R$ 40"],
      ["13 set.", "Helena Brito", "+R$ 280"],
    ]);
  });
});
