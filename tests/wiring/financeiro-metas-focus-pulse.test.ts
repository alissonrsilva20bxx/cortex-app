import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regressão — pulso de navegação Início → Financeiro → sub-aba específica
 * (redesign iOS quase nativo, wayfinder #122). Duas origens usam o mesmo
 * pulso: Objetivos "Ver todos" → "metas" (ticket #125) e o CTA "Ver minha
 * evolução" do HeroCard → "visao" (ticket #134). Mesmo padrão de inspeção
 * de código-fonte já usado no projeto (sem DOM).
 *
 * `FinanceiroTab` fica sempre montada (`TabPanel` usa display:none, nunca
 * desmonta — ver TabPanel.tsx), então um valor inicial de `useState` só
 * funcionaria na 1ª visita. A solução é um "pulso": `app/page.tsx` sobe
 * `financeiroFocusTab` pra "metas" ou "visao", `FinanceiroTab` consome (muda
 * de aba + chama `onFocusTabHandled`), e `app/page.tsx` zera o pulso de
 * volta pra `null`. Este arquivo trava as três pontas do contrato:
 *
 * 1. "Ver todos" em Objetivos e o CTA do HeroCard realmente disparam o
 *    pulso, cada um com o valor certo;
 * 2. o pulso é consumido (muda a sub-aba) e depois zerado — não fica preso;
 * 3. depois de consumido, o pulso não interfere numa navegação manual
 *    subsequente da usuária entre as sub-abas do Financeiro.
 */

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

const objetivosCardSrc = read("components/home/ObjetivosCard.tsx");
const heroCardSrc = read("components/home/HeroCard.tsx");
const pageSrc = read("app/page.tsx");
const financeiroTabSrc = read("components/financeiro/FinanceiroTab.tsx");

describe('ObjetivosCard — botão "Ver todos" (estado não-vazio) dispara onGoToMetas', () => {
  it('o botão "Ver todos" usa onClick={onGoToMetas}, não um placeholder', () => {
    expect(objetivosCardSrc).toMatch(
      /onClick=\{onGoToMetas\}[\s\S]{0,400}Ver todos/
    );
  });

  it('o estado vazio ("Adicionar objetivo") também usa onGoToMetas, não um placeholder', () => {
    // Verifica esse caminho especificamente (por proximidade de texto), em
    // vez de contar ocorrências totais de onGoToMetas no arquivo — uma
    // contagem exata quebraria com qualquer uso adicional legítimo (ex.: um
    // novo sub-estado) sem que nenhum caminho obrigatório tivesse regredido.
    expect(objetivosCardSrc).toMatch(
      /onClick=\{onGoToMetas\}[\s\S]{0,400}Adicionar objetivo/
    );
  });
});

describe("app/page.tsx — onGoToMetas dispara o pulso completo (troca de aba + focusTab)", () => {
  it('ObjetivosCard.onGoToMetas troca pra aba "financeiro" E seta financeiroFocusTab("metas") na mesma ação', () => {
    expect(pageSrc).toMatch(
      /<ObjetivosCard[\s\S]*?onGoToMetas=\{\(\) => \{\s*\r?\n\s*handleTabChange\("financeiro"\);\s*\r?\n\s*setFinanceiroFocusTab\("metas"\);\s*\r?\n\s*\}\}/
    );
  });

  it('HeroCard.onGoToFinanceiro (CTA "Ver minha evolução", #134) troca pra aba "financeiro" E seta financeiroFocusTab("visao") na mesma ação', () => {
    expect(pageSrc).toMatch(
      /<HeroCard[\s\S]*?onGoToFinanceiro=\{\(\) => \{\s*\r?\n\s*handleTabChange\("financeiro"\);\s*\r?\n\s*setFinanceiroFocusTab\("visao"\);\s*\r?\n\s*\}\}/
    );
  });

  it('financeiroFocusTab aceita "metas" e "visao", começa null (Financeiro abre em "Visão" por padrão em qualquer outra entrada)', () => {
    expect(pageSrc).toMatch(
      /const \[financeiroFocusTab, setFinanceiroFocusTab\] = useState<\s*\r?\n\s*"metas" \| "visao" \| null\s*\r?\n\s*>\(null\);/
    );
  });

  it("FinanceiroTab recebe focusTab e onFocusTabHandled real, não um handler vazio", () => {
    expect(pageSrc).toMatch(
      /<FinanceiroTab[\s\S]*?focusTab=\{financeiroFocusTab\}[\s\S]*?onFocusTabHandled=\{\(\) => setFinanceiroFocusTab\(null\)\}/
    );
  });
});

describe('HeroCard — botão "Ver minha evolução" (CTA aprovado, #134) dispara onGoToFinanceiro', () => {
  it("o CTA de largura total usa onClick={onGoToFinanceiro}, não um placeholder", () => {
    expect(heroCardSrc).toMatch(
      /onClick=\{onGoToFinanceiro\}[\s\S]{0,400}Ver minha evolução/
    );
  });

  it("o GlassCard do card-herói não é mais clicável (evita <button> aninhado dentro do <button> do CTA) — só o CTA explícito navega", () => {
    expect(heroCardSrc).not.toMatch(
      /<GlassCard[^>]*onClick=\{onGoToFinanceiro\}/
    );
  });

  it("cor do CTA é temática (var(--accent)), nunca o rosa fixo do protótipo (#ff2d78, decisão da Fase 1/#124)", () => {
    // Âncora no <button ... real (com onClick), não nos <button> soltos que
    // aparecem dentro do comentário JSDoc acima dele no arquivo.
    const ctaMatch = heroCardSrc.match(
      /<button\s+onClick=\{onGoToFinanceiro\}[\s\S]*?<\/button>/
    );
    expect(ctaMatch).not.toBeNull();
    expect(ctaMatch![0]).toMatch(/background:\s*"var\(--accent\)"/);
    expect(ctaMatch![0]).not.toMatch(/#ff2d78|#ff376e/i);
  });
});

describe("FinanceiroTab — o pulso é consumido corretamente e não fica preso", () => {
  it("o efeito ignora focusTab vazio/null (guard-clause, não navega sem pulso real)", () => {
    expect(financeiroTabSrc).toMatch(/if \(!focusTab\) return;/);
  });

  it("consumir o pulso muda a sub-aba ativa via changeTab (mesmo caminho de navegação manual, sem lógica duplicada)", () => {
    expect(financeiroTabSrc).toMatch(
      /if \(!focusTab\) return;\s*\r?\n\s*changeTab\(focusTab\);/
    );
  });

  it("depois de navegar, o componente avisa o pai pra zerar o pulso (onFocusTabHandled) — sem isso o pulso reafirmaria a cada render", () => {
    expect(financeiroTabSrc).toMatch(
      /changeTab\(focusTab\);\s*\r?\n\s*onFocusTabHandled\?\.\(\);/
    );
  });

  it("o efeito depende só de [focusTab] — não de onFocusTabHandled/changeTab — então não reexecuta a cada render nem perde o pulso por closure velha", () => {
    expect(financeiroTabSrc).toMatch(
      /onFocusTabHandled\?\.\(\);\s*\r?\n\s*\/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\s*\r?\n\s*\}, \[focusTab\]\);/
    );
  });
});

describe("FinanceiroTab — depois de consumido, o pulso não interfere em navegação manual posterior", () => {
  it("a SegmentedControl das sub-abas muda de aba direto via changeTab, sem passar pelo estado do pulso (focusTab)", () => {
    expect(financeiroTabSrc).toMatch(/onChange=\{changeTab\}/);
  });

  it("changeTab não toca em focusTab — clique manual da usuária não reaciona nem é bloqueado pelo pulso já consumido", () => {
    const changeTabMatch = financeiroTabSrc.match(
      /function changeTab\(t: InnerTab\) \{[\s\S]*?\n {2}\}/
    );
    expect(changeTabMatch).not.toBeNull();
    expect(changeTabMatch![0]).not.toMatch(/focusTab/);
  });

  it('a aba interna nasce em "visao" — uma 2ª visita sem pulso (focusTab null/undefined) não abre em Metas por padrão', () => {
    // Checar só a assinatura `focusTab?: InnerTab | null` não garante nada
    // sobre comportamento (um tipo opcional não impede um default errado).
    // A garantia real é dupla: o guard-clause acima ("se não focusTab,
    // return") já trava que o efeito não navega sem pulso; esta trava que o
    // estado inicial da aba é "visao", não "metas" — as duas juntas provam
    // que sem pulso a usuária nunca acaba em Metas involuntariamente.
    expect(financeiroTabSrc).toMatch(/useState<InnerTab>\("visao"\)/);
  });
});
