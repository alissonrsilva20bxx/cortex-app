import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T6 follow-up — bug report: after "Quero participar da beta" fails, "a
 * entrada para o código de acesso não abre". Traced the real contract:
 * RedeTeaserGate's "chave" button was already wired independently of
 * handleQueroParticipar (confirmed by curl against the live dev server —
 * the actual failure was middleware redirecting the Gate's fetches to
 * /login in /dev-preview/app, not a coupling bug here). This test locks
 * that independence in as a contract so it can't regress silently: a
 * failed beta request must never disable or gate the code-entry action.
 */

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

describe("RedeTeaserGate — code-entry action is independent of the beta-request flow", () => {
  const src = read("components/rede/RedeTeaserGate.tsx");

  function extractFunctionBody(fnName: string): string {
    const start = src.indexOf(`function ${fnName}(`);
    expect(start).toBeGreaterThan(-1);
    let depth = 0;
    let bodyStart = -1;
    for (let i = start; i < src.length; i++) {
      if (src[i] === "{") {
        if (depth === 0) bodyStart = i;
        depth++;
      } else if (src[i] === "}") {
        depth--;
        if (depth === 0) return src.slice(bodyStart, i + 1);
      }
    }
    throw new Error(`Could not find end of function ${fnName}`);
  }

  it("handleQueroParticipar never references the 'chave' sheet, on success or failure", () => {
    const body = extractFunctionBody("handleQueroParticipar");
    expect(body).not.toContain("chave");
  });

  it("the code-entry button has its own unconditional onClick, not derived from solicitando state", () => {
    const btnIdx = src.indexOf("Já tem um código de convite?");
    expect(btnIdx).toBeGreaterThan(-1);
    const tagStart = src.lastIndexOf("<button", btnIdx);
    const tag = src.slice(tagStart, btnIdx);

    expect(tag).toContain('onClick={() => onSheetChange("chave")}');
    expect(tag).not.toContain("disabled");
    expect(tag).not.toContain("solicitando");
  });

  it("the primary CTA's disabled prop only reflects its own request state, never gates the code-entry button", () => {
    const ctaIdx = src.indexOf("Quero participar da beta");
    const tagStart = src.lastIndexOf("<button", ctaIdx);
    const tag = src.slice(tagStart, ctaIdx);
    expect(tag).toContain("disabled={solicitando}");
  });
});
