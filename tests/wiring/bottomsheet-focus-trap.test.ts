import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getFocusCycleTarget } from "../../components/ui/focusTrap";

/**
 * T6 (Rede — Gate) achado P1-3: `BottomSheet.tsx` (compartilhado, ~18
 * consumidores) não tinha focus trap, `role="dialog"`/`aria-modal`,
 * fechar com Esc nem restauração de foco — o laboratório
 * (`NetworkGateScreen.tsx:80-116`) já resolvia as quatro coisas. Corrigido
 * na causa-raiz, não só nos sheets do gate da Rede.
 *
 * `getFocusCycleTarget` é a lógica de ciclo do Tab extraída como função
 * pura testável (mesmo padrão de `components/cofre/lockGate.ts` do T5) —
 * sem precisar de jsdom/RTL (que este projeto não tem) pra verificar o
 * comportamento de verdade, não só a forma do código fonte.
 */

describe("getFocusCycleTarget — lógica pura do ciclo de Tab dentro do sheet", () => {
  it("Shift+Tab no primeiro item vai pro último (wrap pra trás)", () => {
    expect(getFocusCycleTarget(["a", "b", "c"], "a", true)).toBe("c");
  });

  it("Tab no último item vai pro primeiro (wrap pra frente)", () => {
    expect(getFocusCycleTarget(["a", "b", "c"], "c", false)).toBe("a");
  });

  it("Tab/Shift+Tab num item do meio não intervém (deixa o navegador decidir)", () => {
    expect(getFocusCycleTarget(["a", "b", "c"], "b", false)).toBeNull();
    expect(getFocusCycleTarget(["a", "b", "c"], "b", true)).toBeNull();
  });

  it("elemento ativo fora da lista (foco saiu do sheet por algum motivo) não intervém", () => {
    expect(getFocusCycleTarget(["a", "b", "c"], "z", false)).toBeNull();
    expect(getFocusCycleTarget(["a", "b", "c"], null, false)).toBeNull();
  });

  it("lista vazia (sheet sem nenhum elemento focável ainda) nunca intervém", () => {
    expect(getFocusCycleTarget([], "a", false)).toBeNull();
  });

  it("lista de um único item cicla pra si mesmo nas duas direções", () => {
    expect(getFocusCycleTarget(["a"], "a", true)).toBe("a");
    expect(getFocusCycleTarget(["a"], "a", false)).toBe("a");
  });
});

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

describe("BottomSheet.tsx implements the real focus trap (not just the pure helper)", () => {
  const src = read("components/ui/BottomSheet.tsx");

  it("uses getFocusCycleTarget from the tested pure module, no inline reimplementation of the wrap logic", () => {
    expect(src).toMatch(
      /import\s*{\s*getFocusCycleTarget\s*}\s*from\s*"\.\/focusTrap"/
    );
  });

  it("marks the panel as an accessible dialog (role + aria-modal)", () => {
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
  });

  it("closes on Escape via the same onClose prop every consumer already provides", () => {
    expect(src).toMatch(/event\.key === "Escape"/);
  });

  it("restores focus to the element that was focused before the sheet opened", () => {
    expect(src).toMatch(/previousFocus/);
    expect(src).toMatch(/previousFocus\??\.focus\(\)/);
  });

  it("only traps focus while the sheet is actually open (gated on the `open` prop)", () => {
    expect(src).toMatch(/useEffect\(\(\) => \{\s*\r?\n\s*if \(!open\) return;/);
  });

  it("cleans up the keydown listener on close/unmount (no leak)", () => {
    expect(src).toContain('removeEventListener("keydown"');
  });
});

describe("Rede's 3 gate sheets meet the 44px close-button target (P1-1)", () => {
  it("RedeTeaserGate's confirmação and preview sheets both pass largeCloseTarget", () => {
    const src = read("components/rede/RedeTeaserGate.tsx");
    const sheetBlocks = src.split("<BottomSheet").slice(1);
    expect(sheetBlocks.length).toBe(2);
    for (const block of sheetBlocks) {
      expect(block.slice(0, 200)).toMatch(/largeCloseTarget/);
    }
  });

  it("SerialKeySheet's internal BottomSheet passes largeCloseTarget", () => {
    const src = read("components/rede/SerialKeySheet.tsx");
    expect(src).toMatch(/<BottomSheet[\s\S]*?largeCloseTarget/);
  });
});

describe("'Já tem um código de convite?' button meets the 44px target (P1-2)", () => {
  it("RedeTeaserGate's code-entry link button has an explicit 44px minimum height", () => {
    const src = read("components/rede/RedeTeaserGate.tsx");
    const btnIdx = src.indexOf("Já tem um código de convite?");
    expect(btnIdx).toBeGreaterThan(-1);
    const nearby = src.slice(Math.max(0, btnIdx - 400), btnIdx);
    expect(nearby).toMatch(/minHeight:\s*"44px"/);
  });
});

describe("The real gate keeps using the real services — nothing swapped for the lab's demo logic", () => {
  it("SerialKeySheet still calls the real /api/rede/convites resgatar route, never a local/hardcoded comparison", () => {
    const src = read("components/rede/SerialKeySheet.tsx");
    expect(src).toContain('fetch("/api/rede/convites"');
    expect(src).toContain('acao: "resgatar"');
    expect(src).not.toMatch(/DEMO_ACCESS_CODE|REDE-BETA-DEMO/);
  });

  it("RedeGatedTab still uses verificarAcessoConvite (the real DB-backed source of truth), not a client-only flag", () => {
    const src = read("components/rede/RedeGatedTab.tsx");
    expect(src).toMatch(
      /import\s*{[^}]*\bverificarAcessoConvite\b[^}]*}\s*from\s*"@\/lib\/rede\/acesso"/
    );
    expect(src).toContain("verificarAcessoConvite(supabase, usuario.id)");
  });

  it("RedeTeaserGate still calls the real /api/rede/solicitar-beta route for the primary CTA", () => {
    const src = read("components/rede/RedeTeaserGate.tsx");
    expect(src).toContain('fetch("/api/rede/solicitar-beta"');
  });

  it("no fabricated/placeholder pricing, badge copy, or card content was changed (preserved exactly, pending product decision per the audit)", () => {
    const src = read("components/rede/RedeTeaserGate.tsx");
    expect(src).toContain("Plano previsto: R$ 49,90/mês");
    expect(src).toContain("Em breve");
  });
});
