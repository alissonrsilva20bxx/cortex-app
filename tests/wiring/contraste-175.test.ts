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
      // Pixel do mockup (decisão do operador): o "+ Novo" do Início e do
      // Financeiro volta ao valor do mockup (branco sobre --t-acc), num
      // componente só (components/ui/cabecalho.tsx). Os temas que ficam
      // abaixo de 4,5:1 estão listados no PR, pra decisão.
      "components/ui/cabecalho.tsx",
      [/background: "var\(--accent\)",\s*color: "#fff",/],
    ],
    [
      "components/ui/SegmentedControl.tsx",
      [
        /background: active \? "var\(--accent-fill\)" : "transparent",/,
        /color: active \? "var\(--on-accent\)" : "var\(--text-muted\)",/,
      ],
    ],
    [
      // Pixel do mockup (decisão do operador): a pílula "em 2 dias" volta
      // ao valor do mockup (--t-ink sobre --t-acc), mesmo onde fica abaixo
      // de 4,5:1. Os temas que reprovam estão listados no PR, pra decisão.
      "components/jobs/AgendaProximoCard.tsx",
      [/background: "var\(--accent\)",\s*color: "var\(--text\)",/],
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
});

// ---------------------------------------------------------------- pixel
/**
 * Perfeição de pixel com o mockup normativo (Financeiro A e Início A): por
 * decisão do operador o MOCKUP vence, inclusive nas cores que o #175 tinha
 * escurecido. Onde o valor do mockup fica abaixo de 4,5:1, ele é mantido e
 * listado aqui (e no PR) pra decisão do operador. Esta lista é travada: um
 * caso novo abaixo de 4,5 (ou um que saiu) faz o teste falhar.
 */
const base = (token: string, tema: string, modo: Modo): Cor[] => {
  const v = valor(token, tema, modo);
  if (!/gradient/.test(v)) return [cor(v)];
  // Fundo em degradê: confere contra cada cor de parada (a pior vale).
  return [...v.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => cor(m[0]));
};
const pior = (texto: Cor, fundos: Cor[], sobreFundo: Cor) =>
  Math.min(
    ...fundos.map((f) =>
      contraste(sobre(texto, sobre(f, sobreFundo)), sobre(f, sobreFundo))
    )
  );

/** [nome, token do texto, token do fundo, fundo por baixo do fundo]. */
const PARES_MOCKUP: Array<[string, string, string]> = [
  ["Novo (#fff sobre --t-acc)", "#ffffff", "--t-acc"],
  ["variação negativa", "--t-red", "--t-rsoft"],
  ["variação positiva", "--t-green", "--t-gsoft"],
  ["X% da meta", "--t-deep", "--t-soft"],
  ["valor negativo", "--t-red", "--t-card"],
  ["valor positivo", "--t-green", "--t-card"],
  ["valor da semana (--t-deep)", "--t-deep", "--t-card"],
  ["texto secundário no card", "--t-mut", "--t-card"],
  ["texto secundário na página", "--t-mut", "--t-phbg"],
  ["link (Extrato/Agenda)", "--t-deep", "--t-phbg"],
  ["Cofre (rótulo no herói)", "--t-hero-mut", "--t-hero"],
];

function casosMockup(tema: string, modo: Modo): Record<string, number> {
  const out: Record<string, number> = {};
  const branco: Cor = [255, 255, 255, 1];
  for (const [nome, texto, fundo] of PARES_MOCKUP) {
    const t = texto.startsWith("#")
      ? cor(texto)
      : cor(valor(texto, tema, modo));
    out[nome] = pior(t, base(fundo, tema, modo), branco);
  }
  return out;
}

const ABAIXO_DE_4_5: string[] = [
  "grafite · light · variação negativa · 3.73",
  "grafite · light · variação positiva · 3.91",
  "grafite · light · valor negativo · 4.37",
  "grafite · light · valor positivo · 4.40",
  "grafite · dark · Novo (#fff sobre --t-acc) · 2.56",
  "grafite · dark · variação negativa · 4.29",
  "pink-neon · light · Novo (#fff sobre --t-acc) · 3.56",
  "pink-neon · light · variação negativa · 3.73",
  "pink-neon · light · variação positiva · 3.91",
  "pink-neon · light · X% da meta · 4.25",
  "pink-neon · light · valor negativo · 4.37",
  "pink-neon · light · valor positivo · 4.40",
  "pink-neon · dark · Novo (#fff sobre --t-acc) · 3.56",
  "purple · light · Novo (#fff sobre --t-acc) · 4.00",
  "purple · light · variação negativa · 3.73",
  "purple · light · variação positiva · 3.91",
  "purple · light · valor negativo · 4.37",
  "purple · light · valor positivo · 4.40",
  "purple · dark · Novo (#fff sobre --t-acc) · 4.00",
  "crimson · light · variação negativa · 3.73",
  "crimson · light · variação positiva · 3.91",
  "crimson · light · valor negativo · 4.37",
  "crimson · light · valor positivo · 4.40",
  "crimson · dark · X% da meta · 3.80",
  "ocean · light · Novo (#fff sobre --t-acc) · 3.44",
  "ocean · light · variação negativa · 3.73",
  "ocean · light · variação positiva · 3.91",
  "ocean · light · X% da meta · 4.38",
  "ocean · light · valor negativo · 4.37",
  "ocean · light · valor positivo · 4.40",
  "ocean · dark · Novo (#fff sobre --t-acc) · 1.95",
  "ocean · dark · variação negativa · 3.86",
  "ocean · dark · Cofre (rótulo no herói) · 4.23",
  "gold · light · Novo (#fff sobre --t-acc) · 3.51",
  "gold · light · variação negativa · 3.73",
  "gold · light · variação positiva · 3.91",
  "gold · light · X% da meta · 4.46",
  "gold · light · valor negativo · 4.37",
  "gold · light · valor positivo · 4.40",
  "gold · dark · Novo (#fff sobre --t-acc) · 2.15",
  "gold · dark · variação negativa · 4.22",
  "emerald · light · Novo (#fff sobre --t-acc) · 3.77",
  "emerald · light · variação negativa · 3.73",
  "emerald · light · variação positiva · 3.91",
  "emerald · light · valor negativo · 4.37",
  "emerald · light · valor positivo · 4.40",
  "emerald · dark · Novo (#fff sobre --t-acc) · 2.54",
  "emerald · dark · variação negativa · 3.94",
  "midnight · light · Novo (#fff sobre --t-acc) · 4.47",
  "midnight · light · variação negativa · 3.73",
  "midnight · light · variação positiva · 3.91",
  "midnight · light · valor negativo · 4.37",
  "midnight · light · valor positivo · 4.40",
  "midnight · dark · Novo (#fff sobre --t-acc) · 4.47",
];

describe("Pixel (mockup vence) — contraste dos valores do mockup, listado", () => {
  it("os casos abaixo de 4,5:1 são exatamente os listados no PR", () => {
    const abaixo: string[] = [];
    for (const tema of TEMAS)
      for (const modo of ["light", "dark"] as const)
        for (const [nome, c] of Object.entries(casosMockup(tema, modo)))
          if (c < 4.5)
            abaixo.push(`${tema} · ${modo} · ${nome} · ${c.toFixed(2)}`);
    if (process.env.MOSTRAR_CONTRASTE)
      console.log(JSON.stringify(abaixo, null, 1));
    expect(abaixo).toEqual(ABAIXO_DE_4_5);
  });

  it("Financeiro e Início usam os valores do mockup (não os tokens do #175)", () => {
    for (const arquivo of [
      "components/home/GreetingHeader.tsx",
      "components/financeiro/FinanceiroTab.tsx",
    ])
      expect(read(arquivo), arquivo).toMatch(
        /background: "var\(--t-acc\)",\s*color: "#f{3,6}",/
      );
    expect(read("components/home/HeroCard.tsx")).toMatch(
      /background: "var\(--t-soft\)",\s*color: "var\(--t-deep\)",/
    );
    expect(read("components/financeiro/FinanceiroHeroCard.tsx")).toMatch(
      /color: sobe \? "var\(--t-green\)" : "var\(--t-red\)",/
    );
    expect(read("components/financeiro/VisaoTab.tsx")).toMatch(
      /color: m\.positive \? "var\(--t-green\)" : "var\(--t-red\)",/
    );
  });
});
