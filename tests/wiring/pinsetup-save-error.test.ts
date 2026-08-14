import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T12 rodada corretiva (PR #63) — `PinSetup.tsx:66-75` (`savePin`) nunca
 * verificava o `{error}` retornado pelo `upsert` do Supabase: se a
 * gravação do PIN falhasse, o fluxo seguia como sucesso (`onSaved` +
 * fechamento do sheet) e a usuária acreditava ter uma proteção ativa que
 * não existia. Mesmo padrão de inspeção de código-fonte já usado em
 * rede-gap-visual.test.ts (projeto não tem Testing Library/Playwright;
 * ambiente do vitest é "node", sem DOM).
 */

const src = readFileSync(
  join(__dirname, "..", "..", "components", "pin", "PinSetup.tsx"),
  "utf-8"
);

function extractSavePinBody(source: string): string {
  const match = source.match(
    /async function savePin\(pin: string\) \{([\s\S]*?)\n  \}/
  );
  if (!match) throw new Error("savePin não encontrado em PinSetup.tsx");
  return match[1];
}

describe("PinSetup — falha ao salvar o PIN não é mais silenciosa", () => {
  const body = extractSavePinBody(src);

  it("captura o {error} retornado pelo upsert (não ignora o resultado)", () => {
    expect(body).toMatch(/const \{ error: \w+ \}\s*=\s*await supabase/);
  });

  it("exibe uma mensagem de erro clara quando o upsert falha", () => {
    const errorBranch = body.match(/if \(\w*[Ee]rror\) \{([\s\S]*?)\n {4}\}/);
    expect(errorBranch).not.toBeNull();
    expect(errorBranch![1]).toMatch(/setError\(\s*"[^"]+"\s*\)/);
  });

  it("preserva o estado (não fecha o sheet nem chama onSaved) quando o upsert falha", () => {
    const errorBranch = body.match(/if \(\w*[Ee]rror\) \{([\s\S]*?)\n {4}\}/);
    expect(errorBranch).not.toBeNull();
    expect(errorBranch![1]).not.toMatch(/onSaved\(/);
    expect(errorBranch![1]).not.toMatch(/handleClose\(/);
  });

  it("só chama onSaved + handleClose fora do branch de erro (caminho de sucesso)", () => {
    const successTail = body.slice(body.lastIndexOf("}") + 1);
    expect(successTail).toMatch(/onSaved\(h\);/);
    expect(successTail).toMatch(/handleClose\(\);/);
  });
});
