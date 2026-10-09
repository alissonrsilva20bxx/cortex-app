import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Teste de fiação (não de renderização), mesmo padrão de
 * `tests/wiring/inicio-visual.test.ts` (T2) e
 * `tests/wiring/agenda-visual.test.ts` (T3): confirma, a partir do
 * código fonte, que `/dev-preview/app` realmente importa e renderiza o
 * `FinanceiroTab` real (não uma cópia/mock), e que os arquivos de
 * Financeiro tocados por este ticket (T4/#31) carregam o marcador da
 * composição nova sem perder a funcionalidade real preservada, sem
 * copiar números/coordenadas hardcoded do laboratório.
 *
 * Não usa Vitest+RTL: este projeto não tem `@testing-library/react` nem
 * um plugin de JSX no `vitest.config.ts`. Ler o arquivo como texto evita
 * isso e ainda pega o bug relatado (import antigo, wrapper escondendo o
 * componente novo, versão duplicada, dado fabricado copiado do mock).
 */

const ROOT = join(__dirname, "..", "..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

describe("/dev-preview/app renders the T4 Financeiro component", () => {
  const page = read("app/dev-preview/app/page.tsx");

  it("imports FinanceiroTab from the real component path, not a duplicate/mock", () => {
    expect(page).toMatch(
      /import\s*{[^}]*\bFinanceiroTab\b[^}]*}\s*from\s*"@\/components\/financeiro\/FinanceiroTab"/
    );
  });

  it("actually renders <FinanceiroTab in the financeiro tab JSX", () => {
    expect(page).toContain("<FinanceiroTab");
  });

  it("does not import a second/alternate copy of FinanceiroTab from elsewhere", () => {
    const importLines = page.split("\n").filter((l) => /^\s*import\b/.test(l));
    const matches = importLines.filter((l) => /\bFinanceiroTab\b/.test(l));
    expect(matches).toHaveLength(1);
  });
});

describe("FinanceiroTab.tsx keeps the 4 real sub-tabs, no reduction to a single screen", () => {
  const src = read("components/financeiro/FinanceiroTab.tsx");

  it("still mounts VisaoTab, EntradasTab, SaidasTab, and MetasTab", () => {
    expect(src).toContain("<VisaoTab");
    expect(src).toContain("<EntradasTab");
    expect(src).toContain("<SaidasTab");
    expect(src).toContain("<MetasTab");
  });

  it("still drives sub-tab switching through the real SegmentedControl, not a new component", () => {
    expect(src).toContain("SegmentedControl");
    expect(src).toContain('"visao" | "entradas" | "saidas" | "metas"');
  });
});

describe("FinanceiroHeroCard.tsx (issue #136) uses real data/calculations, never a hardcoded lab value", () => {
  const src = read("components/financeiro/FinanceiroHeroCard.tsx");

  it("formats every displayed value through formatBRL(prop), never a literal currency string", () => {
    expect(src).toContain("formatBRL(totalEntradaMes");
    expect(src).toContain("formatBRL(totalDespMes");
    expect(src).toContain("formatBRL(saldo");
  });

  it("does not contain any of the lab's hardcoded FinanceScreen numbers/text", () => {
    for (const fabricated of [
      "2.350",
      "7.200",
      "4.850",
      "10.000",
      "2.480",
      "4.250",
      "1.770",
      "+18%",
      "23%",
      "Ver relatórios completos",
      "Insight do mês",
      "Maio de 2025",
    ]) {
      expect(src).not.toContain(fabricated);
    }
  });

  it("does not contain the lab's hardcoded SVG path/polyline", () => {
    expect(src).not.toMatch(/M5 79 C35 69/);
    expect(src).not.toMatch(/points="0,110 35,110/);
  });

  it("does not use .section-label (eyebrow-caps root cause fixed in T2)", () => {
    // A prose mention in a comment (explaining the decision) is fine;
    // an actual className="section-label" usage is not.
    expect(src).not.toMatch(/className=["'{].*section-label/);
  });
});

// Correção do gráfico (print do operador de 09/10/2026): o aprovado são as
// 2 barras horizontais do "Saldo do mês" (verde: entrou; vermelho: saiu),
// não os 8 palitos verticais (S1…S8). Os palitos saíram por inteiro.
describe("Financeiro sem palitos: só a barra entrou x saiu do Saldo do mês", () => {
  const hero = read("components/financeiro/FinanceiroHeroCard.tsx");
  const semComentarios = hero
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("o componente dos palitos e o gráfico de área foram apagados", () => {
    for (const f of [
      "components/financeiro/FinanceiroGrafico.tsx",
      "components/charts/AreaSparkline.tsx",
    ])
      expect(existsSync(join(__dirname, "..", "..", f))).toBe(false);
    expect(semComentarios).not.toMatch(/FinanceiroGrafico|grafico-palitos/);
  });

  it("nenhum palito em lugar nenhum do Financeiro", () => {
    for (const f of readdirSync(
      join(__dirname, "..", "..", "components", "financeiro")
    ))
      expect(read(`components/financeiro/${f}`)).not.toMatch(
        /MiniBarChart|AreaSparkline|buildChartData|last30DaysSpark/
      );
  });

  it("as funções de dados dos palitos saíram de lib/finance.ts", () => {
    const fin = read("lib/finance.ts");
    expect(fin).not.toMatch(/buildChartData|last30DaysSpark|ChartPeriod/);
  });

  it("a preferência 'Gráfico — Financeiro' (barras/área) saiu dos Ajustes e das páginas", () => {
    expect(read("components/ajustes/AjustesTab.tsx")).not.toContain(
      "Gráfico — Financeiro"
    );
    expect(read("lib/types.ts")).not.toMatch(/financeiro: "bar" \| "area"/);
    for (const p of ["app/page.tsx", "app/dev-preview/app/page.tsx"])
      expect(read(p)).not.toMatch(/chartPrefs\.financeiro/);
  });

  it("a barra: verde (entrou) e vermelha (saiu) do tema, proporcionais aos totais do mês", () => {
    expect(semComentarios).toMatch(
      /flex: totalEntradaMes, background: "var\(--t-green\)"/
    );
    expect(semComentarios).toMatch(
      /flex: totalDespMes, background: "var\(--t-red\)"/
    );
    expect(semComentarios).toContain(
      "<span>Entrou {formatBRL(totalEntradaMes)}</span>"
    );
    expect(semComentarios).toContain(
      "<span>Saiu {formatBRL(totalDespMes)}</span>"
    );
  });

  it("no lugar do desenho: abaixo do saldo e acima dos 4 cards", () => {
    const saldo = semComentarios.indexOf("{formatBRL(saldo)}");
    const barra = semComentarios.indexOf('background: "var(--t-green)"');
    const entradas = semComentarios.indexOf(
      "<span style={ROTULO}>Entradas</span>"
    );
    expect(saldo).toBeGreaterThan(0);
    expect(barra).toBeGreaterThan(saldo);
    expect(entradas).toBeGreaterThan(barra);
  });
});

// Correção da barra (09/10/2026): ela sempre aparece. Antes, com o mês
// zerado (R$ 0 de entrada e de saída), não desenhava nada.
describe("barra entrou x saiu do Saldo do mês: sempre desenhada", () => {
  const hero = read("components/financeiro/FinanceiroHeroCard.tsx")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("a barra não depende de haver movimento no mês (nada de `movimento > 0 &&` em volta)", () => {
    expect(hero).not.toMatch(/\{movimento > 0 && \(\s*<div/);
    expect(hero).toMatch(
      /<div\s+data-saldo-barra=\{movimento > 0 \? "movimento" : "vazia"\}/
    );
  });

  it("mês zerado: a trilha cinza vazia (--t-line), mesma altura e lugar", () => {
    const barra = hero.slice(hero.indexOf("data-saldo-barra"));
    expect(barra).toMatch(/height: "8px",/);
    expect(barra).toMatch(/borderRadius: "4px",/);
    expect(barra).toMatch(
      /background: movimento > 0 \? undefined : "var\(--t-line\)",/
    );
  });

  it("cada lado só aparece com valor: só entrada é verde inteiro; só saída, vermelho inteiro", () => {
    expect(hero).toMatch(
      /\{totalEntradaMes > 0 && \(\s*<span\s+style=\{\{ flex: totalEntradaMes, background: "var\(--t-green\)" \}\}/
    );
    expect(hero).toMatch(
      /\{totalDespMes > 0 && \(\s*<span style=\{\{ flex: totalDespMes, background: "var\(--t-red\)" \}\} \/>/
    );
  });

  it("o laboratório monta os 3 casos pelo ?financeiro=", () => {
    const lab = read("app/dev-preview/app/page.tsx");
    expect(lab).toMatch(
      /aplicarCasoFinanceiro\(\s*buildMockAppSeed\(\{ objetivosCount \}\),\s*ehCasoFinanceiro\(financeiroParam\) \? financeiroParam : null\s*\)/
    );
  });
});

describe("Honesty rule (issue #136) — variação % only with a real, non-zero previous period", () => {
  const src = read("components/financeiro/FinanceiroHeroCard.tsx");

  it("prevSaldo is computed from real lib/finance.ts calls against last month, not invented", () => {
    expect(src).toContain('calcEarnings(jobs, receitas, "mes", prevRef)');
    expect(src).toContain("monthExpenses(despesas, prevRef)");
  });

  it('variacaoPct is null (badge omitted) whenever prevSaldo is 0 — never a fabricated "0%" or invented number', () => {
    expect(src).toContain("prevSaldo !== 0 ?");
    expect(src).toMatch(/prevSaldo !== 0[\s\S]{0,100}: null/);
  });

  it("the badge only renders when variacaoPct is not null (real, computable value)", () => {
    expect(src).toContain("{variacaoPct !== null && (");
  });
});

describe("VisaoTab.tsx (issue #136) — Movimentações recentes, 100% real, never the lab's 3 fixed rows", () => {
  const src = read("components/financeiro/VisaoTab.tsx");

  it("merges real jobs concluídos + receitas + despesas, sorted by real date — never a static array", () => {
    // A conta mora em movimentos.ts (testável sem JSX); a VisaoTab só a usa.
    expect(src).toContain(
      'import { buildMovements, type Movement } from "./movimentos";'
    );
    const mov = read("components/financeiro/movimentos.ts");
    expect(mov).toContain('.filter((j) => j.status === "concluído")');
    expect(mov).toContain("despesas.map((d) =>");
    expect(mov).toContain("receitas.map((r) =>");
    expect(mov).toContain(".sort((a, b) => b.data.localeCompare(a.data))");
  });

  it("does not contain the lab's hardcoded movement rows", () => {
    for (const fabricated of [
      "Marina Costa",
      "Assinatura de ferramentas",
      "Cliente Preflight QA",
      "R$ 180,00",
      "R$ 89,90",
      "R$ 250,00",
    ]) {
      expect(src).not.toContain(fabricated);
    }
  });

  it("rows are non-interactive (<div>, not <button>) — no invented 'edit generic movement' flow the real app can't fulfill", () => {
    expect(src).not.toMatch(/onClick=\{.*openSheet|onClick=\{\(\) => onEdit/);
    // Jornada J04 (#154): a lista virou duas no mockup ("Recentes" e "Mais
    // lançamentos", as mesmas movimentações divididas); a regra vale pras
    // duas -- cada linha é <div>.
    for (const lista of ["recentes", "mais"]) {
      const rowMatch = src.match(
        new RegExp(`${lista}\\.map\\(\\(m, i\\) => \\(\\s*\\r?\\n\\s*<div`)
      );
      expect(rowMatch, lista).not.toBeNull();
    }
  });

  it("does not use .section-label (eyebrow-caps root cause fixed in T2)", () => {
    expect(src).not.toMatch(/className=["'{].*section-label/);
  });
});

describe("Entradas/Saídas/Metas keep their real actions and 44px touch targets", () => {
  it("EntradasTab still calls the real onDeleteReceita/onAddReceita callbacks", () => {
    const src = read("components/financeiro/EntradasTab.tsx");
    expect(src).toContain("onDeleteReceita(item.id)");
    expect(src).toContain("onAddReceita?.()");
    expect(src).toContain("width: 44");
  });

  it("SaidasTab still calls the real onDeleteDespesa/onAddDespesa callbacks and the category breakdown", () => {
    const src = read("components/financeiro/SaidasTab.tsx");
    expect(src).toContain("onDeleteDespesa(d.id)");
    expect(src).toContain("onAddDespesa?.()");
    expect(src).toContain("catTotals");
    expect(src).toContain("width: 44");
  });

  it("MetasTab still persists real metas/objetivos (calcEarnings, Supabase insert, onToggleObjetivo)", () => {
    const src = read("components/financeiro/MetasTab.tsx");
    expect(src).toContain("calcEarnings(");
    expect(src).toContain('supabase.from("objetivos").insert(');
    expect(src).toContain("onToggleObjetivo(obj.id");
    expect(src).toContain('minHeight: "44px"');
  });

  it("none of the 3 sub-tabs use .section-label anymore", () => {
    for (const file of [
      "components/financeiro/EntradasTab.tsx",
      "components/financeiro/SaidasTab.tsx",
      "components/financeiro/MetasTab.tsx",
    ]) {
      // A prose mention in a comment (explaining the decision) is fine;
      // an actual className="section-label" usage is not.
      expect(read(file)).not.toMatch(/className=["'{].*section-label/);
    }
  });
});

describe("All 3 forms meet the 44px close-button touch target", () => {
  it.each([
    "components/financeiro/DespesaForm.tsx",
    "components/financeiro/ReceitaForm.tsx",
  ])("%s close button is 44×44px", (file) => {
    expect(read(file)).toContain("width: 44, height: 44");
  });

  it("MetaForm.tsx close button has explicit 44px min-width/min-height", () => {
    const src = read("components/financeiro/MetaForm.tsx");
    expect(src).toContain('minWidth: "44px"');
    expect(src).toContain('minHeight: "44px"');
  });
});
