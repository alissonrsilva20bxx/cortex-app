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

describe("#197 — 'Selo conquistado' e '+N Glow': o valor do protótipo, contraste listado", () => {
  // Pixel do protótipo (decisão do operador): o cartão do selo usa as cores
  // dele -- a chamada em --t-deep sobre o cartão (--t-card) e os raios (o
  // acento a 20%), a pílula em --t-deep sobre --t-soft. Onde isso fica
  // abaixo de 4,5:1, vale o protótipo e o caso fica LISTADO aqui (e na PR).
  const css = read("components/jornada/jornada.module.css");
  const regra = (sel: string) => {
    const i = css.indexOf(`\n${sel} {`);
    return i === -1 ? "" : css.slice(i, css.indexOf("}", i));
  };

  it("a chamada e a pílula usam as cores do protótipo", () => {
    expect(regra(".b-eye")).toMatch(/color:\s*var\(--t-deep\)/);
    expect(regra(".b-pts")).toMatch(/color:\s*var\(--t-deep\)/);
    expect(regra(".b-pts")).toMatch(/background:\s*var\(--t-soft\)/);
    expect(regra(".rays")).toMatch(
      /color-mix\(in srgb,\s*var\(--t-acc\) 20%,\s*transparent\)/
    );
  });

  // A tela da Jornada sobrepõe --t-soft no emerald claro (jornada.module.css).
  const SOBREPOSTO: Record<string, string> = {
    "emerald/claro/--t-soft": "#dff1ec",
  };
  const t = (nome: string, tema: string, modo: Modo) =>
    hex(SOBREPOSTO[`${tema}/${modo}/${nome}`] ?? token(nome, tema, modo));

  /** Os casos abaixo de 4,5:1 com as cores do protótipo, travados. */
  const ABAIXO_DE_4_5: string[] = [
    "pink-neon/claro sobre raio: 3.89",
    "pink-neon/claro sobre pilula: 4.25",
    "ocean/claro sobre raio: 4.03",
    "ocean/claro sobre pilula: 4.38",
    "gold/claro sobre raio: 4.12",
    "gold/claro sobre pilula: 4.46",
    "emerald/claro sobre raio: 4.31",
    "crimson/escuro sobre raio: 3.80",
    "crimson/escuro sobre pilula: 3.80",
  ];

  it("os casos abaixo de 4,5:1 são exatamente os listados", () => {
    const abaixo: string[] = [];
    for (const tema of TEMAS)
      for (const modo of ["claro", "escuro"] as const) {
        const deep = t("--t-deep", tema, modo);
        const card = t("--t-card", tema, modo);
        const acc = t("--t-acc", tema, modo);
        const soft = t("--t-soft", tema, modo);
        const raio = mistura(card, acc, 0.2);
        const fundos = {
          cartao: card,
          raio,
          pilula: soft,
        } as const;
        for (const [onde, fundo] of Object.entries(fundos)) {
          const c = contraste(deep, fundo);
          if (c < 4.5)
            abaixo.push(`${tema}/${modo} sobre ${onde}: ${c.toFixed(2)}`);
        }
      }
    expect(abaixo).toEqual(ABAIXO_DE_4_5);
  });
});

// ---------------------------------------------------------------------------
// #198 — área de toque >= 44px, desenho igual
// ---------------------------------------------------------------------------

describe("#198 — 'Voltar' e as chaves com área de toque >= 44px", () => {
  const tela = read("components/jornada/JornadaScreen.tsx");
  const ajustes = read("components/jornada/JornadaAjustes.tsx");

  const css = read("components/jornada/jornada.module.css");
  const regra = (sel: string) => {
    const i = css.indexOf(`\n${sel} {`);
    return i === -1 ? "" : css.slice(i, css.indexOf("}", i));
  };

  it("Voltar (e os outros botões do topo): o botão tem 44×44 e o círculo que se vê continua 40×40", () => {
    // Pixel do protótipo: o círculo `.rb` de 40px dentro do `.toque` de 44px,
    // com margem negativa (nada sai do lugar).
    const botao = tela.slice(
      tela.indexOf("ref={voltarRef}"),
      tela.indexOf("</button>", tela.indexOf("ref={voltarRef}"))
    );
    expect(botao).toContain("className={s.toque}");
    expect(botao).toContain("<span className={s.rb}>");
    expect(regra(".toque")).toMatch(
      /width: 44px;\s*height: 44px;\s*margin: -2px;/
    );
    expect(regra(".rb")).toMatch(/width: 40px;\s*height: 40px;/);
    expect(tela.match(/className=\{s\.toque\}/g)).toHaveLength(3);
  });

  it("chaves: a linha inteira é o alvo (>= 44px de altura) e a chave é a do protótipo (46×28)", () => {
    expect(ajustes).toMatch(/<label className=\{s\.sr\}>/);
    expect(ajustes).toMatch(
      /type="checkbox"\s+role="switch"\s+className=\{s\.sw\}/
    );
    // 12px em cima e embaixo + a chave de 28px = 52px de alvo.
    expect(regra(".sr")).toMatch(/padding: 12px 0;/);
    expect(regra(".sw")).toMatch(/width: 46px;\s*height: 28px;/);
  });

  it("Fazer (Jornada de Começo) e Completa/Calma: 44px por uma área invisível, sem mexer no desenho", () => {
    // As pílulas do protótipo têm ~27px; a área passa 9px em cima e embaixo.
    expect(regra(".st .go::after,\n.psel button::after")).toMatch(
      /content: "";\s*position: absolute;\s*inset: -9px 0;/
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

  it("o mês contém a semana (quando ela começa no mês) e o ano contém o mês", () => {
    // 15/10/2026: a semana começa em 12/10, dentro de outubro.
    expect(semana.inicio >= mes.inicio).toBe(true);
    for (const [k, v] of Object.entries(semana.contadores))
      expect(mes.contadores[k] ?? 0, `mês ${k}`).toBeGreaterThanOrEqual(v);
    for (const [k, v] of Object.entries(mes.contadores))
      expect(ano.contadores[k] ?? 0, `ano ${k}`).toBeGreaterThanOrEqual(v);
  });

  it("o Glow do ano é o total dela, e o mês bate com o capítulo de outubro", () => {
    expect(ano.contadores.glow).toBe(e.glowTotal);
    // Outubro (spec §6, trinca 1 do protótipo): planejar 8 dias, guardar
    // dinheiro em 3 semanas, 2 descansos.
    const doContador: Record<string, string> = {
      planejar_dias: "planejar",
      guardar_semanas: "semanas_guardou",
      tirar_descansos: "descanso",
    };
    for (const m of e.capitulo!.missoes)
      expect(mes.contadores[doContador[m.tipo]] ?? 0, m.tipo).toBe(m.progresso);
  });

  it("na sexta 02/10 do protótipo, a semana começou em setembro e pode ter mais que o mês", () => {
    const sexta = estadoJornadaExemplo(new Date(2026, 9, 2));
    const p = sexta.periodos.corrente;
    expect(p.semana.inicio).toBe("2026-09-28");
    expect(p.semana.contadores.glow).toBe(85);
    expect(p.mes.contadores.glow).toBe(40);
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
