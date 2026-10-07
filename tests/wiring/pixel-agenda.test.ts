import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMockAppSeed } from "../../lib/mockAppData";

/**
 * Pixel do mockup na Agenda e na casca (barra pílula, "+", fonte, tokens).
 *
 * Referência normativa: docs/jornada/referencias/5-telas-8-temas-claro-escuro.html
 * (o celular `data-t="agenda"`, layout C). Este teste LÊ o mockup: os
 * tokens, os ícones e os dados do laboratório são conferidos contra ele,
 * não contra valores copiados aqui. A medição de pixel (diff < 0,5%) está
 * no PR e em docs/jornada/prints/pixel/agenda/.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");

const MOCKUP = read(
  "docs/jornada/referencias/5-telas-8-temas-claro-escuro.html"
);
const CSS = read("styles/globals.css");
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

// ---------------------------------------------------------------------------
// Tokens: o app resolve pros `--t-*` do mockup
// ---------------------------------------------------------------------------

/** Os `--t-*` do mockup, por tema e modo. */
function tokensDoMockup(tema: string, modo: Modo): Record<string, string> {
  const m = MOCKUP.match(
    new RegExp(
      `\\.ph\\[data-tm="${tema}"\\]\\[data-md="${modo}"\\]\\s*\\{([^}]*)\\}`
    )
  );
  expect(m, `${tema}/${modo} no mockup`).not.toBeNull();
  const out: Record<string, string> = {};
  for (const d of m![1].split(";")) {
    const i = d.indexOf(":");
    if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
  }
  return out;
}

interface Regra {
  seletores: string[];
  decls: Map<string, string>;
  ordem: number;
}

function regras(css: string): Regra[] {
  const limpo = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@[a-z-]+[^;{}]*;/g, "");
  const out: Regra[] = [];
  let ordem = 0;
  for (const m of limpo.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    if (sel.includes("@")) continue;
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

/** Especificidade de um seletor que vale pro <html> neste tema/modo, ou null. */
function casa(sel: string, tema: string, modo: Modo): number | null {
  if (sel === ":root") return 1;
  let spec = 0;
  let resto = sel;
  if (resto.startsWith(":root")) {
    spec++;
    resto = resto.slice(5);
  }
  const partes = [...resto.matchAll(/\[data-(theme|mode)="([^"]+)"\]/g)];
  if (partes.map((p) => p[0]).join("") !== resto || !partes.length) return null;
  for (const [, tipo, valor] of partes) {
    if (tipo === "theme" && valor !== tema) return null;
    if (tipo === "mode" && !(valor === "light" && modo === "light"))
      return null;
  }
  return spec + partes.length;
}

const REGRAS = regras(CSS);

function token(nome: string, tema: string, modo: Modo): string | undefined {
  let melhor: { spec: number; ordem: number; valor: string } | undefined;
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
  return melhor?.valor;
}

const norm = (v: string) => v.replace(/\s+/g, "").toLowerCase();

/** Token do app -> token do mockup que ele tem que reproduzir. */
const MAPA: [string, string][] = [
  ["--text", "--t-ink"],
  ["--text-muted", "--t-mut"],
  ["--divider", "--t-line"],
  ["--accent", "--t-acc"],
  ["--accent-deep", "--t-deep"],
  ["--accent-deep-2", "--t-deep2"],
  ["--accent-tint", "--t-soft"],
  ["--card-solid", "--t-card"],
  ["--hero-bg", "--t-hero"],
  ["--hero-text-muted", "--t-hero-mut"],
  ["--success", "--t-green"],
  ["--success-tint", "--t-gsoft"],
  ["--danger", "--t-red"],
  ["--info", "--t-blue"],
  ["--body-bg", "--t-phbg"],
  ["--glass", "--t-glass"],
  ["--glass-border", "--t-glass-bd"],
  ["--glass-shadow", "--t-glass-sh"],
  ["--fab-shadow", "--t-plus-sh"],
];

describe("os tokens do app são os do mockup, nos 8 temas, claro e escuro", () => {
  const casos = TEMAS.flatMap((t) =>
    (["light", "dark"] as const).map((m) => [t, m] as const)
  );
  it.each(casos)("%s / %s", (tema, modo) => {
    const mk = tokensDoMockup(tema, modo);
    for (const [app, doMockup] of MAPA) {
      const valor = token(app, tema, modo);
      expect(valor, `${app} (${tema}/${modo})`).toBeDefined();
      expect(norm(valor!), `${app} = ${doMockup} (${tema}/${modo})`).toBe(
        norm(mk[doMockup])
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Fonte, barra pílula e "+"
// ---------------------------------------------------------------------------

describe("casca no visual do mockup", () => {
  it("a fonte da interface é a Plus Jakarta Sans do mockup, sem ajuste de glifos", () => {
    expect(MOCKUP).toMatch(
      /\.ph \{[^}]*font-family:'Plus Jakarta Sans', system-ui, sans-serif/
    );
    const root = CSS.slice(CSS.indexOf("/* ── Base"));
    expect(root).toMatch(
      /font-family: var\(--font-jakarta\), "Plus Jakarta Sans", system-ui, sans-serif;/
    );
    expect(root.slice(0, root.indexOf("}"))).not.toMatch(
      /font-feature-settings/
    );
  });

  it("a barra pílula usa o vidro do mockup (fundo, borda, blur com saturação)", () => {
    const nav = read("components/BottomNav.tsx");
    expect(nav).toMatch(/background: "var\(--glass\)"/);
    expect(nav).toMatch(/border: "1px solid var\(--glass-border\)"/);
    expect(nav).toMatch(/backdropFilter: "blur\(20px\) saturate\(1\.8\)"/);
    expect(nav).toMatch(/from "@\/components\/navIcones"/);
    expect(nav).not.toMatch(/from "lucide-react"/);
    // a aba ativa não brilha
    expect(nav).not.toMatch(/boxShadow: active/);
  });

  it('o "+" tem a sombra do mockup e fica na mesma linha da pílula', () => {
    const fab = read("components/FAB.tsx");
    expect(fab).toMatch(/boxShadow: "0 8px 20px var\(--fab-shadow\)"/);
    expect(fab).toMatch(/BOTTOM_NAV_OFFSET - navStyle\.translateY/);
    expect(fab).toMatch(
      /<Plus\s+size=\{24\}\s+color="white"\s+strokeWidth=\{2\.6\}/
    );
  });
});

describe('o "+" da Rede é o "Postar" do mockup, sem ação nova', () => {
  it('o mockup tem "Postar" no "+" da Rede', () => {
    const rede = MOCKUP.slice(
      MOCKUP.indexOf('<figure class="frame" data-t="rede" data-md="light">')
    );
    expect(rede.slice(0, rede.indexOf("</figure>"))).toMatch(
      /class="plus" aria-label="Postar"/
    );
  });

  it('o FAB da Rede se chama "Postar"', () => {
    const fab = read("components/FAB.tsx");
    expect(fab).toMatch(/rede: \{\s*label: "Postar",/);
    expect(fab).toMatch(/rede: "Postar",/);
  });

  it.each(["app/page.tsx", "app/dev-preview/app/page.tsx"])(
    '%s: só desenha o "+" da Rede com a Rede liberada, e o toque vira o sinal de postar',
    (pagina) => {
      const src = read(pagina);
      expect(src).toMatch(
        /activeTab === "rede" && redeAcesso !== "liberado"\s*\?\s*undefined/
      );
      expect(src).toMatch(
        /activeTab === "rede"\) \{\s*setRedePostar\(\(n\) => n \+ 1\);/
      );
      expect(src).toMatch(/postarSignal=\{redePostar\}/);
    }
  );

  it("o sinal chega na Rede e abre o MESMO compositor do Postar do feed", () => {
    expect(read("components/rede/RedeGatedTab.tsx")).toMatch(
      /postarSignal=\{postarSignal\}/
    );
    const tab = read("components/rede/RedeTab.tsx");
    expect(tab).toMatch(
      /if \(postarSignal === ultimoPostar\.current\) return;\s*ultimoPostar\.current = postarSignal;\s*setComposerOpen\(true\);/
    );
    expect(tab).toMatch(/onOpenComposer=\{\(\) => setComposerOpen\(true\)\}/);
  });
});

// ---------------------------------------------------------------------------
// Ícones: o traço exato do mockup
// ---------------------------------------------------------------------------

describe("os ícones da Agenda e da barra têm o traço do mockup", () => {
  const agenda = MOCKUP.slice(
    MOCKUP.indexOf('<figure class="frame" data-t="agenda" data-md="light">'),
    MOCKUP.indexOf(
      "</figure>",
      MOCKUP.indexOf('data-t="agenda" data-md="light"')
    )
  );
  const svgs = [...agenda.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
  const formas = new Set(
    svgs.flatMap((s) =>
      [...s.matchAll(/<(path|circle|rect)\s+([^>]*?)\/>/g)].map(
        (m) => `${m[1]} ${m[2]}`
      )
    )
  );
  const icones =
    read("components/jobs/agendaIcones.tsx") + read("components/navIcones.tsx");
  const doApp = [
    ...icones.matchAll(/<(path|circle|rect)\s+([^>]*?)\s*\/>/g),
  ].map((m) => `${m[1]} ${m[2].replace(/\s+/g, " ").trim()}`);

  it("o mockup tem os ícones da tela", () => {
    expect(svgs.length).toBeGreaterThan(10);
  });

  it.each(doApp)("%s existe no mockup", (forma) => {
    expect(formas).toContain(forma);
  });
});

// ---------------------------------------------------------------------------
// Agenda: ordem e marcas
// ---------------------------------------------------------------------------

describe("a Agenda na ordem do mockup", () => {
  const tab = read("components/jobs/JobsTab.tsx");

  it("cabeçalho com busca e sino desabilitados (não existem no app)", () => {
    expect(tab).toMatch(/rotulo: "Buscar", Icone: IconeBusca/);
    expect(tab).toMatch(/rotulo: "Notificações", Icone: IconeSino/);
    expect(tab).toMatch(/key=\{rotulo\}\s*type="button"\s*disabled/);
  });

  it("das listas pra baixo: Esta semana, Próximas semanas e só depois a navegação de semana e o dia", () => {
    const i = (marca: string) => {
      const n = tab.indexOf(marca);
      expect(n, marca).toBeGreaterThan(-1);
      return n;
    };
    expect(i("{weekStrip.map(")).toBeLessThan(i("<EstaSemanaSection"));
    expect(i("<EstaSemanaSection")).toBeLessThan(i("<ProximasSemanasSection"));
    expect(i("<ProximasSemanasSection")).toBeLessThan(
      i('aria-label="Semana anterior"')
    );
    expect(i('aria-label="Semana anterior"')).toBeLessThan(
      i("key={selectedDate}")
    );
  });

  it("o dia escolhido não sobe nem brilha, e o ponto de atendimento não empurra o número", () => {
    expect(tab).not.toMatch(/translateY\(-3px\) scale\(1\.035\)/);
    expect(tab).not.toMatch(/boxShadow: selected \? "var\(--glow-sm\)"/);
    expect(tab).toMatch(
      /className="absolute rounded-full"\s*style=\{\{\s*bottom: "6px"/
    );
  });
});

// ---------------------------------------------------------------------------
// Laboratório: os dados do mockup na quarta, 23/09/2026
// ---------------------------------------------------------------------------

describe("os dados do laboratório casam com o mockup (quarta, 23/09/2026)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** As linhas de uma seção do mockup da Agenda: [nome, "Dia NN · HHhMM"]. */
  function linhasDoMockup(titulo: string): [string, string][] {
    const i = MOCKUP.indexOf(
      `>${titulo}</h2>`,
      MOCKUP.indexOf('data-t="agenda" data-md="light"')
    );
    const fim = MOCKUP.indexOf("</section>", i);
    return [
      ...MOCKUP.slice(i, fim).matchAll(
        /font-size:14px;font-weight:700">([^<]+)<\/div><div style="font-size:11px;color:var\(--t-mut\)">([^<]+)</g
      ),
    ].map((m) => [m[1], m[2].split(" · ").slice(0, 2).join(" · ")]);
  }

  it("Esta semana e Próximas semanas: mesmos nomes, dias e horas, na mesma ordem", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 23, 10, 0));
    const jobs = buildMockAppSeed().tables.jobs as {
      cliente_nome: string;
      data: string;
      hora: string;
    }[];
    const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const rotulo = (j: { data: string; hora: string }) => {
      const [a, m, d] = j.data.split("-").map(Number);
      const dia = new Date(a, m - 1, d);
      return `${DIAS[dia.getDay()]} ${String(d).padStart(2, "0")} · ${j.hora.replace(":", "h")}`;
    };
    const entre = (de: string, ate: string) =>
      jobs
        .filter((j) => j.data >= de && j.data <= ate)
        .sort((x, y) => (x.data + x.hora).localeCompare(y.data + y.hora))
        .map((j) => [j.cliente_nome, rotulo(j)]);
    expect(entre("2026-09-20", "2026-09-26")).toEqual(
      linhasDoMockup("Esta semana")
    );
    expect(entre("2026-09-27", "2026-10-31")).toEqual(
      linhasDoMockup("Próximas semanas")
    );
  });
});
