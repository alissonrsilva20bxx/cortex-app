import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Issue #53 / T12 rodada corretiva (PR #63) — "Bloquear" no menu de Amigas
 * executava direto (`onSelect: () => { if (menuUser) onBlock(menuUser.id); }`),
 * sem segunda confirmação, diferente do mesmo fluxo já corrigido em
 * PerfilPublicoScreen.tsx e no menu do chat (T9/#36). Bloqueio é irreversível
 * pela UI, então um toque acidental bloqueava permanentemente. Mesmo padrão
 * de inspeção de código-fonte já usado em rede-gap-visual.test.ts (projeto
 * não tem Testing Library/Playwright).
 */

const src = readFileSync(
  join(__dirname, "..", "..", "components", "rede", "AmigasScreen.tsx"),
  "utf-8"
);

describe("#53 — confirmação antes de bloquear no menu de Amigas", () => {
  it("o item 'Bloquear' do primeiro sheet NÃO chama onBlock diretamente", () => {
    // Antes da correção, este seria o comportamento (vermelho): o segundo
    // trecho abaixo não existia e "bloquear" chamava onBlock no primeiro sheet.
    const bloquearItemMatch = src.match(
      /key: "bloquear",[\s\S]*?onSelect: \(\) => \{([\s\S]*?)\},\s*\},/
    );
    expect(bloquearItemMatch).not.toBeNull();
    expect(bloquearItemMatch![1]).not.toMatch(/onBlock\(/);
    expect(bloquearItemMatch![1]).toMatch(/setBlockConfirmUser\(menuUser\)/);
  });

  it("existe um segundo OptionsSheet de confirmação com título 'Bloquear {nome}?'", () => {
    expect(src).toMatch(
      /title=\{`Bloquear \$\{blockConfirmUser\?\.nome \?\? ""\}\?`\}/
    );
  });

  it("a confirmação oferece 'Sim, bloquear' (chama onBlock) e 'Cancelar' (não chama)", () => {
    const confirmSheetMatch = src.match(
      /open=\{!!blockConfirmUser\}[\s\S]*?options=\{\[([\s\S]*?)\]\}\s*\/>/
    );
    expect(confirmSheetMatch).not.toBeNull();
    const body = confirmSheetMatch![1];
    expect(body).toMatch(/label: "Sim, bloquear"/);
    expect(body).toMatch(/onBlock\(blockConfirmUser\.id\)/);
    expect(body).toMatch(/label: "Cancelar"/);
  });

  it("o bloqueio real (onBlock) só é referenciado dentro do sheet de confirmação, nunca no menu principal", () => {
    const onBlockOccurrences = [...src.matchAll(/onBlock\(/g)].length;
    expect(onBlockOccurrences).toBe(1);
  });
});
