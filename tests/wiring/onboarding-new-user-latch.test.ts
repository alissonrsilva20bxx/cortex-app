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
    expect(effect).toMatch(/if \(!usuario \|\| !dataLoaded\) return;/);
    expect(effect).toMatch(/setIsNewUserSession\(isFreshAccount\(jobs, metas\)\)/);
  });

  it("isNewUser lê o valor travado, não recalcula isFreshAccount no corpo do componente", () => {
    const isNewUserLine = src.match(/const isNewUser = [^\n]+/);
    expect(isNewUserLine).not.toBeNull();
    expect(isNewUserLine![0]).toMatch(/isNewUserSession === true/);
    expect(isNewUserLine![0]).not.toMatch(/isFreshAccount\(/);
  });
});
