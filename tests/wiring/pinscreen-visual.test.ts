import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Teste de fiação (não de renderização), mesmo padrão de
 * `cofre-visual.test.ts`: confirma a partir do código fonte que a tela de
 * bloqueio é o "2 · Cartão Cofre" aprovado
 * (docs/jornada/referencias/tela-bloqueio-cartao-cofre.html), sem Face ID,
 * com Voltar fixo e "Esqueci o PIN" ligado ao que já existe — e que a
 * segurança continua 1:1 a de antes. O pixel (0,00% em 390/430, claro e
 * escuro, Cofre e app, parado/digitando/erro/acerto) é medido por
 * tests/visual/pixel/bloqueio.mjs. A trava `fixed` no build de produção
 * fica em `pinscreen-fixed-position.test.ts` (não duplicado aqui).
 */

const ROOT = join(__dirname, "..", "..");
const ler = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf-8");
const tsxSrc = ler("components", "pin", "PinScreen.tsx");
const cssSrc = ler("components", "pin", "PinScreen.module.css");
const pageSrc = ler("app", "page.tsx");
const labSrc = ler("app", "dev-preview", "app", "page.tsx");
const cofreSrc = ler("components", "cofre", "CofreTab.tsx");
// Sem comentários: um nome citado só em comentário não conta como uso.
const codigo = tsxSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const css = cssSrc.replace(/\/\*[\s\S]*?\*\//g, "");

function regra(seletor: string): string {
  const esc = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`Regra ${seletor} não encontrada`);
  return m[1];
}

describe("PinScreen — Cartão Cofre aprovado", () => {
  it("cartão do topo com escudo, sobretítulo e título (Cofre e app)", () => {
    expect(codigo).toMatch(/className=\{styles\.hero\}/);
    expect(codigo).toMatch(/className=\{styles\.shield\}/);
    expect(codigo).toMatch(/vault \? "Cofre" : "JobApp"/);
    expect(codigo).toContain('"Abra seu Cofre"');
    expect(codigo).toContain('"Digite seu PIN"');
    expect(codigo).toContain('"Acesso liberado"');
    expect(regra(".hero")).toMatch(/border-radius: 0 0 34px 34px/);
    expect(regra(".shield")).toMatch(/width: 54px;[\s\S]*height: 54px/);
    expect(regra(".title")).toMatch(/font-size: 24px;[\s\S]*font-weight: 800/);
  });

  it("4 casas de 56×64: a próxima em destaque, vermelhas no erro, verdes no acerto", () => {
    expect(codigo).toMatch(/\[0, 1, 2, 3\]\.map/);
    expect(codigo).toMatch(
      /const estado = unlocked \? "ok" : error \? "err" : undefined;/
    );
    expect(codigo).toMatch(/data-estado=\{estado\}/);
    expect(regra(".boxes i")).toMatch(/width: 56px;[\s\S]*height: 64px/);
    expect(regra(".boxes i.current")).toContain("var(--t-acc)");
    expect(regra(".boxes i.filled::after")).toContain("var(--t-acc)");
    const erro = regra('.page[data-estado="err"] .boxes i');
    expect(erro).toContain("var(--t-red)");
    expect(erro).toContain("var(--t-rsoft)");
    expect(regra('.page[data-estado="err"] .boxes i.filled::after')).toContain(
      "var(--t-red)"
    );
    const certo = regra('.page[data-estado="ok"] .boxes i');
    expect(certo).toContain("var(--t-green)");
    expect(certo).toContain("var(--t-gsoft)");
    expect(regra('.page[data-estado="ok"] .boxes i.filled::after')).toContain(
      "var(--t-green)"
    );
  });

  it("mensagens do desenho aprovado nos dois contextos e nos três estados", () => {
    expect(codigo).toContain(
      '"Digite seu PIN para ver seus arquivos protegidos."'
    );
    expect(codigo).toContain('"Confirme que é você para entrar no JobApp."');
    expect(codigo).toContain('"Esse PIN não confere. Tente de novo."');
    expect(codigo).toContain('"Tudo certo, abrindo…"');
    expect(codigo).toContain('"Verificando…"');
  });

  it("teclado novo em azulejos 3×4: 1–9, vazio, 0 e apagar no canto de baixo à direita", () => {
    expect(codigo).toContain(
      'const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];'
    );
    expect(regra(".pad")).toMatch(/grid-template-columns: repeat\(3, 1fr\)/);
    expect(regra(".pad button,\n.pad span")).toMatch(/height: 60px/);
    expect(regra(".page .pad button")).toMatch(/border-radius: 16px/);
    expect(regra(".page .pad button")).toContain("var(--t-sub)");
    // Nada do T9 circular antigo.
    expect(codigo).not.toMatch(/ABC|WXYZ|letters/);
    expect(css).not.toMatch(/border-radius: 50%;[^}]*height: clamp/);
  });

  it("só tokens do app (8 temas, claro/escuro): sem rosa fixo, brilho pelo acento do tema", () => {
    expect(css).not.toMatch(/rgba\(255,\s*45,\s*120/i);
    expect(css).not.toMatch(/#ff2d78|#0a0007|#25121c|#f5f5f7/i);
    // Única cor literal: branco sobre o cartão (igual à referência).
    const hex = css.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    expect(new Set(hex.map((h) => h.toLowerCase()))).toEqual(new Set(["#fff"]));
    expect(regra(".page")).toContain("background: var(--t-phbg)");
    expect(regra(".hero")).toContain("background: var(--t-hero)");
    expect(regra(".sheet")).toContain("background: var(--t-card)");
    expect(regra(".hero::after")).toContain(
      "color-mix(in srgb, var(--t-acc) 45%, transparent)"
    );
  });

  it("respeita o notch e a barra de gestos no PWA (cartão do topo e folha do teclado)", () => {
    expect(regra(".hero")).toMatch(
      /padding: max\(60px, calc\(env\(safe-area-inset-top, 0px\) \+ 12px\)\) 18px 26px/
    );
    expect(regra(".sheet")).toMatch(
      /padding: 16px 18px calc\(26px \+ env\(safe-area-inset-bottom, 0px\)\)/
    );
  });

  it("sem Face ID nem biometria em lugar nenhum da tela", () => {
    expect(codigo).not.toMatch(
      /face\s*id|faceid|biometr|webauthn|credentials\.get|ScanFace/i
    );
  });
});

describe("PinScreen — Voltar sempre no mesmo lugar", () => {
  it("o espaço do Voltar (44px) existe nos dois contextos; o botão só aparece com onCancel", () => {
    expect(regra(".backslot")).toMatch(/height: 44px/);
    // O slot é renderizado sempre; o botão é condicional DENTRO dele.
    expect(codigo).toMatch(
      /<div className=\{styles\.backslot\}>\s*\{onCancel && \(\s*<button/
    );
    expect(codigo).toMatch(/onClick=\{onCancel\}/);
    expect(codigo).toMatch(/>\s*Voltar\s*<\/button>/);
  });

  it("vindo do Cofre o Voltar leva de volta (onCancel={onExit}); a trava do app não tem Voltar", () => {
    expect(cofreSrc).toMatch(/context="vault"[\s\S]{0,120}onCancel=\{onExit\}/);
    expect(pageSrc).not.toMatch(/onCancel=/);
    expect(labSrc).not.toMatch(/onCancel=/);
  });

  it("a tecla de apagar não vira mais 'Cancelar': a saída é só o Voltar", () => {
    expect(codigo).not.toMatch(/isCancel|"Cancelar"/);
    expect(codigo).toMatch(
      /if \(key === "del"\) \{\s*setDigits\(\(current\) => current\.slice\(0, -1\)\);/
    );
  });
});

describe("PinScreen — 'Esqueci o PIN' aponta pro que já existe (sem inventar recuperação)", () => {
  it("link discreto embaixo do teclado, onde ficava o Face ID", () => {
    expect(codigo).toMatch(
      /className=\{styles\.forgot\}[\s\S]{0,120}Esqueci o PIN/
    );
    expect(regra(".page .forgot")).toMatch(/text-decoration: underline/);
    expect(regra(".page .forgot")).toContain("var(--t-mut)");
  });

  it("no Cofre leva a Ajustes › Segurança e PIN (onAbrirAjustes → aba ajustes)", () => {
    expect(codigo).toMatch(/onClick=\{onAbrirAjustes\}/);
    expect(cofreSrc).toMatch(/onAbrirAjustes=\{onAbrirAjustes\}/);
    expect(pageSrc).toMatch(
      /onAbrirAjustes=\{\(\) => handleTabChange\("ajustes"\)\}/
    );
    expect(labSrc).toMatch(
      /onAbrirAjustes=\{\(\) => handleTabChange\("ajustes"\)\}/
    );
  });

  it("na trava do app oferece sair da conta (handleSignOut real) e diz que o PIN não se recupera", () => {
    expect(codigo).toMatch(/onClick=\{onSair\}/);
    expect(pageSrc).toMatch(/<PinScreen[\s\S]{0,160}onSair=\{handleSignOut\}/);
    expect(labSrc).toMatch(/<PinScreen[\s\S]{0,160}onSair=\{handleSignOut\}/);
    expect(codigo).toContain("não dá para mostrá-lo nem recuperá-lo por aqui");
    expect(codigo).toContain("o mesmo PIN continua sendo pedido");
  });

  it("cada contexto mostra só a sua saída (Ajustes no Cofre, Sair no app)", () => {
    expect(codigo).toMatch(
      /\{vault\s*\?\s*onAbrirAjustes && \([\s\S]*?\)\s*:\s*onSair && \(/
    );
  });

  it("não chama nenhuma API nova de recuperação (e-mail, reset, Supabase)", () => {
    expect(codigo).not.toMatch(/supabase|resetPassword|fetch\(|\/api\//);
  });
});

describe("PinScreen — segurança e estados preservados 1:1 (só visual muda)", () => {
  it("continua usando o mesmo verifyPin/hash real, sem verificação paralela", () => {
    expect(codigo).toContain('import { verifyPin } from "@/lib/pin"');
    expect(codigo).toMatch(/verifyPin\(digits\.join\(""\), pinHash\)/);
    expect(codigo).toMatch(/if \(digits\.length !== 4\) return;/);
    expect(codigo).toMatch(
      /current\.length < 4 \? \[\.\.\.current, key\] : current/
    );
  });

  it("mantém o mesmo timing de erro (700ms) e desbloqueio (200ms)", () => {
    expect(codigo).toContain("}, 700);");
    expect(codigo).toContain("}, 200);");
  });

  it("não aceita toque durante a conferência (disabled) e não esmaece no erro/acerto", () => {
    expect(codigo).toMatch(/disabled=\{verifying\}/);
    expect(codigo).toMatch(/if \(verifying\) return;/);
    expect(css).toMatch(
      /\.page:not\(\[data-estado\]\) \.pad button:disabled \{\s*opacity: 0\.55;/
    );
  });

  it("não inventa contagem de tentativas nem bloqueio por excesso — nenhum dos dois existe em lib/pin.ts hoje", () => {
    const libPinSrc = ler("lib", "pin.ts");
    expect(libPinSrc).not.toMatch(
      /tentativa|lockout|maxAttempts|attemptCount/i
    );
    expect(codigo).not.toMatch(/tentativa|lockout|maxAttempts|attemptCount/i);
  });

  it("continua sem <input> nativo e sem scrollIntoView/scrollTo/autoFocus/.focus()", () => {
    expect(codigo).not.toMatch(/<input\b/);
    expect(codigo).not.toMatch(/scrollIntoView|scrollTo\(|autoFocus|\.focus\(/);
  });

  it("mantém o wrapper fixed/inset-0/z-100 e o diálogo modal", () => {
    expect(codigo).toMatch(
      /className=\{`\$\{styles\.page\} fixed inset-0 z-\[100\]`\}/
    );
    expect(codigo).toMatch(/role="dialog"\s*aria-modal="true"/);
  });

  it("o que fica atrás da trava fica inerte e escondido, e volta ao sair", () => {
    expect(codigo).toMatch(
      /el\.inert = true;\s*el\.style\.visibility = "hidden";/
    );
    expect(codigo).toMatch(
      /el\.inert = antes\[i\]\[0\];\s*el\.style\.visibility = antes\[i\]\[1\];/
    );
    expect(codigo).toMatch(/ref=\{raiz\}/);
  });

  it("mantém o mesmo contrato de props (pinHash/onUnlock/context/onCancel)", () => {
    expect(codigo).toContain("pinHash: string;");
    expect(codigo).toContain("onUnlock: () => void;");
    expect(codigo).toContain('context?: "app" | "vault";');
    expect(codigo).toContain("onCancel?: () => void;");
  });

  it("o laboratório aceita o hash de um PIN conhecido (pixel e prints do acerto)", () => {
    expect(labSrc).toMatch(/ganchos\.__previewLock = \(hash\) =>/);
    expect(labSrc).toMatch(/ganchos\.__previewPin = \(hash\) =>/);
  });
});
