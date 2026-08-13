import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T11 (issue #38) — itens P0/P1 da Seção 7 (Ajustes) do checklist de
 * paridade funcional. `AjustesTab.tsx` foi inteiramente reescrito em T10
 * (PR #59); nenhum teste automatizado existia para ele antes deste ticket.
 *
 * IDs: §7-P0-1 .. §7-P0-3, §7-P1-1 .. §7-P1-4.
 */

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

const src = read("components/ajustes/AjustesTab.tsx");

describe("§7-P0-1 — Tema usa o mesmo hook/contexto (useTheme()) do resto do app", () => {
  it("importa useTheme de ThemeProvider, não reimplementa lógica de tema local", () => {
    expect(src).toMatch(
      /import\s*\{\s*useTheme\s*\}\s*from\s*"@\/components\/ThemeProvider"/
    );
    expect(src).toMatch(
      /const \{ theme, setTheme, mode, setMode \} = useTheme\(\);/
    );
  });
});

describe("§7-P0-2 — PIN (ativar/desativar/PinSetup) é real", () => {
  it("monta o PinSetup real (não um PreviewFlow decorativo)", () => {
    expect(src).toMatch(
      /import\s*\{\s*PinSetup\s*\}\s*from\s*"@\/components\/pin\/PinSetup"/
    );
    expect(src).toMatch(/<PinSetup/);
  });

  it("desativar PIN chama uma função async dedicada (handleDisablePin), não um estado local decorativo", () => {
    expect(src).toMatch(/async function handleDisablePin\(\) \{/);
  });

  it("o item de PIN alterna entre handleDisablePin e abrir o PinSetup real conforme o estado atual", () => {
    expect(src).toMatch(
      /pinEnabled \? handleDisablePin : \(\) => setPinSetupOpen\(true\)/
    );
  });
});

describe("§7-P0-3 — Sair da conta chama supabase.auth.signOut() real (via prop onSignOut)", () => {
  it("recebe onSignOut como prop obrigatória (não implementa um handler decorativo local)", () => {
    expect(src).toMatch(/onSignOut: \(\) => void;/);
  });

  it("o botão de sair está diretamente ligado a onSignOut", () => {
    expect(src).toMatch(/onClick=\{onSignOut\}/);
  });
});

describe("§7-P1-1 — homeCards/chartPrefs gravam em localStorage e propagam via prop", () => {
  it("lê homeCards/chartPrefs do localStorage no mount", () => {
    expect(src).toMatch(/localStorage\.getItem\("jobapp-home-cards"\)/);
    expect(src).toMatch(/localStorage\.getItem\("jobapp-chart-prefs"\)/);
  });

  it("toda alteração persiste de volta no localStorage (não fica só em estado local do componente)", () => {
    expect(src).toMatch(
      /localStorage\.setItem\("jobapp-home-cards", JSON\.stringify\(next\)\)/
    );
    expect(src).toMatch(
      /localStorage\.setItem\("jobapp-chart-prefs", JSON\.stringify\(next\)\)/
    );
  });

  it("propaga as mudanças pro componente raiz via onHomeCardsChange/onChartPrefsChange", () => {
    expect(src).toMatch(/onHomeCardsChange: \(c: HomeCardConfig\) => void;/);
    expect(src).toMatch(/onChartPrefsChange: \(c: ChartPrefConfig\) => void;/);
  });
});

describe("§7-P1-2 — Notificações push são reais (isPushSupported/NotificacoesSheet/unsubscribeFromPush)", () => {
  it("importa as funções reais de lib/push, não um toggle decorativo", () => {
    expect(src).toMatch(/isPushSupported,/);
    expect(src).toMatch(/isPushSubscribed,/);
    expect(src).toMatch(/subscribeToPush,/);
    expect(src).toMatch(/unsubscribeFromPush,/);
    expect(src).toMatch(/from "@\/lib\/push"/);
  });

  it("monta o NotificacoesSheet real", () => {
    expect(src).toMatch(
      /import\s*\{\s*NotificacoesSheet\s*\}\s*from\s*"@\/components\/notificacoes\/NotificacoesSheet"/
    );
    expect(src).toMatch(/<NotificacoesSheet/);
  });
});

describe("§7-P1-3 — Instalar app (InstallSheet real, condicional a !isStandalone())", () => {
  it("importa isStandalone de lib/platform e InstallSheet real", () => {
    expect(src).toMatch(
      /import\s*\{\s*isStandalone\s*\}\s*from\s*"@\/lib\/platform"/
    );
    expect(src).toMatch(
      /import\s*\{\s*InstallSheet\s*\}\s*from\s*"@\/components\/install\/InstallSheet"/
    );
    expect(src).toMatch(/setStandalone\(isStandalone\(\)\)/);
  });
});

describe("§7-P1-4 — Exportar dados usa exportarDadosCSV real", () => {
  it("importa e chama exportarDadosCSV (CSV real via Supabase), não um placeholder de nomes trocados", () => {
    expect(src).toMatch(
      /import\s*\{\s*exportarDadosCSV\s*\}\s*from\s*"@\/lib\/exportarDados"/
    );
    expect(src).toMatch(/await exportarDadosCSV\(userId\)/);
  });
});
