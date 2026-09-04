import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Achado P1 (rodada de preflight 2026-09-04, testado ao vivo no deploy de
 * produção): `handleFabAction` (app/page.tsx) já escolhia o formulário
 * certo por sub-aba do Financeiro (Entradas → ReceitaForm, Saídas →
 * DespesaForm, Metas → MetaForm, qualquer outra/Visão → DespesaForm), mas
 * o texto do sheet do FAB (`FAB.tsx`) ficava fixo em "Editar Meta" pra
 * toda a aba Financeiro. Resultado real: na sub-aba Visão o sheet dizia
 * "Editar Meta" e abria Nova Despesa. Mesmo padrão de inspeção de
 * código-fonte já usado no projeto (sem Testing Library/Playwright,
 * ambiente do vitest é "node", sem DOM) -- aqui cruzando dois arquivos
 * pra travar os dois lados do contrato juntos, já que o bug nasceu
 * exatamente de eles terem ficado dessincronizados um do outro.
 */

const fabSrc = readFileSync(
  join(__dirname, "..", "..", "components", "FAB.tsx"),
  "utf-8"
);
const pageSrc = readFileSync(
  join(__dirname, "..", "..", "app", "page.tsx"),
  "utf-8"
);

function extractBody(source: string, fnSignature: string): string {
  const idx = source.indexOf(fnSignature);
  if (idx === -1) throw new Error(`${fnSignature} não encontrado`);
  const braceStart = source.indexOf("{", idx);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(braceStart + 1, i);
    }
  }
  throw new Error(`Chave de fechamento de ${fnSignature} não encontrada`);
}

const handleFabActionBody = extractBody(pageSrc, "function handleFabAction()");
const financeiroSheetActionsSrc = extractBody(
  fabSrc,
  "const FINANCEIRO_SHEET_ACTIONS: Record<string, SheetAction> ="
);

function fabLabelFor(subTab: string): string {
  const re = new RegExp(`${subTab}:\\s*\\{[^}]*label:\\s*"([^"]+)"`);
  const match = financeiroSheetActionsSrc.match(re);
  if (!match) throw new Error(`Sem entrada FINANCEIRO_SHEET_ACTIONS.${subTab}`);
  return match[1];
}

describe("FAB do Financeiro — rótulo do sheet bate com o form que realmente abre", () => {
  it("finInnerTab: entradas -> handleFabAction abre ReceitaForm", () => {
    expect(handleFabActionBody).toMatch(
      /finInnerTab === "entradas"\)\s*setReceitaFormOpen\(true\)/
    );
  });
  it('FAB: financeiroSubTab "entradas" -> rótulo de Nova Entrada', () => {
    expect(fabLabelFor("entradas")).toBe("Nova Entrada");
  });

  it("finInnerTab: saidas -> handleFabAction abre DespesaForm", () => {
    expect(handleFabActionBody).toMatch(
      /finInnerTab === "saidas"\)\s*setDespesaFormOpen\(true\)/
    );
  });
  it('FAB: financeiroSubTab "saidas" -> rótulo de Nova Despesa', () => {
    expect(fabLabelFor("saidas")).toBe("Nova Despesa");
  });

  it("finInnerTab: metas -> handleFabAction abre MetaForm", () => {
    expect(handleFabActionBody).toMatch(
      /finInnerTab === "metas"\)\s*setMetaFormOpen\(true\)/
    );
  });
  it('FAB: financeiroSubTab "metas" -> rótulo de Editar Meta', () => {
    expect(fabLabelFor("metas")).toBe("Editar Meta");
  });

  it("finInnerTab: fallback (ex.: Visão, qualquer sub-aba desconhecida) -> handleFabAction abre DespesaForm", () => {
    const fallback = handleFabActionBody.match(
      /else\s*setDespesaFormOpen\(true\);/
    );
    expect(fallback).not.toBeNull();
  });
  it("FAB: fallback sem financeiroSubTab reconhecido -> mesmo rótulo de Nova Despesa (não 'Editar Meta')", () => {
    expect(fabSrc).toMatch(
      /\(financeiroSubTab && FINANCEIRO_SHEET_ACTIONS\[financeiroSubTab\]\) \|\|\s*FINANCEIRO_SHEET_ACTIONS\.saidas/
    );
  });

  it("app/page.tsx passa financeiroSubTab={finInnerTab} pro FAB real (não só a ref antiga activeTab)", () => {
    const fabUsage = pageSrc.match(/<FAB\b[\s\S]*?\/>/);
    expect(fabUsage).not.toBeNull();
    expect(fabUsage![0]).toMatch(/financeiroSubTab=\{finInnerTab\}/);
  });
});
