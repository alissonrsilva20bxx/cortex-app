import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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

describe("VisaoTab.tsx uses real data/calculations, never a hardcoded lab value", () => {
  const src = read("components/financeiro/VisaoTab.tsx");

  it("computes the chart from real lib/finance.ts calls, not a static dataset", () => {
    expect(src).toContain("buildChartData(");
    expect(src).toContain("last30DaysSpark(");
  });

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
      "23%",
      "Ver relatórios completos",
      "Insight do mês",
      "Maio de 2025",
    ]) {
      expect(src).not.toContain(fabricated);
    }
  });

  it("does not contain the lab's hardcoded SVG polyline points", () => {
    expect(src).not.toMatch(/points="0,110 35,110/);
  });

  it("does not use .section-label (eyebrow-caps root cause fixed in T2)", () => {
    // A prose mention in a comment (explaining the decision) is fine;
    // an actual className="section-label" usage is not.
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
