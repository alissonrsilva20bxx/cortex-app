import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Achado 2026-09-04, reproduzido só no build de produção da Vercel (nunca
 * no `next dev`, que não sofre desse tipo de colisão): `PinScreen.tsx`
 * combina a classe do CSS Module (`styles.page`) com as classes utilitárias
 * do Tailwind `fixed inset-0 z-[100]` no mesmo elemento raiz. O CSS Module
 * também declarava `position: relative` em `.page` -- mesma especificidade
 * de `.fixed` (uma classe cada), e no bundle de produção o stylesheet do
 * módulo carrega DEPOIS do stylesheet global do Tailwind, então
 * `position: relative` vencia o empate e `getComputedStyle()` retornava
 * "relative", não "fixed". Inofensivo quando `PinScreen` é o único
 * conteúdo do container (trava do app), mas quebra por completo a trava do
 * Cofre (montada via portal com bastante conteúdo antes dela no DOM): o
 * elemento passa a ocupar o fluxo normal do documento e é empurrado pra
 * fora da área visível, deixando a tela em branco (só a BottomNav/FAB,
 * que são `fixed` de verdade via outras classes, continuam visíveis).
 *
 * Este teste não pega colisões de CSS compilado (isso exige um build real
 * -- ver `docs/beta/SMOKE_TEST_CHECKLIST.md`), mas trava as duas metades
 * do contrato que causaram o bug: o elemento raiz continua pedindo
 * `fixed inset-0` via Tailwind, e o CSS Module não volta a declarar uma
 * `position` própria que possa empatar (e, dependendo da ordem dos
 * stylesheets, vencer) com essa classe utilitária.
 */

const tsxSrc = readFileSync(
  join(__dirname, "..", "..", "components", "pin", "PinScreen.tsx"),
  "utf-8"
);
const cssSrc = readFileSync(
  join(__dirname, "..", "..", "components", "pin", "PinScreen.module.css"),
  "utf-8"
);

function extractRule(source: string, selector: string): string {
  const match = source.match(
    new RegExp(
      `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\n\\}`
    )
  );
  if (!match) throw new Error(`Regra ${selector} não encontrada`);
  return match[1];
}

describe("PinScreen — trava (app e Cofre) permanece fixed no build de produção", () => {
  it("o elemento raiz continua usando as classes fixed/inset-0/z-[100] do Tailwind", () => {
    expect(tsxSrc).toMatch(
      /className=\{`\$\{styles\.page\} fixed inset-0 z-\[100\]`\}/
    );
  });

  it("o CSS Module (.page) não declara uma propriedade `position` conflitante", () => {
    const pageRule = extractRule(cssSrc, ".page");
    expect(pageRule).not.toMatch(/(?<![-\w])position\s*:/);
  });
});
