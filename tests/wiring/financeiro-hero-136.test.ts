import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regressão da ticket #136 (mapa #122) — migração do Financeiro pra
 * composição/hero de `/dev-preview/ios`. Mesmo padrão de inspeção de
 * código-fonte já usado no projeto (sem DOM/RTL — ver nota em
 * `agenda-visual.test.ts`/`financeiro-visual.test.ts`).
 *
 * Cobre os contratos que `financeiro-visual.test.ts` (T4) não cobria:
 * 1. o hero de saldo fica acima das 4 sub-abas, sempre visível (não só
 *    dentro de Visão);
 * 2. o pulso focusTab (Objetivos→Metas, Fase 2/#125) continua intacto;
 * 3. estado de erro — distinto de agenda/financeiro vazio, dado
 *    existente preservado em revalidação, "Tentar novamente" redispara
 *    o fetch real (mesmo padrão de JobsTab.tsx/#135).
 */

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

const financeiroTabSrc = read("components/financeiro/FinanceiroTab.tsx");

describe("Card-herói de saldo fica acima das 4 sub-abas, sempre visível (composição aprovada)", () => {
  it("FinanceiroHeroCard é renderizado antes do SegmentedControl das sub-abas, fora do switch por sub-aba", () => {
    const heroIdx = financeiroTabSrc.indexOf("<FinanceiroHeroCard");
    // Índice do USO em JSX, não do import no topo do arquivo — o import
    // também contém a palavra "SegmentedControl", então buscamos a tag
    // de abertura seguida de `className="mb-5"` (o uso real, único).
    const segmentedIdx = financeiroTabSrc.search(
      /<SegmentedControl\r?\n\s*className="mb-5"/
    );
    const visaoIdx = financeiroTabSrc.indexOf('tab === "visao"');
    expect(heroIdx).toBeGreaterThan(-1);
    expect(segmentedIdx).toBeGreaterThan(-1);
    expect(visaoIdx).toBeGreaterThan(-1);
    expect(heroIdx).toBeLessThan(segmentedIdx);
    expect(segmentedIdx).toBeLessThan(visaoIdx);
  });

  it("o hero recebe dado real (jobs/receitas/despesas/totais/saldo), nunca props fabricadas", () => {
    expect(financeiroTabSrc).toMatch(
      /<FinanceiroHeroCard[\s\S]*?jobs=\{jobs\}[\s\S]*?receitas=\{receitas\}[\s\S]*?despesas=\{despesas\}[\s\S]*?totalEntradaMes=\{totalEntradaMes\}[\s\S]*?totalDespMes=\{totalDespMes\}[\s\S]*?saldo=\{saldo\}/
    );
  });
});

describe("Pulso de navegação focusTab (Objetivos→Metas, Fase 2/#125) continua intacto", () => {
  it("o efeito ignora focusTab vazio/null e consome via changeTab, exatamente como antes desta ticket", () => {
    expect(financeiroTabSrc).toMatch(
      /if \(!focusTab\) return;\s*\r?\n\s*changeTab\(focusTab\);\s*\r?\n\s*onFocusTabHandled\?\.\(\);/
    );
  });

  it('a sub-aba interna nasce em "visao" — sem pulso, uma 2ª visita não pula pra Metas', () => {
    expect(financeiroTabSrc).toContain('useState<InnerTab>("visao")');
  });
});

describe("Estado de erro (issue #136) — distinto de vazio, preserva dado existente, retry real", () => {
  it("o efeito de fetch lê `error` de cada uma das 4 consultas, não só `data`", () => {
    expect(financeiroTabSrc).toContain("const anyError =");
    expect(financeiroTabSrc).toContain(
      "jobsRes.error || metasRes.error || despRes.error || recRes.error;"
    );
  });

  it("em erro, NENHUM dos 4 setters (setJobs/setMetas/setDespesas/setReceitas) é chamado — o branch de erro retorna antes deles", () => {
    const errorBranch = financeiroTabSrc.match(
      /if \(anyError\) \{[\s\S]*?\n {6}\}/
    );
    expect(errorBranch).not.toBeNull();
    expect(errorBranch![0]).not.toMatch(
      /setJobs\(|setMetas\(|setDespesas\(|setReceitas\(/
    );
    expect(errorBranch![0]).toContain("setLoadError(true)");
    expect(errorBranch![0]).toContain("return;");
  });

  it("só o caminho de sucesso marca hasLoadedOnce e limpa o erro", () => {
    expect(financeiroTabSrc).toContain("setHasLoadedOnce(true)");
    expect(financeiroTabSrc).toMatch(
      /setHasLoadedOnce\(true\);\s*\r?\n\s*setLoadError\(false\);/
    );
  });

  it('"blockingError" (1ª carga falha, sem dado nenhum) é distinto de qualquer estado vazio das sub-abas — painel de erro próprio', () => {
    expect(financeiroTabSrc).toContain(
      "const blockingError = loadError && !hasLoadedOnce;"
    );
    expect(financeiroTabSrc).toContain(
      "Não foi possível carregar seu financeiro"
    );
    const ternaryIdx = financeiroTabSrc.indexOf("{blockingError ? (");
    const messageIdx = financeiroTabSrc.indexOf(
      "Não foi possível carregar seu financeiro"
    );
    expect(ternaryIdx).toBeGreaterThan(-1);
    expect(messageIdx).toBeGreaterThan(ternaryIdx);
  });

  it("o painel bloqueante não renderiza o hero/sub-abas — não há dado nenhum pra calcular saldo ainda", () => {
    const blockingBlock = financeiroTabSrc.match(
      /\{blockingError \? \([\s\S]*?\) : initialLoading \? \(/
    );
    expect(blockingBlock).not.toBeNull();
    expect(blockingBlock![0]).not.toContain("<FinanceiroHeroCard");
    expect(blockingBlock![0]).not.toContain("<SegmentedControl");
  });

  it('erro de revalidação (dado já carregado) mostra aviso não-bloqueante "Mostrando dados já carregados" — hero/sub-abas continuam no ar', () => {
    expect(financeiroTabSrc).toContain("{loadError && hasLoadedOnce && (");
    expect(financeiroTabSrc).toContain(
      "Não foi possível atualizar. Mostrando dados já carregados."
    );
  });

  it('"Tentar novamente" existe nos dois estados de erro e chama retryLoadFinanceiro (redispara o fetch real, não uma função nova)', () => {
    const retryOccurrences = financeiroTabSrc.match(
      /onClick=\{retryLoadFinanceiro\}/g
    );
    expect(retryOccurrences).not.toBeNull();
    expect(retryOccurrences!.length).toBeGreaterThanOrEqual(2);
    expect(financeiroTabSrc).toMatch(
      /function retryLoadFinanceiro\(\) \{\s*\r?\n\s*setRetryNonce\(\(n\) => n \+ 1\);\s*\r?\n\s*\}/
    );
    expect(financeiroTabSrc).toContain("[userId, refreshTrigger, retryNonce]");
  });

  it("durante uma revalidação em segundo plano (retry com dado já carregado), a UI não volta pro spinner — usa initialLoading, não loading cru", () => {
    expect(financeiroTabSrc).toContain(
      "const initialLoading = loading && !hasLoadedOnce;"
    );
    expect(financeiroTabSrc).toContain("initialLoading ? (");
  });

  it("as 4 sub-abas e o hero continuam funcionando fora dos dois estados de erro (não foram quebrados pela mudança)", () => {
    expect(financeiroTabSrc).toContain("<VisaoTab jobs={jobs}");
    expect(financeiroTabSrc).toContain("<EntradasTab");
    expect(financeiroTabSrc).toContain("<SaidasTab");
    expect(financeiroTabSrc).toContain("<MetasTab");
  });
});
