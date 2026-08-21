import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T17/#70 — `isNewUser` (app/page.tsx) usava ser recalculado a cada
 * render a partir de `jobs`/`metas` ao vivo. Completar a própria 1ª etapa
 * do onboarding (salvar a meta) já muda `metas` o bastante pra
 * `isFreshAccount` virar false — a home normal assumia NO MEIO do fluxo,
 * pulando as etapas "job" e "aha" (confirmado via Playwright, conta real
 * contra Supabase local, antes desta correção). A decisão precisa travar
 * na 1ª leitura confirmada e só destravar via `onboardingDone` (o próprio
 * `OnboardingFlow` chamando `onComplete`), não por reavaliação contínua.
 * Mesmo padrão de inspeção de código-fonte de pinsetup-save-error.test.ts
 * (ambiente do vitest é "node", sem DOM/Testing Library).
 *
 * Achado da revisão independente em #99: travar só a sessão não bastava —
 * uma conta que pula meta+atendimento+PIN nunca escreve em `jobs`/`metas`,
 * então `isFreshAccount` continua `true` pra sempre, e o onboarding
 * reaparece em todo reload/nova sessão nesse aparelho. Fix: flag em
 * `localStorage` (mesmo padrão de `jobapp-home-cards` etc.) gravada
 * quando `onComplete` dispara, checada antes de recalcular `isFreshAccount`.
 */

const src = readFileSync(join(__dirname, "..", "..", "app", "page.tsx"), "utf-8");

function extractLatchEffectBody(source: string): string {
  const match = source.match(
    /useEffect\(\(\) => \{\s*if \(isNewUserSession[\s\S]*?\}, \[usuario, dataLoaded, jobs, metas, isNewUserSession\]\);/
  );
  if (!match) throw new Error("efeito de trava de isNewUserSession não encontrado");
  return match[0];
}

describe("app/page.tsx — decisão de 1º uso trava em vez de reavaliar a cada render", () => {
  it("mantém um estado próprio (isNewUserSession) em vez de derivar isNewUser direto de jobs/metas", () => {
    expect(src).toMatch(
      /const \[isNewUserSession, setIsNewUserSession\] = useState<boolean \| null>/
    );
  });

  const effect = extractLatchEffectBody(src);

  it("não reavalia depois de decidido (guard isNewUserSession !== null)", () => {
    expect(effect).toMatch(/if \(isNewUserSession !== null\) return;/);
  });

  it("decide a partir de isFreshAccount só quando há usuário e dados confirmados", () => {
    expect(effect).toMatch(/if \(!usuario\) return;/);
    expect(effect).toMatch(/if \(!dataLoaded\) return;/);
    expect(effect).toMatch(/setIsNewUserSession\(isFreshAccount\(jobs, metas\)\)/);
  });

  it("checa o flag de onboarding já concluído (localStorage) antes de recalcular isFreshAccount", () => {
    expect(effect).toMatch(
      /localStorage\.getItem\(ONBOARDING_DONE_KEY\)/
    );
    expect(effect).toMatch(/setIsNewUserSession\(false\)/);
    // a checagem do flag precisa vir ANTES do early-return de !dataLoaded,
    // senão uma conta que pulou tudo fica esperando dataLoaded de novo
    // toda sessão em vez de sair direto pela flag persistida.
    const flagCheckIdx = effect.indexOf("localStorage.getItem(ONBOARDING_DONE_KEY)");
    const dataLoadedGuardIdx = effect.indexOf("if (!dataLoaded) return;");
    expect(flagCheckIdx).toBeGreaterThan(-1);
    expect(dataLoadedGuardIdx).toBeGreaterThan(-1);
    expect(flagCheckIdx).toBeLessThan(dataLoadedGuardIdx);
  });

  it("isNewUser lê o valor travado, não recalcula isFreshAccount no corpo do componente", () => {
    const isNewUserLine = src.match(/const isNewUser = [^\n]+/);
    expect(isNewUserLine).not.toBeNull();
    expect(isNewUserLine![0]).toMatch(/isNewUserSession === true/);
    expect(isNewUserLine![0]).not.toMatch(/isFreshAccount\(/);
  });

  it("grava o flag em localStorage quando o onboarding termina (onComplete), antes de destravar onboardingDone", () => {
    const onCompleteMatch = src.match(
      /onComplete=\{\(\) => \{[\s\S]*?\}\}/
    );
    expect(onCompleteMatch).not.toBeNull();
    const onCompleteBody = onCompleteMatch![0];
    expect(onCompleteBody).toMatch(
      /localStorage\.setItem\(ONBOARDING_DONE_KEY, "1"\)/
    );
    expect(onCompleteBody).toMatch(/setOnboardingDone\(true\)/);
  });

  it("define ONBOARDING_DONE_KEY como uma constante de módulo (não repete a string em cada uso)", () => {
    expect(src).toMatch(/const ONBOARDING_DONE_KEY = "jobapp-onboarding-done";/);
  });
});
