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

  it("cada aba lembra a própria rolagem: repõe a posição salva da chave nova (topo se nunca visitada)", () => {
    expect(resetEffect).toMatch(
      /const saved = positionsRef\.current\.get\(resetKey\) \?\? 0/
    );
    expect(resetEffect).toMatch(/window\.scrollTo\(\{ top: saved/);
  });

  it("repõe a rolagem de forma instantânea, não animada", () => {
    // Troca de aba não é o tipo de rolagem que anima — sem behavior
    // "instant" explícito, qualquer scroll-behavior: smooth herdado (CSS
    // de terceiros, preferência futura) animaria a correção.
    expect(resetEffect).toMatch(/behavior:\s*["']instant["']/);
  });

  it("passa a gravar posições sob a chave nova assim que ela vira ativa", () => {
    expect(resetEffect).toMatch(/keyRef\.current = resetKey/);
  });
});

describe("useScrollCompact — grava a rolagem da aba ativa a cada evento", () => {
  it("grava a posição do window ANTES do throttle por frame (a última posição nunca se perde)", () => {
    const body = extractHandleScrollBody(src);
    const saveIndex = body.indexOf(
      "positionsRef.current.set(keyRef.current, scrollTop)"
    );
    const throttleIndex = body.indexOf("if (frame !== null) return");
    expect(saveIndex).toBeGreaterThan(-1);
    expect(throttleIndex).toBeGreaterThan(-1);
    expect(saveIndex).toBeLessThan(throttleIndex);
  });

  it("só grava rolagem do window/document — lista interna rola por conta própria", () => {
    const body = extractHandleScrollBody(src);
    expect(body).toMatch(
      /if \(e\.target === window \|\| e\.target === document\) \{\s*positionsRef/
    );
  });
});
