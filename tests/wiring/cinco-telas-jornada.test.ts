import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * J07 (#157) — as 5 telas novas da Jornada montadas juntas no laboratório.
 *
 * `/dev-preview/app` é onde a regressão visual da J07 roda. Este teste
 * garante que o que aparece lá são as abas REAIS: cada componente vem do
 * caminho de produção, uma vez só, sem cópia local, sem mock de tela, e é
 * renderizado dentro do `TabPanel` da aba certa. Também confere que a
 * página de produção (`app/page.tsx`) monta os mesmos componentes, pra
 * que o laboratório não divirja do app.
 *
 * Teste de código-fonte (sem RTL/JSX no Vitest), mesmo padrão de
 * `tests/wiring/*-visual*.test.ts`.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const lf = (s: string) => s.replace(/\r\n/g, "\n");

const lab = lf(read("app/dev-preview/app/page.tsx"));
const prod = lf(read("app/page.tsx"));

interface Aba {
  /** Nome da aba como a usuária vê. */
  nome: string;
  /** Id do `TabPanel` (`TabId`). */
  tab: string;
  /** Componentes que a aba monta, com o caminho real de cada um. */
  componentes: { nome: string; caminho: string }[];
}

const ABAS: Aba[] = [
  {
    nome: "Início",
    tab: "home",
    componentes: [
      { nome: "GreetingHeader", caminho: "@/components/home/GreetingHeader" },
      { nome: "HeroCard", caminho: "@/components/home/HeroCard" },
      { nome: "NextJobCard", caminho: "@/components/home/NextJobCard" },
      { nome: "ObjetivosCard", caminho: "@/components/home/ObjetivosCard" },
    ],
  },
  {
    nome: "Agenda",
    tab: "jobs",
    componentes: [{ nome: "JobsTab", caminho: "@/components/jobs/JobsTab" }],
  },
  {
    nome: "Financeiro",
    tab: "financeiro",
    componentes: [
      {
        nome: "FinanceiroTab",
        caminho: "@/components/financeiro/FinanceiroTab",
      },
    ],
  },
  {
    nome: "Cofre",
    tab: "cofre",
    componentes: [{ nome: "CofreTab", caminho: "@/components/cofre/CofreTab" }],
  },
  {
    nome: "Rede",
    tab: "rede",
    componentes: [
      { nome: "RedeGatedTab", caminho: "@/components/rede/RedeGatedTab" },
    ],
  },
];

/** Linhas de import da página. */
function importLines(src: string): string[] {
  // Junta imports de várias linhas numa linha só antes de filtrar.
  return src
    .replace(/import\s*{[^}]*}\s*from\s*"[^"]+";/g, (m) =>
      m.replace(/\s+/g, " ")
    )
    .split("\n")
    .filter((l) => /^\s*import\b/.test(l));
}

/** Conteúdo JSX do `<TabPanel tab="X" ...>` até o `</TabPanel>` seguinte. */
function tabPanel(src: string, tab: string): string {
  const start = src.indexOf(`<TabPanel tab="${tab}"`);
  expect(start, `TabPanel "${tab}" não encontrado`).toBeGreaterThan(-1);
  const end = src.indexOf("</TabPanel>", start);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

function caminhoDoArquivo(caminho: string): string {
  return caminho.replace(/^@\//, "") + ".tsx";
}

describe("/dev-preview/app importa as 5 abas dos caminhos reais", () => {
  for (const aba of ABAS) {
    for (const c of aba.componentes) {
      it(`${aba.nome}: importa ${c.nome} de ${c.caminho}, uma vez só`, () => {
        const linhas = importLines(lab).filter((l) =>
          new RegExp(`\\b${c.nome}\\b`).test(l)
        );
        expect(linhas, `imports de ${c.nome}`).toHaveLength(1);
        expect(linhas[0]).toMatch(
          new RegExp(`import\\s*{\\s*${c.nome}\\s*}\\s*from\\s*"${c.caminho}"`)
        );
        expect(existsSync(join(ROOT, caminhoDoArquivo(c.caminho)))).toBe(true);
      });

      it(`${aba.nome}: renderiza <${c.nome} dentro do TabPanel "${aba.tab}"`, () => {
        expect(tabPanel(lab, aba.tab)).toContain(`<${c.nome}`);
      });

      it(`${aba.nome}: ${c.nome} não é redefinido nem substituído por cópia local`, () => {
        expect(lab).not.toMatch(
          new RegExp(`(function|const|let|class)\\s+${c.nome}\\b`)
        );
      });
    }
  }

  it("as 5 abas têm um TabPanel cada no laboratório, uma vez só", () => {
    for (const aba of ABAS) {
      const n = lab.split(`<TabPanel tab="${aba.tab}"`).length - 1;
      expect(n, aba.tab).toBe(1);
    }
  });

  it("nenhum componente de tela vem de mock, protótipo ou do laboratório antigo", () => {
    const telas = importLines(lab).filter((l) =>
      /@\/components\/(home|jobs|financeiro|cofre|rede)\//.test(l)
    );
    expect(telas.length).toBeGreaterThan(0);
    for (const l of telas) {
      expect(l).not.toMatch(
        /mock|prototype|prototipo|ios-|launch|lab|copia|Copy/i
      );
    }
  });

  it("o mock fica só nos dados (cliente Supabase em memória), nunca no lugar de uma tela", () => {
    expect(lab).toContain('from "@/lib/mockSupabase"');
    expect(lab).toContain('from "@/lib/mockAppData"');
    // Nenhum import de tela a partir de lib/ (onde mora o mock).
    for (const l of importLines(lab).filter((x) => /@\/lib\//.test(x))) {
      expect(l).not.toMatch(
        /\b(JobsTab|FinanceiroTab|CofreTab|RedeGatedTab|RedeTab|HeroCard)\b/
      );
    }
  });

  it("a Rede do laboratório chega no RedeTab real (via RedeGatedTab, como no app)", () => {
    const gated = lf(read("components/rede/RedeGatedTab.tsx"));
    expect(gated).toMatch(/import\s*{\s*RedeTab\s*}\s*from\s*"\.\/RedeTab"/);
    expect(gated).toContain("<RedeTab");
  });
});

describe("O laboratório monta as mesmas abas que o app de produção", () => {
  for (const aba of ABAS) {
    for (const c of aba.componentes) {
      it(`app/page.tsx também importa ${c.nome} de ${c.caminho} e o renderiza no TabPanel "${aba.tab}"`, () => {
        expect(prod).toMatch(
          new RegExp(`import\\s*{\\s*${c.nome}\\s*}\\s*from\\s*"${c.caminho}"`)
        );
        expect(tabPanel(prod, aba.tab)).toContain(`<${c.nome}`);
      });
    }
  }
});
