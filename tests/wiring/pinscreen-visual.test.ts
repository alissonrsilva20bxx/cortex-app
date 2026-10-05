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

  it("título e selo batem em pixel com o protótipo aprovado (34px/-0.04em, selo 68px/23px de margem) em telas altas", () => {
    // Escalam pela altura (dvh) em telas baixas, mas o teto continua sendo
    // o tamanho aprovado.
    expect(cssSrc).toMatch(/font-size: clamp\(\d+px, [\d.]+dvh, 34px\)/);
    expect(cssSrc).toContain("letter-spacing: -0.04em");
    expect(cssSrc).toMatch(/width: clamp\(\d+px, [\d.]+dvh, 68px\)/);
    expect(cssSrc).toMatch(/margin-bottom: clamp\(\d+px, [\d.]+dvh, 23px\)/);
  });

  it("sem degrau de breakpoint em 700px: tamanho do teclado é contínuo (dvh)", () => {
    expect(cssSrc).not.toContain("@media (max-height: 700px)");
    const keyRule = cssSrc.match(
      /\.keypad > button,\s*\.keypad > span \{([\s\S]*?)\n\}/
    );
    expect(keyRule).not.toBeNull();
    expect(keyRule![1]).toMatch(/width: clamp\(56px, 9dvh, 68px\)/);
    // vh no Safari com barra de endereço mede a viewport grande -> estoura.
    expect(cssSrc).not.toMatch(/[\d.]vh\b/);
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

  // A Fase 3/#126 tirou o cancelar de propósito; o usuário reabriu
  // (2026-10-01: "quando entra em cofre não tem opção de voltar"). Volta
  // só como saída opcional: a tecla apagar vira "Cancelar" com 0 dígitos e
  // SÓ quando o chamador passa `onCancel` (o Cofre). O PIN geral do app não
  // passa, então continua sem saída -- ali não há pra onde voltar.
  it("'Cancelar' só existe como troca da tecla apagar, com 0 dígitos e onCancel presente", () => {
    expect(tsxSrc).toMatch(
      /const isCancel = isDelete && digits\.length === 0 && !!onCancel;/
    );
    expect(tsxSrc).toMatch(/digits\.length === 0 && onCancel\)/);
  });

  it("o PIN geral do app não passa onCancel (sem saída); o do Cofre passa", () => {
    const pageSrc = readFileSync(join(ROOT, "app", "page.tsx"), "utf-8");
    const cofreSrc = readFileSync(
      join(ROOT, "components", "cofre", "CofreTab.tsx"),
      "utf-8"
    );
    expect(pageSrc).not.toMatch(/onCancel=/);
    expect(cofreSrc).toMatch(/onCancel=\{onExit\}/);
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
