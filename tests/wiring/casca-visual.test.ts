import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T11 (Testes de fidelidade funcional, issue #38) — roteiro automatizado
 * para os itens P0/P1 da Seção 1 (Casca global e navegação inferior) do
 * checklist de paridade funcional (`JOBAPP_FUNCTIONAL_PARITY_CHECKLIST_2026-08-07.md`)
 * que ainda não tinham cobertura automatizada. Mesmo padrão de inspeção de
 * código-fonte (sem jsdom/RTL, que este projeto não tem) já usado em
 * `bottomsheet-focus-trap.test.ts` e nos demais `*-visual.test.ts`.
 *
 * IDs referenciados no relatório de execução do T11: §1-P0-1 .. §1-P0-8,
 * §1-P1-1 .. §1-P1-3.
 */

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

const page = read("app/page.tsx");

describe("§1-P0-1 — guard de autenticação é o elemento mais externo", () => {
  it("busca o usuário via supabase.auth.getUser() antes de revelar qualquer conteúdo", () => {
    expect(page).toMatch(/supabase\.auth\.getUser\(\)/);
  });

  it("todo conteúdo real das abas está condicionado a `usuario` já resolvido", () => {
    expect(page).toMatch(/\{!isNewUser && usuario && \(/);
    expect(page).toMatch(/\{isNewUser && usuario && \(/);
  });
});

describe("§1-P0-2 — PinScreen + re-trava automática após 30s em background", () => {
  it("retorna PinScreen como guard mais externo (antes do JSX principal) quando `locked`", () => {
    expect(page).toMatch(
      /if \(locked && pinHash\) \{\s*\r?\n\s*return <PinScreen/
    );
  });

  it("mede o tempo em segundo plano via visibilitychange e re-trava a partir de 30s", () => {
    expect(page).toMatch(/document\.visibilityState === "hidden"/);
    expect(page).toMatch(/document\.visibilityState === "visible"/);
    expect(page).toMatch(/Date\.now\(\) - hiddenAt >= 30_000/);
    expect(page).toMatch(/setLocked\(true\)/);
  });

  it("não busca dados sensíveis (jobs/metas/objetivos) enquanto a trava está de pé", () => {
    expect(page).toMatch(/if \(!usuario \|\| locked\) return;/);
  });
});

describe("§1-P0-3 — TabPanel mantém as 6 abas montadas, nunca desmonta/remonta", () => {
  const tabPanel = read("components/TabPanel.tsx");

  it("usa display:none para a aba inativa em vez de desmontar (sem `{condicao && <Comp/>}` por aba)", () => {
    expect(tabPanel).toMatch(
      /style=\{\{ display: activeTab === tab \? "block" : "none" \}\}/
    );
  });

  it("app/page.tsx monta as 6 abas via TabPanel simultaneamente (home/jobs/financeiro/cofre/rede/ajustes)", () => {
    for (const tab of [
      'tab="home"',
      'tab="jobs"',
      'tab="financeiro"',
      'tab="cofre"',
      'tab="rede"',
      'tab="ajustes"',
    ]) {
      expect(page).toContain(tab);
    }
  });
});

describe("§1-P0-4 — FAB contextual por aba abre o formulário real certo (aba + sub-aba)", () => {
  const fab = read("components/FAB.tsx");

  it("FAB.tsx define SHEET_ACTIONS para home/jobs/financeiro/cofre", () => {
    expect(fab).toMatch(/const SHEET_ACTIONS[\s\S]*?home:/);
    expect(fab).toMatch(/jobs:/);
    expect(fab).toMatch(/financeiro:/);
    expect(fab).toMatch(/cofre:/);
  });

  it("app/page.tsx despacha a ação do FAB por aba, e dentro de financeiro por sub-aba (finInnerTab)", () => {
    expect(page).toMatch(/activeTab === "jobs" \|\| activeTab === "home"/);
    expect(page).toMatch(/if \(finInnerTab === "entradas"\)/);
    expect(page).toMatch(/else if \(finInnerTab === "saidas"\)/);
    expect(page).toMatch(/else if \(finInnerTab === "metas"\)/);
    expect(page).toMatch(/activeTab === "cofre"/);
  });
});

describe("§1-P0-5 — LoadingScreen de tela cheia cobre o app enquanto !usuario || !dataLoaded", () => {
  it("LoadingScreen é renderizado incondicionalmente com isLoading={!usuario || !dataLoaded}", () => {
    expect(page).toMatch(
      /<LoadingScreen isLoading=\{!usuario \|\| !dataLoaded\} \/>/
    );
  });
});

describe("§1-P0-6 — handleSignOut é real (supabase.auth.signOut + redirect), não decorativo", () => {
  it("chama supabase.auth.signOut() e redireciona para /login", () => {
    expect(page).toMatch(/async function handleSignOut\(\) \{/);
    expect(page).toMatch(/await supabase\.auth\.signOut\(\);/);
    expect(page).toMatch(/window\.location\.href = "\/login";/);
  });

  it("AjustesTab recebe handleSignOut real via prop onSignOut, não um handler decorativo local", () => {
    expect(page).toMatch(/<AjustesTab[\s\S]*?onSignOut=\{handleSignOut\}/);
  });
});

describe("§1-P0-7 — OnboardingFlow dispara para conta nova antes de BottomNav/FAB", () => {
  it("isNewUser exige dataLoaded, zero jobs, zero metas e onboarding não concluído", () => {
    expect(page).toMatch(
      /const isNewUser =\s*\r?\n\s*!!usuario &&\s*\r?\n\s*dataLoaded &&\s*\r?\n\s*jobs\.length === 0 &&\s*\r?\n\s*metas\.length === 0 &&\s*\r?\n\s*!onboardingDone;/
    );
  });

  it("BottomNav e FAB só renderizam quando NÃO é conta nova (!isNewUser)", () => {
    expect(page).toMatch(/\{!isNewUser && !chatComposerFocused && \(/);
    expect(page).toMatch(/<BottomNav/);
  });
});

describe("§1-P0-8 — chatComposerFocused esconde BottomNav+FAB quando o composer do chat tem foco", () => {
  it("BottomNav/FAB são condicionados também a !chatComposerFocused", () => {
    expect(page).toMatch(/\{!isNewUser && !chatComposerFocused && \(/);
  });

  it("RedeGatedTab recebe onChatFocusChange ligado a setChatComposerFocused", () => {
    expect(page).toMatch(
      /<RedeGatedTab[\s\S]*?onChatFocusChange=\{setChatComposerFocused\}/
    );
  });
});

describe("§1-P1-1 — ToastProvider/useToast fornece feedback autossumível em todo onSaved de formulário", () => {
  it("useToast é usado no componente raiz e toast.success é chamado no onSaved de cada formulário real", () => {
    expect(page).toMatch(/const toast = useToast\(\);/);
    for (const form of ["JobForm", "MetaForm", "DespesaForm", "ReceitaForm"]) {
      const re = new RegExp(
        `<${form}[\\s\\S]*?onSaved=\\{[\\s\\S]*?toast\\.success`
      );
      expect(page).toMatch(re);
    }
    // UploadSheet usa onUploaded (não onSaved), mesmo contrato de feedback.
    expect(page).toMatch(
      /<UploadSheet[\s\S]*?onUploaded=\{[\s\S]*?toast\.success/
    );
  });

  it("Toast.tsx auto-dispensa a mensagem (não exige fechamento manual)", () => {
    const toastSrc = read("components/Toast.tsx");
    expect(toastSrc).toMatch(/setTimeout/);
  });
});

describe("§1-P1-2 — InstallBanner condicional a !isStandalone(), com soneca em localStorage", () => {
  it("InstallBanner é montado na Início (dentro da TabPanel home)", () => {
    expect(page).toMatch(/<TabPanel tab="home"[\s\S]*?<InstallBanner \/>/);
  });

  it("InstallBanner.tsx consulta isStandalone() e usa localStorage para a soneca", () => {
    const src = read("components/install/InstallBanner.tsx");
    expect(src).toMatch(/isStandalone\(/);
    expect(src).toMatch(/localStorage/);
  });
});

describe("§1-P1-3 — RecapSheet (resumo do mês anterior) montado condicionalmente", () => {
  it("RecapSheet só monta depois que dataLoaded e fora do fluxo de onboarding", () => {
    expect(page).toMatch(
      /\{!isNewUser && usuario && dataLoaded && <RecapSheet jobs=\{jobs\} \/>\}/
    );
  });
});
