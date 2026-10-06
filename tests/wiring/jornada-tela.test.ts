import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  contadorDaSemana,
  diasRestantes,
  faltaProProximo,
  fracaoDoEstagio,
  mesesDaColecao,
  missoesFeitas,
} from "../../components/jornada/progresso";
import {
  estadoJornadaContaNova,
  estadoJornadaExemplo,
} from "../../lib/mockJornada";

/**
 * J12 (#162) — a tela "Sua Jornada" e o card no Início.
 *
 * O ambiente de teste é node (sem DOM), então a fiação é conferida no
 * código-fonte e as contas de leitura (`components/jornada/progresso.ts`)
 * são testadas direto, com os estados do laboratório.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");

const CARD = "components/home/JornadaCard.tsx";
const TELA = "components/jornada/JornadaScreen.tsx";
const HOOK = "components/jornada/useJornada.ts";
const LAB = "app/dev-preview/app/page.tsx";

/** A tela e as peças dela (tudo em components/jornada, menos o hook). */
const DA_TELA = readdirSync(join(ROOT, "components/jornada"))
  .filter((n) => /\.(ts|tsx)$/.test(n))
  .map((n) => `components/jornada/${n}`)
  .filter((f) => f !== HOOK);
const TODOS = [CARD, ...DA_TELA];

function soCodigo(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/^\s*["']use client["'];?\s*$/gm, "");
}

/** Caminhos de todos os `import ... from "x"`. */
function importsDe(src: string): string[] {
  return [...src.matchAll(/^import[\s\S]*?from\s+["']([^"']+)["'];?$/gm)].map(
    (m) => m[1]
  );
}

/** Lista de classes CSS (`"flex items-center"`, `"1px solid var(--x)"`). */
function ehListaDeClasses(s: string): boolean {
  const pedacos = s.trim().split(/\s+/).filter(Boolean);
  return (
    pedacos.length > 0 &&
    pedacos.every((p) => /^[a-z0-9!:_\-[\]/.%&>()#=,]+$/.test(p)) &&
    pedacos.some((p) => /[-:[]/.test(p))
  );
}

function pareceTexto(s: string): boolean {
  const t = s.replace(/\$\{[^}]*\}/g, " ").trim();
  if (!t || ehListaDeClasses(t)) return false;
  return /[À-ÿ]/.test(t) || /[A-Za-zÀ-ÿ]{2,}\s+[A-Za-zÀ-ÿ]{2,}/.test(t);
}

/** Texto escrito no fonte: literais de string e texto solto no JSX. */
function textosEscritos(src: string): string[] {
  const codigo = soCodigo(src);
  const literais = [
    ...codigo.matchAll(
      /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g
    ),
  ].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
  // Texto entre `>` e `<` que não é código (sem =, ;, parênteses, chaves).
  const jsx = [...codigo.matchAll(/>([^<>{}]+)</g)]
    .map((m) => m[1])
    .filter((t) => /[A-Za-zÀ-ÿ]/.test(t) && !/[=;(){}&|?]/.test(t));
  // Texto solto com uma palavra só também é texto de interface no JSX.
  const jsxSoltas = jsx.filter((t) => /[A-Za-zÀ-ÿ]{2,}/.test(t.trim()));
  return [...literais.filter(pareceTexto), ...jsxSoltas];
}

/** O bloco da J12 no globals.css (do comentário até o fim do arquivo). */
const CSS = read("styles/globals.css");
const INICIO_BLOCO = CSS.indexOf("/* ── Sua Jornada (J12, #162)");
const BLOCO = CSS.slice(INICIO_BLOCO);
const ANTES = CSS.slice(0, INICIO_BLOCO);

// ---------------------------------------------------------------------------

describe("card e tela usam o useJornada de verdade", () => {
  it("o hook existe no caminho real", () => {
    expect(existsSync(join(ROOT, HOOK))).toBe(true);
  });

  it("o card importa useJornada de components/jornada/useJornada", () => {
    const src = read(CARD);
    expect(importsDe(src)).toContain("@/components/jornada/useJornada");
    expect(src).toMatch(/useJornada\(userId\)/);
  });

  it("a tela importa useJornada de ./useJornada (mesmo arquivo)", () => {
    const src = read(TELA);
    expect(importsDe(src)).toContain("./useJornada");
    expect(src).toMatch(/useJornada\(userId\)/);
  });

  it.each(TODOS)(
    "%s não importa o cliente da Jornada nem o Supabase",
    (arquivo) => {
      const imports = importsDe(read(arquivo));
      expect(imports.filter((i) => /jornada\/cliente|supabase/i.test(i))).toEqual(
        []
      );
    }
  );

  it.each(TODOS)("%s não mostra nada do perfil público", (arquivo) => {
    expect(soCodigo(read(arquivo))).not.toMatch(/mostrarNoPerfil/);
  });
});

describe("nenhum número de Glow nem texto escrito no card e na tela", () => {
  it("a varredura cobre o card, a tela e as peças", () => {
    expect(TODOS).toEqual(
      expect.arrayContaining([
        CARD,
        TELA,
        "components/jornada/JornadaEstagio.tsx",
        "components/jornada/JornadaCapitulo.tsx",
        "components/jornada/JornadaColecao.tsx",
        "components/jornada/JornadaDinheiro.tsx",
        "components/jornada/JornadaPilares.tsx",
        "components/jornada/JornadaSelos.tsx",
        "components/jornada/JornadaAjustes.tsx",
      ])
    );
  });

  it.each(TODOS)("%s não escreve número de Glow", (arquivo) => {
    const codigo = soCodigo(read(arquivo));
    // Cortes de estágio da spec §4 e o passo da Icônica.
    expect(codigo).not.toMatch(/(?<![\w.])(100|400|1200|1500|3000)(?![\w.])/);
    // Nenhuma linha que fala de Glow tem número maior que 1.
    const linhas = codigo
      .split("\n")
      .filter((l) => /glow/i.test(l))
      .filter((l) => /(?<![\w.])(?:[2-9]|\d{2,})(?![\w.])/.test(l));
    expect(linhas).toEqual([]);
  });

  it.each(TODOS)("%s não tem texto visível escrito no código", (arquivo) => {
    expect(textosEscritos(read(arquivo))).toEqual([]);
  });

  it.each(TODOS)("%s não tem símbolo de moeda", (arquivo) => {
    expect(soCodigo(read(arquivo))).not.toMatch(/€|R\$|\bEUR\b|currency/);
  });

  it("o detector pega texto no JSX e em string, e deixa classe passar", () => {
    expect(textosEscritos("<span>Sua Jornada</span>")).toEqual(["Sua Jornada"]);
    expect(textosEscritos("<b>Selos</b>")).toEqual(["Selos"]);
    expect(textosEscritos('const t = "último dia";')).toEqual(["último dia"]);
    expect(
      textosEscritos('<p className="flex items-center gap-2">{x}</p>')
    ).toEqual([]);
    expect(textosEscritos("<span aria-hidden>·</span>")).toEqual([]);
  });
});

describe("estados discretos: a Jornada nunca bloqueia o Início", () => {
  it("sem estado, o card não aparece", () => {
    expect(soCodigo(read(CARD))).toMatch(/if \(!estado\) return null;/);
  });

  it("a tela mostra carregando e erro com os textos de textos.ts", () => {
    const src = soCodigo(read(TELA));
    expect(src).toMatch(/\{CARREGANDO\}/);
    expect(src).toMatch(/\{MENSAGEM_ERRO\[erro\]\}/);
    expect(src).toMatch(/role="dialog"/);
  });

  it("o Modo discreto grava pela preferência do hook", () => {
    expect(soCodigo(read(TELA))).toMatch(/salvarPreferencias\(parcial\)/);
    expect(soCodigo(read("components/jornada/JornadaAjustes.tsx"))).toMatch(
      /role="switch"/
    );
  });
});

describe("as leituras do estado (progresso.ts)", () => {
  const hoje = new Date(2026, 9, 15); // quinta, 15/10/2026

  it("exemplo: fração e quanto falta saem dos cortes que o servidor mandou", () => {
    const e = estadoJornadaExemplo(hoje);
    expect(fracaoDoEstagio(e)).toBeCloseTo(
      (e.glowTotal - e.glowInicioEstagio) /
        (e.glowProximoEstagio - e.glowInicioEstagio)
    );
    expect(faltaProProximo(e)).toBe(e.glowProximoEstagio - e.glowTotal);
    expect(contadorDaSemana(e, "dias_fortes")).toBe(2);
    expect(missoesFeitas(e.capitulo!)).toBe(0);
  });

  it("exemplo: coleção com mês em branco, mês fechado e o mês atual", () => {
    const e = estadoJornadaExemplo(hoje);
    expect(mesesDaColecao(e, hoje)).toEqual([
      { ano: 2026, mes: 7, situacao: "branco" },
      { ano: 2026, mes: 8, situacao: "fechado" },
      { ano: 2026, mes: 9, situacao: "branco" },
      { ano: 2026, mes: 10, situacao: "atual" },
    ]);
  });

  it("conta nova: nada andado, nada na semana, só o mês atual na coleção", () => {
    const e = estadoJornadaContaNova(hoje);
    expect(fracaoDoEstagio(e)).toBe(0);
    expect(faltaProProximo(e)).toBe(e.glowProximoEstagio);
    expect(contadorDaSemana(e, "dias_fortes")).toBe(0);
    expect(mesesDaColecao(e, hoje)).toEqual([
      { ano: 2026, mes: 10, situacao: "atual" },
    ]);
  });

  it("dias que faltam no capítulo: 0 no último dia e fora do mês", () => {
    const c = estadoJornadaExemplo(hoje).capitulo!;
    expect(diasRestantes(c, hoje)).toBe(16);
    expect(diasRestantes(c, new Date(2026, 9, 31))).toBe(0);
    expect(diasRestantes(c, new Date(2026, 10, 2))).toBe(0);
  });

  it("estágio sem tamanho (cortes iguais) não divide por zero", () => {
    const e = {
      ...estadoJornadaContaNova(hoje),
      glowProximoEstagio: 0,
    };
    expect(fracaoDoEstagio(e)).toBe(0);
  });
});

describe("o laboratório monta o card e a tela dos caminhos reais", () => {
  const lab = read(LAB);

  it("importa JornadaCard e JornadaScreen dos arquivos de verdade", () => {
    expect(importsDe(lab)).toEqual(
      expect.arrayContaining([
        "@/components/home/JornadaCard",
        "@/components/jornada/JornadaScreen",
      ])
    );
  });

  it("o card fica no Início, depois da grade e antes da Agenda", () => {
    const inicio = lab.indexOf('<TabPanel tab="home"');
    const fim = lab.indexOf("</TabPanel>", inicio);
    const home = lab.slice(inicio, fim);
    const card = home.indexOf("<JornadaCard");
    expect(card).toBeGreaterThan(home.indexOf("<CofreCard"));
    expect(card).toBeLessThan(home.indexOf("<SemanaSection"));
  });

  it("a tela abre pelo card e usa o estado de laboratório", () => {
    expect(lab).toMatch(/onAbrir=\{\(\) => setJornadaAberta\(true\)\}/);
    expect(lab).toMatch(/jornadaAberta && \(\s*<JornadaScreen/);
    expect(lab).toMatch(/usarTransporteDeLaboratorio\(/);
    expect(lab).toMatch(/estadoJornadaContaNova\(\)/);
  });

  it("app/page.tsx (o app de verdade) ainda não mostra a Jornada", () => {
    expect(read("app/page.tsx")).not.toMatch(/JornadaCard|JornadaScreen/);
  });
});

describe("globals.css: só tokens --j-* novos", () => {
  it("o bloco da J12 existe e é o último do arquivo", () => {
    expect(INICIO_BLOCO).toBeGreaterThan(-1);
    expect(BLOCO.match(/\{/g)).toHaveLength(1);
    expect(BLOCO.trimEnd().endsWith("}")).toBe(true);
  });

  it("todo token do bloco é --j-*", () => {
    const corpo = BLOCO.slice(BLOCO.indexOf("{") + 1, BLOCO.lastIndexOf("}"));
    const declaracoes = corpo
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean);
    expect(declaracoes.length).toBeGreaterThan(0);
    for (const d of declaracoes) expect(d).toMatch(/^--j-[a-z0-9-]+:/);
    expect(BLOCO).toMatch(/^[\s\S]*?\n:root \{/);
  });

  it("nenhum token --j-* é definido nem mexido antes do bloco", () => {
    expect(ANTES).not.toMatch(/--j-/);
  });

  it("cada token --j-* aponta pra um token de tema que já existe", () => {
    const usados = [...BLOCO.matchAll(/var\((--[a-z0-9-]+)\)/g)].map(
      (m) => m[1]
    );
    expect(usados.length).toBeGreaterThan(0);
    for (const t of usados) {
      expect(ANTES, t).toMatch(new RegExp(`\\n\\s*${t}:`));
    }
  });

  it("todo --j-* usado no card e na tela está definido", () => {
    const definidos = new Set(
      [...BLOCO.matchAll(/(--j-[a-z0-9-]+):/g)].map((m) => m[1])
    );
    for (const arquivo of TODOS) {
      for (const m of read(arquivo).matchAll(/var\((--j-[a-z0-9-]+)\)/g)) {
        expect(definidos.has(m[1]), `${arquivo}: ${m[1]}`).toBe(true);
      }
    }
  });
});
