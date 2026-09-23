import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Teste de fiação (não de renderização), mesmo padrão de
 * `cofre-visual.test.ts`/`inicio-visual.test.ts`: confirma a partir do
 * código fonte que o teclado circular T9 aprovado (/dev-preview/ios,
 * ticket #138) foi portado pro `PinScreen` real sem regredir nenhuma das
 * garantias de segurança/estados já testadas em
 * `pinscreen-fixed-position.test.ts` (preservado, não duplicado aqui).
 */

const ROOT = join(__dirname, "..", "..");
const tsxSrc = readFileSync(
  join(ROOT, "components", "pin", "PinScreen.tsx"),
  "utf-8"
);
const cssSrc = readFileSync(
  join(ROOT, "components", "pin", "PinScreen.module.css"),
  "utf-8"
);

describe("PinScreen — teclado T9 circular aprovado (#138)", () => {
  it("mapeia as letras ABC/DEF/... exatamente como o protótipo aprovado (IosPrototypeApp.tsx pinKeys)", () => {
    for (const letters of [
      "ABC",
      "DEF",
      "GHI",
      "JKL",
      "MNO",
      "PQRS",
      "TUV",
      "WXYZ",
    ]) {
      expect(tsxSrc).toContain(letters);
    }
  });

  it("os botões do teclado são círculos (border-radius: 50%), não a grade retangular antiga", () => {
    const keypadRule = cssSrc.match(/\.keypad > button \{([\s\S]*?)\n\}/);
    expect(keypadRule).not.toBeNull();
    expect(keypadRule![1]).toMatch(/border-radius:\s*50%/);
  });

  it("renderiza o selo circular de cadeado (LockKeyhole) acima do título, como no protótipo", () => {
    expect(tsxSrc).toMatch(
      /import\s*\{[^}]*\bLockKeyhole\b[^}]*\}\s*from\s*"lucide-react"/
    );
    expect(tsxSrc).toContain("<LockKeyhole size={27} />");
  });

  it("usa var(--accent)/var(--accent-rgb) pro destaque, nunca o rosa fixo do protótipo (rgba(255,45,120,...))", () => {
    expect(cssSrc).toContain("var(--accent)");
    expect(cssSrc).toContain("var(--accent-rgb)");
    expect(cssSrc).not.toMatch(/rgba\(255,\s*45,\s*120/i);
    expect(cssSrc).not.toMatch(/#e34468|#ff2d78/i);
  });

  it("título e selo batem em pixel com o protótipo aprovado (34px/-0.04em, selo 68px/23px de margem)", () => {
    expect(cssSrc).toContain("font-size: 34px");
    expect(cssSrc).toContain("letter-spacing: -0.04em");
    expect(cssSrc).toContain("margin-bottom: 23px");
  });
});

describe("PinScreen — distingue PIN geral e PIN do Cofre (ponto crítico da #138)", () => {
  it("título e mensagem do Cofre são literalmente os do visual aprovado", () => {
    expect(tsxSrc).toContain('"Abra seu cofre"');
    expect(tsxSrc).toContain(
      "Digite seu PIN para acessar seus arquivos protegidos."
    );
  });

  it("título e mensagem do PIN geral continuam distintos dos do Cofre", () => {
    expect(tsxSrc).toContain('"Digite seu PIN"');
    expect(tsxSrc).toContain("Confirme sua identidade para entrar no JobApp.");
  });

  it("mensagem de rodapé também distingue os dois contextos", () => {
    expect(tsxSrc).toContain(
      "O Cofre será bloqueado novamente quando você sair desta área."
    );
    expect(tsxSrc).toContain("Seu espaço permanece protegido neste aparelho.");
  });

  it("segue sem nenhum botão de cancelar (decisão deliberada da Fase 3/#126, não regredida)", () => {
    expect(tsxSrc).not.toMatch(/cancelar/i);
  });
});

describe("PinScreen — segurança e estados preservados 1:1 (nenhuma lógica nova, só visual)", () => {
  it("continua usando o mesmo verifyPin/hash real, sem verificação paralela", () => {
    expect(tsxSrc).toContain('import { verifyPin } from "@/lib/pin"');
    expect(tsxSrc).toMatch(/verifyPin\(digits\.join\(""\), pinHash\)/);
  });

  it("cobre os 6 estados obrigatórios do contrato: vazio, digitando, verificando, correto, incorreto, apagar", () => {
    expect(tsxSrc).toContain("Verificando…");
    expect(tsxSrc).toContain("Esse PIN não confere. Tente novamente.");
    expect(tsxSrc).toContain("Acesso liberado.");
    expect(tsxSrc).toMatch(/key === "del"/);
    expect(tsxSrc).toMatch(/current\.slice\(0, -1\)/);
  });

  it("não inventa contagem de tentativas nem bloqueio por excesso — nenhum dos dois existe em lib/pin.ts hoje", () => {
    const libPinSrc = readFileSync(join(ROOT, "lib", "pin.ts"), "utf-8");
    expect(libPinSrc).not.toMatch(
      /tentativa|lockout|maxAttempts|attemptCount/i
    );
    expect(tsxSrc).not.toMatch(/tentativa|lockout|maxAttempts|attemptCount/i);
  });

  it("continua sem <input> nativo (evita abrir teclado do sistema)", () => {
    expect(tsxSrc).not.toMatch(/<input\b/);
  });

  it("continua sem scrollIntoView/scrollTo/autoFocus/.focus()", () => {
    expect(tsxSrc).not.toMatch(/scrollIntoView|scrollTo\(|autoFocus|\.focus\(/);
  });

  it("mantém o wrapper fixed/inset-0/z-100 e as margens de safe-area (mesmo elemento raiz, mesmo contrato)", () => {
    expect(tsxSrc).toMatch(
      /className=\{`\$\{styles\.page\} fixed inset-0 z-\[100\]`\}/
    );
    expect(tsxSrc).toContain("env(safe-area-inset-top, 0px)");
    expect(tsxSrc).toContain("env(safe-area-inset-bottom, 0px)");
  });

  it("mantém o mesmo timing de shake/erro (700ms) e desbloqueio (200ms) — comportamento intocado", () => {
    expect(tsxSrc).toContain("}, 700);");
    expect(tsxSrc).toContain("}, 200);");
  });

  it("mantém o mesmo contrato de props (pinHash/onUnlock/context)", () => {
    expect(tsxSrc).toContain("pinHash: string;");
    expect(tsxSrc).toContain("onUnlock: () => void;");
    expect(tsxSrc).toContain('context?: "app" | "vault";');
  });
});
