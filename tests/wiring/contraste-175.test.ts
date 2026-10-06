import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * #175 — texto colorido pequeno abaixo de 4,5:1 (WCAG AA). A correção mexe
 * só no TEXTO (e, no midnight, 2% no fundo sólido do acento), nunca na
 * paleta dos temas. Este teste faz duas coisas:
 *  1. calcula o contraste a partir do styles/globals.css, nos 8 temas, claro
 *     e escuro, pros casos da issue -- se alguém mexer num token e algum caso
 *     cair abaixo de 4,5, falha aqui;
 *  2. confere que cada componente da issue usa os tokens novos.
 * A medição nos pixels (antes/depois) está em docs/jornada/prints/175/.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const css = read("styles/globals.css");

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
type Modo = "light" | "dark";
type Cor = [number, number, number, number];

// ---------------------------------------------------------------- tokens
function blocos(src: string) {
  const sem = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Array<{ seletores: string[]; decl: Map<string, string> }> = [];
  let prof = 0;
  let inicio = 0;
  for (let i = 0; i < sem.length; i++) {
    if (sem[i] === "{") {
      if (prof === 0) {
        const sel = sem.slice(inicio, i).split(";").pop()!.trim();
        const corpo = sem.slice(i + 1, sem.indexOf("}", i));
        if (!sel.startsWith("@") && !corpo.includes("{")) {
          const decl = new Map<string, string>();
          for (const m of corpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
            decl.set(m[1], m[2].replace(/\s+/g, " ").trim());
          out.push({ seletores: sel.split(",").map((s) => s.trim()), decl });
        }
      }
      prof++;
    } else if (sem[i] === "}") {
      prof--;
      if (prof === 0) inicio = i + 1;
    }
  }
  return out;
}
const BLOCOS = blocos(css);

/** Valor cru do token no tema/modo, pela cascata do navegador. */
function cru(token: string, tema: string, modo: Modo): string | undefined {
  const espec = (sel: string) => {
    if (sel === ":root" || sel === `[data-theme="${tema}"]`) return 1;
    if (modo === "light" && sel === `[data-mode="light"]`) return 1;
    if (modo === "light" && sel === `[data-mode="light"][data-theme="${tema}"]`)
      return 2;
    return -1;
  };
  let melhor: { e: number; v: string } | undefined;
  for (const b of BLOCOS) {
    const v = b.decl.get(token);
    if (v === undefined) continue;
    const e = Math.max(...b.seletores.map(espec));
    if (e < 0) continue;
    if (!melhor || e >= melhor.e) melhor = { e, v };
  }
  return melhor?.v;
}

function valor(token: string, tema: string, modo: Modo): string {
  let v = cru(token, tema, modo);
  if (v === undefined) throw new Error(`${token} sem valor em ${tema}/${modo}`);
  for (let n = 0; n < 10 && /var\(/.test(v); n++)
    v = v.replace(/var\((--[\w-]+)\)/, (_, t) => cru(t, tema, modo) ?? "");
  return v;
}

function cor(c: string): Cor {
  c = c.trim();
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) h = [...h].map((x) => x + x).join("");
    return [0, 2, 4]
      .map((i) => parseInt(h.slice(i, i + 2), 16))
      .concat(1) as Cor;
  }
  let m = c.match(
    /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)\s*(?:[,/]\s*([\d.]+))?\s*\)$/
  );
  if (m) return [+m[1], +m[2], +m[3], m[4] ? +m[4] : 1];
  m = c.match(/^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%,\s*(.+)\)$/);
  if (m) {
    const a = cor(m[1]);
    const b = cor(m[3]);
    const p = +m[2] / 100;
    return [0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p)).concat(1) as Cor;
  }
  // Tripla "r g b" (os tokens --*-rgb).
  m = c.match(/^([\d.]+) ([\d.]+) ([\d.]+)$/);
  if (m) return [+m[1], +m[2], +m[3], 1];
  throw new Error(`cor não reconhecida: ${c}`);
}

const sobre = (f: Cor, b: Cor): Cor =>
  [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1) as Cor;
const mistura = (a: Cor, b: Cor, p: number): Cor =>
  [0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p)).concat(1) as Cor;
function lum([r, g, b]: Cor) {
  const c = (x: number) => {
    x /= 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
function contraste(a: Cor, b: Cor) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const T = (token: string, tema: string, modo: Modo) =>
  cor(valor(token, tema, modo));
const comAlfa = (token: string, tema: string, modo: Modo, a: number): Cor => {
  const [r, g, b] = cor(valor(token, tema, modo));
  return [r, g, b, a];
};
/** Fundo do card de vidro do post (.glass-card) sobre o --bg. */
const vidro = (tema: string, modo: Modo) =>
  sobre(
    modo === "light" ? [255, 255, 255, 0.72] : [255, 255, 255, 0.04],
    T("--bg", tema, modo)
  );

// Proporção da cor da categoria no selo do post (PostCard.tsx).
const SELO_PCT = 0.62;
const CATEGORIAS: Record<string, string> = {
  geral: "148 163 184",
  dica: "var(--info-rgb)",
  conquista: "var(--success-rgb)",
  duvida: "var(--warning-rgb)",
  desabafo: "167 139 250",
};

/** Os casos da issue: [texto, fundo]. */
function casos(tema: string, modo: Modo): Record<string, [Cor, Cor]> {
  const r: Record<string, [Cor, Cor]> = {
    "Novo / segmento ativo / em N dias": [
      T("--on-accent", tema, modo),
      T("--accent-fill", tema, modo),
    ],
    "chip ativo": [
      T("--accent-deep-2", tema, modo),
      sobre(comAlfa("--accent-rgb", tema, modo, 0.18), T("--bg", tema, modo)),
    ],
    "variação negativa": [
      T("--danger-text", tema, modo),
      T("--danger-tint", tema, modo),
    ],
    "variação positiva": [
      T("--success-text", tema, modo),
      T("--success-tint", tema, modo),
    ],
    "X% da meta": [
      T("--accent-deep-2", tema, modo),
      T("--accent-tint", tema, modo),
    ],
    "valor negativo": [
      T("--danger-text", tema, modo),
      T("--card-solid", tema, modo),
    ],
    "valor positivo": [
      T("--success-text", tema, modo),
      T("--card-solid", tema, modo),
    ],
  };
  for (const [nome, rgb] of Object.entries(CATEGORIAS)) {
    const base = rgb.startsWith("var(")
      ? T(rgb.slice(4, -1), tema, modo)
      : cor(rgb);
    r[`selo ${nome}`] = [
      mistura(base, T("--text", tema, modo), SELO_PCT),
      sobre([base[0], base[1], base[2], 0.12], vidro(tema, modo)),
    ];
  }
  return r;
}

describe("#175 — todo caso da issue passa 4,5:1 nos 8 temas, claro e escuro", () => {
  for (const tema of TEMAS) {
    for (const modo of ["light", "dark"] as const) {
      it(`${tema} · ${modo === "light" ? "claro" : "escuro"}`, () => {
        for (const [nome, [texto, fundo]] of Object.entries(
          casos(tema, modo)
        )) {
          expect(contraste(texto, fundo), nome).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }
});

describe("#175 — a paleta dos temas não mudou", () => {
  it("--accent continua o de cada tema; o midnight só ganha 2% de preto no fundo sólido", () => {
    const fills = TEMAS.flatMap((t) =>
      (["light", "dark"] as const).map((m) => ({
        t,
        m,
        fill: valor("--accent-fill", t, m),
        acc: valor("--accent", t, m),
      }))
    );
    for (const f of fills) {
      if (f.t === "midnight")
        expect(f.fill).toBe(`color-mix(in srgb, ${f.acc} 98%, #000)`);
      else expect(f.fill, `${f.t}/${f.m}`).toBe(f.acc);
    }
  });

  it("verde e vermelho de texto são misturas de --success/--danger com --text (mesmo matiz)", () => {
    expect(css).toContain(
      "--success-text: color-mix(in srgb, var(--success) 72%, var(--text));"
    );
    expect(css).toContain(
      "--danger-text: color-mix(in srgb, var(--danger) 78%, var(--text));"
    );
  });
});

describe("#175 — os componentes da issue usam os tokens novos", () => {
  const casosFonte: Array<[string, RegExp[]]> = [
    [
      "components/home/GreetingHeader.tsx",
      [/background: "var\(--accent-fill\)",\s*color: "var\(--on-accent\)",/],
    ],
    [
      "components/financeiro/FinanceiroTab.tsx",
      [/background: "var\(--accent-fill\)",\s*color: "var\(--on-accent\)",/],
    ],
    [
      "components/ui/SegmentedControl.tsx",
      [
        /background: active \? "var\(--accent-fill\)" : "transparent",/,
        /color: active \? "var\(--on-accent\)" : "var\(--text-muted\)",/,
      ],
    ],
    [
      "components/jobs/AgendaProximoCard.tsx",
      [/background: "var\(--accent-fill\)",\s*color: "var\(--on-accent\)",/],
    ],
    [
      "components/ui/FilterChips.tsx",
      [/color: active \? "var\(--accent-deep-2\)" : "var\(--text-muted\)",/],
    ],
    [
      // Chip de status da Agenda: cópia local do FilterChips (ver o
      // comentário no JobsTab), mesmo ajuste.
      "components/jobs/JobsTab.tsx",
      [
        /color: active\s*\?\s*"var\(--accent-deep-2\)"\s*:\s*"var\(--text-muted\)",/,
      ],
    ],
    [
      "components/rede/PostCard.tsx",
      [
        /color: `color-mix\(in srgb, rgb\(\$\{cat\.rgb\}\) 62%, var\(--text\)\)`,/,
      ],
    ],
    ["components/home/HeroCard.tsx", [/color: "var\(--accent-deep-2\)",/]],
    [
      "components/financeiro/FinanceiroHeroCard.tsx",
      [
        /variacaoPct >= 0\s*\?\s*"var\(--success-text\)"\s*:\s*"var\(--danger-text\)"/,
      ],
    ],
    [
      "components/financeiro/VisaoTab.tsx",
      [
        /color: m\.positive \? "var\(--success-text\)" : "var\(--danger-text\)",/,
      ],
    ],
  ];

  for (const [arquivo, padroes] of casosFonte) {
    it(arquivo, () => {
      const src = read(arquivo);
      for (const p of padroes) expect(src).toMatch(p);
    });
  }

  it("o selo do post usa a mesma proporção que o cálculo acima", () => {
    expect(read("components/rede/PostCard.tsx")).toContain(
      `${SELO_PCT * 100}%, var(--text))`
    );
  });

  it("nenhum dos botões Novo voltou a branco fixo sobre o acento", () => {
    for (const arquivo of [
      "components/home/GreetingHeader.tsx",
      "components/financeiro/FinanceiroTab.tsx",
    ]) {
      expect(read(arquivo), arquivo).not.toMatch(
        /background: "var\(--accent\)",\s*color: "#fff"/
      );
    }
  });
});
