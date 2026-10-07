import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  estadoJornadaContaNova,
  estadoJornadaExemplo,
} from "../../lib/mockJornada";

/**
 * Correções dos achados da J16 (#166):
 *  - #197 contraste de "Selo novo" e "+N Glow" no cartão do selo, >= 4,5:1
 *    nos 8 temas, claro e escuro;
 *  - #198 "Voltar" e as chaves dos ajustes da tela da Jornada com área de
 *    toque >= 44px, sem mudar o desenho;
 *  - #200 dados de laboratório: o mês e o ano com números próprios.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");

// ---------------------------------------------------------------------------
// #197 — contraste calculado dos tokens, tema a tema
// ---------------------------------------------------------------------------

const TEMAS = [
  "pink-neon",
  "purple",
  "ocean",
  "midnight",
  "grafite",
  "gold",
  "emerald",
  "crimson",
] as const;
type Modo = "claro" | "escuro";

interface Regra {
  seletores: string[];
  decls: Map<string, string>;
  ordem: number;
}

/** As regras de primeiro nível do globals.css (sem os blocos @media). */
function regras(css: string): Regra[] {
  const semComentario = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // @tailwind/@import sem bloco: senão grudam no seletor da 1ª regra.
    .replace(/@[a-z-]+[^;{}]*;/g, "");
  const out: Regra[] = [];
  let ordem = 0;
  for (const m of semComentario.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    if (sel.startsWith("@") || sel.includes("@")) continue;
    const decls = new Map<string, string>();
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":");
      if (i > 0) decls.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
    }
    out.push({
      seletores: sel.split(",").map((s) => s.trim()),
      decls,
      ordem: ordem++,
    });
  }
  return out;
}

/** Especificidade de um seletor que vale pra <html> neste tema/modo, ou null. */
function casa(sel: string, tema: string, modo: Modo): number | null {
  if (sel === ":root") return 1;
  const partes = [...sel.matchAll(/\[data-(theme|mode)="([^"]+)"\]/g)];
  if (!partes.length || partes.map((p) => p[0]).join("") !== sel) return null;
  for (const [, tipo, valor] of partes) {
    if (tipo === "theme" && valor !== tema) return null;
    if (tipo === "mode" && !(valor === "light" && modo === "claro"))
      return null;
  }
  return partes.length;
}

const REGRAS = regras(read("styles/globals.css"));

/** O valor de uma variável em <html data-theme data-mode>, pela cascata. */
function token(nome: string, tema: string, modo: Modo): string {
  let melhor: { spec: number; ordem: number; valor: string } | null = null;
  for (const r of REGRAS) {
    const valor = r.decls.get(nome);
    if (valor === undefined) continue;
    for (const s of r.seletores) {
      const spec = casa(s, tema, modo);
      if (spec === null) continue;
      if (
        !melhor ||
        spec > melhor.spec ||
        (spec === melhor.spec && r.ordem > melhor.ordem)
      )
        melhor = { spec, ordem: r.ordem, valor };
    }
  }
  if (!melhor) throw new Error(`${nome} sem valor em ${tema}/${modo}`);
  return melhor.valor;
}

function hex(v: string): [number, number, number] {
  const m = v.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`esperava cor #rrggbb, veio ${v}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mistura = (a: number[], b: number[], pesoB: number) =>
  a.map((x, i) => x * (1 - pesoB) + b[i] * pesoB);

function luminancia(c: number[]): number {
  const [r, g, b] = c.map((x) => {
    const v = x / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: number[], b: number[]): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("#197 — 'Selo novo' e '+N Glow' com contraste >= 4,5:1", () => {
  const css = read("components/jornada/celebracao/Comemoracao.module.css");
  const bloco = (nome: string) =>
    css.match(new RegExp(`\\n\\.${nome} \\{([^}]*)\\}`))?.[1] ?? "";

  it("os dois textos usam a cor de TEXTO de acento, não o --accent puro", () => {
    expect(css).toMatch(/--c-acc-texto: var\(--accent-deep-2\);/);
    expect(bloco("chamada")).toMatch(/\n\s*color: var\(--c-acc-texto\);/);
    expect(bloco("glow")).toMatch(/\n\s*color: var\(--c-acc-texto\);/);
  });

  // O cartão é --card-solid; os raios atrás do texto são o acento a 20%
  // (conic-gradient do .raios) e a pílula do Glow é o acento a 16% (--c-soft),
  // que pode cair em cima de um raio. Vale o PIOR desses fundos.
  const casos = TEMAS.flatMap((t) =>
    (["claro", "escuro"] as const).map((m) => [t, m] as const)
  );

  it("o cartão ainda desenha raios e pílula com essas proporções", () => {
    expect(css).toMatch(
      /color-mix\(in srgb, var\(--c-acc\) 20%, transparent\)/
    );
    expect(css).toMatch(
      /--c-soft: color-mix\(in srgb, var\(--accent\) 16%, transparent\);/
    );
  });

  it.each(casos)("%s, %s", (tema, modo) => {
    const texto = hex(token("--accent-deep-2", tema, modo));
    const acento = hex(token("--accent", tema, modo));
    const cartao = hex(token("--card-solid", tema, modo));
    const raio = mistura(cartao, acento, 0.2);
    const fundos = {
      cartao,
      raio,
      pilula: mistura(cartao, acento, 0.16),
      pilulaSobreRaio: mistura(raio, acento, 0.16),
    };
    for (const [onde, fundo] of Object.entries(fundos)) {
      expect(
        contraste(texto, fundo),
        `${tema}/${modo} sobre ${onde}`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// ---------------------------------------------------------------------------
// #198 — área de toque >= 44px, desenho igual
// ---------------------------------------------------------------------------

describe("#198 — 'Voltar' e as chaves com área de toque >= 44px", () => {
  const tela = read("components/jornada/JornadaScreen.tsx");
  const ajustes = read("components/jornada/JornadaAjustes.tsx");

  it("Voltar: o botão tem 44×44 e o círculo que se vê continua 40×40", () => {
    const botao = tela.slice(
      tela.indexOf("ref={voltarRef}"),
      tela.indexOf("</button>", tela.indexOf("ref={voltarRef}"))
    );
    expect(botao).toMatch(
      /style=\{\{ width: "44px", height: "44px", margin: "-2px" \}\}/
    );
    expect(botao).toMatch(
      /width: "40px",\s*height: "40px",\s*background: "var\(--j-card\)"/
    );
  });

  it("chaves: o botão (role=switch) tem 44 de altura e o trilho continua 48×28", () => {
    const chave = ajustes.slice(ajustes.indexOf("function Chavinha"));
    const botao = chave.slice(chave.indexOf("<button"), chave.indexOf("<span"));
    expect(botao).toMatch(/role="switch"/);
    expect(botao).toMatch(
      /style=\{\{ width: "48px", height: "44px", margin: "-8px 0" \}\}/
    );
    const trilho = chave.slice(chave.indexOf("<span"));
    expect(trilho).toMatch(
      /width: "48px",\s*height: "28px",\s*borderRadius: "var\(--radius-pill\)"/
    );
  });
});

// ---------------------------------------------------------------------------
// #200 — laboratório: cada período com os próprios números
// ---------------------------------------------------------------------------

describe("#200 — no laboratório, semana, mês e ano têm números próprios", () => {
  const e = estadoJornadaExemplo(new Date(2026, 9, 15));
  const { semana, mes, ano } = e.periodos.corrente;

  it("os três períodos não repetem os mesmos contadores", () => {
    expect(mes.contadores).not.toEqual(semana.contadores);
    expect(ano.contadores).not.toEqual(mes.contadores);
  });

  it("o mês contém a semana e o ano contém o mês (nenhum contador diminui)", () => {
    for (const [k, v] of Object.entries(semana.contadores))
      expect(mes.contadores[k] ?? 0, `mês ${k}`).toBeGreaterThanOrEqual(v);
    for (const [k, v] of Object.entries(mes.contadores))
      expect(ano.contadores[k] ?? 0, `ano ${k}`).toBeGreaterThanOrEqual(v);
  });

  it("o Glow do ano é o total dela, e o mês bate com o capítulo de outubro", () => {
    expect(ano.contadores.glow).toBe(e.glowTotal);
    // Outubro (spec §6): tirar descansos, lançar despesas, comprovantes.
    const progresso = Object.fromEntries(
      e.capitulo!.missoes.map((m) => [m.tipo, m.progresso])
    );
    expect(mes.contadores.descanso).toBe(progresso.tirar_descansos);
    expect(mes.contadores.despesa).toBe(progresso.lancar_despesas);
    expect(mes.contadores.comprovante_cofre).toBe(progresso.comprovantes_cofre);
  });

  it("a semana fechada com 3 dias fortes foi firme", () => {
    const fechada = e.periodos.ultimoFechado.semana!;
    expect(fechada.contadores.dias_fortes).toBeGreaterThanOrEqual(3);
    expect(fechada.contadores.firme).toBe(1);
  });

  it("conta nova continua com os três períodos vazios", () => {
    const n = estadoJornadaContaNova(new Date(2026, 9, 15));
    for (const t of ["semana", "mes", "ano"] as const)
      expect(n.periodos.corrente[t].contadores).toEqual({});
  });
});
