import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Teste de fiação (não de renderização), mesmo padrão de
 * `tests/wiring/inicio-visual.test.ts` (T2), `agenda-visual.test.ts`
 * (T3) e `financeiro-visual.test.ts` (T4): confirma, a partir do código
 * fonte, que `/dev-preview/app` realmente importa e renderiza o
 * `CofreTab`/`UploadSheet` reais (não uma cópia/mock), que os dados e
 * ações reais do Cofre (T5/#32) continuam intactos, que nenhum número
 * fabricado do laboratório foi copiado, e que a proteção de privacidade
 * ao perder foco está de fato fiada (não só documentada em comentário).
 *
 * Não usa Vitest+RTL: este projeto não tem `@testing-library/react` nem
 * um plugin de JSX no `vitest.config.ts`. Ler o arquivo como texto pega
 * o mesmo tipo de bug que os relatórios anteriores mostraram (import
 * antigo, dado fabricado copiado do mock, alvo de toque não corrigido).
 */

const ROOT = join(__dirname, "..", "..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

describe("/dev-preview/app renders the T5 Cofre components", () => {
  const page = read("app/dev-preview/app/page.tsx");

  it("imports CofreTab from the real component path, not a duplicate/mock", () => {
    expect(page).toMatch(
      /import\s*{[^}]*\bCofreTab\b[^}]*}\s*from\s*"@\/components\/cofre\/CofreTab"/
    );
  });

  it("imports UploadSheet from the real component path, not a duplicate/mock", () => {
    expect(page).toMatch(
      /import\s*{[^}]*\bUploadSheet\b[^}]*}\s*from\s*"@\/components\/cofre\/UploadSheet"/
    );
  });

  it("actually renders <CofreTab and <UploadSheet in the JSX", () => {
    expect(page).toContain("<CofreTab");
    expect(page).toContain("<UploadSheet");
  });

  it("does not import a second/alternate copy of CofreTab from elsewhere", () => {
    const importLines = page.split("\n").filter((l) => /^\s*import\b/.test(l));
    const matches = importLines.filter((l) => /\bCofreTab\b/.test(l));
    expect(matches).toHaveLength(1);
  });
});

describe("CofreTab.tsx preserves the real Supabase Storage contract", () => {
  const src = read("components/cofre/CofreTab.tsx");

  it("still lists files per category from supabase.storage, not a static dataset", () => {
    expect(src).toContain('supabase.storage');
    expect(src).toContain('.from("cofre")');
    expect(src).toContain(".list(`${userId}/${cat}`");
  });

  it("still opens files via a 120s signed URL, never a public/direct link", () => {
    expect(src).toContain('.createSignedUrl(path, 120)');
  });

  it("keeps the real userId/refreshTrigger prop contract", () => {
    expect(src).toContain("userId: string");
    expect(src).toContain("refreshTrigger: number");
  });

  it("keeps the 4 real categories as a closed enum, no invented category", () => {
    for (const cat of ["comprovantes", "conversas", "documentos", "pessoal"]) {
      expect(src).toContain(cat);
    }
  });

  it("does not add a delete/remove capability that has no real backend behind it", () => {
    expect(src).not.toMatch(/\.remove\(/);
    expect(src).not.toMatch(/deleteFile|removeFile/);
  });
});

describe("CofreTab.tsx never copies the lab's fabricated storage numbers", () => {
  const src = read("components/cofre/CofreTab.tsx");

  it("does not contain any of the lab's fabricated VaultScreen values", () => {
    for (const fabricated of [
      "248",
      "6,8 GB",
      "arquivos simulados",
      "estimativa visual",
      "· prévia",
      "34%",
    ]) {
      expect(src).not.toContain(fabricated);
    }
  });

  it("does not render any progress bar / usage percentage (no real storage quota exists)", () => {
    expect(src).not.toMatch(/value=\{?34\}?/);
    expect(src).not.toMatch(/\d+%\s*(de uso|usado|da cota)/i);
  });

  it("computes file count and total bytes from the real fetched `files` array", () => {
    expect(src).toContain("files.length");
    expect(src).toContain("files.reduce((sum, f) => sum + f.size, 0)");
    expect(src).toContain("formatSize(totalBytes)");
  });

  it("does not use .section-label (eyebrow-caps root cause fixed in T2)", () => {
    expect(src).not.toMatch(/className=["'{].*section-label/);
  });

  it("does not use any hardcoded text-white/NN opacity color (root cause found again in the T5 report)", () => {
    expect(src).not.toMatch(/text-white\/\d/);
  });
});

describe("CofreTab.tsx implements the privacy-on-background cover", () => {
  const src = read("components/cofre/CofreTab.tsx");

  it("reacts to visibilitychange, pagehide and blur to cover sensitive content", () => {
    expect(src).toContain('addEventListener("visibilitychange"');
    expect(src).toContain('addEventListener("pagehide"');
    expect(src).toContain('addEventListener("blur"');
  });

  it("uncovers on focus/visible return, without inventing a stricter lock than app/page.tsx", () => {
    expect(src).toContain('addEventListener("focus"');
    expect(src).toContain('document.visibilityState === "hidden"');
  });

  it("cleans up every listener it adds (no leak, no runaway loop)", () => {
    for (const evt of ["visibilitychange", "pagehide", "blur", "focus"]) {
      expect(src).toContain(`removeEventListener("${evt}"`);
    }
  });

  it("renders an opaque, full-viewport cover when privacyCover is active", () => {
    expect(src).toMatch(/privacyCover\s*&&/);
    expect(src).toContain("fixed inset-0");
  });

  it("does not call any biometric/WebAuthn API (none implemented yet, web or native — prose explaining that absence is fine, an actual call is not)", () => {
    expect(src).not.toMatch(
      /navigator\.credentials|webauthn\(|LocalAuthentication\(|BiometricPrompt|TouchID\.|FaceID\./i
    );
  });

  it("does not render any Face ID / Touch ID icon or button in the JSX (no promising a sensor that isn't there)", () => {
    const jsxOnly = src
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    expect(jsxOnly).not.toMatch(/Face ?ID|Touch ?ID/i);
  });

  it("documents native biometrics as a future iOS-app integration, not implemented today", () => {
    expect(src).toMatch(/integração futura do aplicativo iOS/);
  });
});

describe("CofreTab.tsx and UploadSheet.tsx meet the 44px touch-target findings (P1-5, P1-6)", () => {
  it("CofreTab passes minTouchTarget to the shared FilterChips", () => {
    const src = read("components/cofre/CofreTab.tsx");
    expect(src).toMatch(/<FilterChips[\s\S]*?minTouchTarget/);
  });

  it("UploadSheet passes minTouchTarget to the shared FilterChips and largeCloseTarget to BottomSheet", () => {
    const src = read("components/cofre/UploadSheet.tsx");
    expect(src).toMatch(/<FilterChips[\s\S]*?minTouchTarget/);
    expect(src).toMatch(/<BottomSheet[\s\S]*?largeCloseTarget/);
  });

  it("CofreTab file rows declare an explicit 44px minHeight", () => {
    const src = read("components/cofre/CofreTab.tsx");
    expect(src).toContain('minHeight: "44px"');
  });
});

describe("Shared FilterChips/BottomSheet touch-target fixes are opt-in, not a default-behavior change", () => {
  it("FilterChips defaults minTouchTarget to false, preserving Rede's existing ~28px chips", () => {
    const src = read("components/ui/FilterChips.tsx");
    expect(src).toContain("minTouchTarget = false");
  });

  it("BottomSheet defaults largeCloseTarget to false, preserving the other 18 consumers' close button", () => {
    const src = read("components/ui/BottomSheet.tsx");
    expect(src).toContain("largeCloseTarget = false");
  });

  it("Rede's FilterChips consumers do not opt into minTouchTarget (out of this ticket's scope)", () => {
    for (const file of [
      "components/rede/ClientesScreen.tsx",
      "components/rede/PostComposer.tsx",
      "components/rede/WishlistScreen.tsx",
    ]) {
      expect(read(file)).not.toMatch(/<FilterChips[\s\S]*?minTouchTarget/);
    }
  });
});

describe("CofreTab.tsx honest empty/loading states", () => {
  const src = read("components/cofre/CofreTab.tsx");

  it("still shows the real empty-vault message", () => {
    expect(src).toContain("Cofre vazio. Toque no + para enviar.");
  });

  it("still shows a category-specific empty message", () => {
    expect(src).toContain('Nenhum arquivo em "');
  });

  it("shows a distinct message when a search query matches nothing", () => {
    expect(src).toContain("Nenhum arquivo encontrado para");
  });

  it("filters files client-side by name, without a new network call per keystroke", () => {
    expect(src).toContain("f.name.toLowerCase().includes(query.trim().toLowerCase())");
  });
});

describe("UploadSheet.tsx keeps the real upload contract", () => {
  const src = read("components/cofre/UploadSheet.tsx");

  it("still uploads to supabase.storage with the real path shape", () => {
    expect(src).toContain('.from("cofre")');
    expect(src).toContain(".upload(path, file, { contentType: file.type })");
    expect(src).toContain("`${userId}/${categoria}/${Date.now()}.${ext}`");
  });

  it("still surfaces the real Supabase error message, not a generic one", () => {
    expect(src).toContain("setError(err.message)");
  });

  it("keeps the real open/userId/onClose/onUploaded prop contract", () => {
    expect(src).toContain("open: boolean");
    expect(src).toContain("userId: string");
    expect(src).toContain("onClose: () => void");
    expect(src).toContain("onUploaded: () => void");
  });
});

describe("FAB copy for the Cofre tab reflects the real UploadSheet capability (P2-7)", () => {
  it("no longer promises 'Foto'/'imagem' in the cofre action's label/description strings", () => {
    const src = read("components/FAB.tsx");
    const cofreBlock = src.slice(src.indexOf("cofre:"), src.indexOf("cofre:") + 300);
    const stringValues = [...cofreBlock.matchAll(/(?:label|description):\s*"([^"]*)"/g)].map(
      (m) => m[1]
    );
    expect(stringValues.length).toBeGreaterThan(0);
    for (const value of stringValues) {
      expect(value).not.toMatch(/Foto|imagem/i);
    }
  });
});
