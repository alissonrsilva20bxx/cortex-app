import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T14/#67 — trocar de aba com a pílula compacta reexpandia a BottomNav
 * (via reset de compact/baseline em `resetKey`), mas nunca repunha a
 * posição real de scroll. Confirmado via Playwright que `main` nunca é o
 * elemento que de fato rola (fica num container só `min-h-screen`, então
 * quem rola é o document/window) — a aba nova podia abrir no meio do
 * conteúdo enquanto a pílula já "dizia" estar no topo. Ambiente do
 * vitest é "node" (sem DOM/React), então segue o mesmo padrão de
 * inspeção de código-fonte já usado em pinsetup-save-error.test.ts.
 */

const src = readFileSync(
  join(__dirname, "..", "..", "lib", "useScrollCompact.ts"),
  "utf-8"
);

function extractResetEffectBody(source: string): string {
  const match = source.match(
    /useEffect\(\(\) => \{\s*stateRef\.current[\s\S]*?\}, \[resetKey\]\);/
  );
  if (!match) throw new Error("efeito de reset (resetKey) não encontrado");
  return match[0];
}

function extractHandleScrollBody(source: string): string {
  const match = source.match(
    /function handleScroll\(e: Event\) \{([\s\S]*?)\n {4}\}/
  );
  if (!match) throw new Error("handleScroll não encontrado");
  return match[1];
}

describe("useScrollCompact — reset de aba também repõe a posição real de scroll", () => {
  const resetEffect = extractResetEffectBody(src);

  it("continua zerando compact + baseline (comportamento original preservado)", () => {
    expect(resetEffect).toMatch(
      /stateRef\.current = INITIAL_SCROLL_COMPACT_STATE/
    );
    expect(resetEffect).toMatch(/setCompact\(false\)/);
  });

  it("não repõe scroll no mount inicial — só há 'aba anterior' a corrigir depois da primeira troca", () => {
    expect(resetEffect).toMatch(/if \(!mountedRef\.current\)/);
    expect(resetEffect).toMatch(/mountedRef\.current = true/);
  });

  it("repõe a window/document pro topo quando esse foi o alvo mais recente conhecido", () => {
    expect(resetEffect).toMatch(/target === window \|\| target === document/);
    expect(resetEffect).toMatch(/window\.scrollTo\(/);
  });

  it("repõe a window/document de forma instantânea, não animada", () => {
    // globals.css liga scroll-behavior: smooth na página inteira — sem
    // behavior: "instant" explícito, o reset de aba herdaria uma rolagem
    // animada em vez de corrigir a posição na hora.
    expect(resetEffect).toMatch(/behavior:\s*["']instant["']/);
  });

  it("repõe o scrollTop de um elemento próprio (ex.: lista da Rede) quando é o alvo conhecido", () => {
    expect(resetEffect).toMatch(/target instanceof HTMLElement/);
    expect(resetEffect).toMatch(/target\.scrollTop = 0/);
  });
});

describe("useScrollCompact — rastreia o alvo real do scroll a cada evento", () => {
  it("guarda e.target em scrollTargetRef antes de agendar o frame (pro reset saber o que corrigir)", () => {
    const body = extractHandleScrollBody(src);
    const targetAssignIndex = body.indexOf(
      "scrollTargetRef.current = e.target"
    );
    const frameScheduleIndex = body.indexOf("frame = requestAnimationFrame");
    expect(targetAssignIndex).toBeGreaterThan(-1);
    expect(frameScheduleIndex).toBeGreaterThan(-1);
    expect(targetAssignIndex).toBeLessThan(frameScheduleIndex);
  });
});
