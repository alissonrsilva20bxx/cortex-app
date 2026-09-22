import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regressão — pulso de navegação Início (Objetivos "Ver todos") → Financeiro
 * → sub-aba Metas (redesign iOS quase nativo, wayfinder #122, ticket #125).
 * Mesmo padrão de inspeção de código-fonte já usado no projeto (sem DOM).
 *
 * `FinanceiroTab` fica sempre montada (`TabPanel` usa display:none, nunca
 * desmonta — ver TabPanel.tsx), então um valor inicial de `useState` só
 * funcionaria na 1ª visita. A solução é um "pulso": `app/page.tsx` sobe
 * `financeiroFocusTab` pra "metas", `FinanceiroTab` consome (muda de aba +
 * chama `onFocusTabHandled`), e `app/page.tsx` zera o pulso de volta pra
 * `null`. Este arquivo trava as três pontas do contrato:
 *
 * 1. "Ver todos" em Objetivos realmente dispara o pulso;
 * 2. o pulso é consumido (muda a sub-aba) e depois zerado — não fica preso;
 * 3. depois de consumido, o pulso não interfere numa navegação manual
 *    subsequente da usuária entre as sub-abas do Financeiro.
 */

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

const objetivosCardSrc = read("components/home/ObjetivosCard.tsx");
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

  it('financeiroFocusTab começa null (Financeiro abre em "Visão" por padrão em qualquer outra entrada)', () => {
    expect(pageSrc).toMatch(
      /const \[financeiroFocusTab, setFinanceiroFocusTab\] = useState<"metas" \| null>\(\s*\r?\n?\s*null\s*\r?\n?\s*\);/
    );
  });

  it("FinanceiroTab recebe focusTab e onFocusTabHandled real, não um handler vazio", () => {
    expect(pageSrc).toMatch(
      /<FinanceiroTab[\s\S]*?focusTab=\{financeiroFocusTab\}[\s\S]*?onFocusTabHandled=\{\(\) => setFinanceiroFocusTab\(null\)\}/
    );
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
