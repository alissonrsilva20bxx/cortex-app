import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Fiação das 3 regras de segurança do PIN (PR #217):
 *  1. "Esqueci o PIN" pede a senha da conta ou o Google e só então deixa
 *     criar um PIN novo (digitado duas vezes), sem mostrar o antigo;
 *  2. desligar ou trocar o PIN nos Ajustes também pede a conta antes;
 *  3. limite de tentativas: 5 erros = 1 min, depois dobra; zera ao acertar,
 *     ao criar PIN novo e ao sair da conta.
 * A lógica pura é executada em tests/lib/pinTentativas.test.ts e
 * tests/lib/reauth.test.ts; aqui, a ligação entre as peças.
 */

const ROOT = join(__dirname, "..", "..");
// Fim de linha normalizado (checkout Windows com core.autocrlf) e sem
// comentários: um nome citado só em comentário não conta como uso.
const ler = (...p: string[]) =>
  readFileSync(join(ROOT, ...p), "utf-8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'])\/\/.*$/gm, "$1");

const pin = ler("components", "pin", "PinScreen.tsx");
const modal = ler("components", "pin", "ReauthModal.tsx");
const reauth = ler("lib", "reauth.ts");
const ajustes = ler("components", "ajustes", "AjustesTab.tsx");
const page = ler("app", "page.tsx");
const lab = ler("app", "dev-preview", "app", "page.tsx");
const cofre = ler("components", "cofre", "CofreTab.tsx");

describe("ReauthModal: senha da conta OU Google", () => {
  it("mostra só os métodos que a conta tem", () => {
    expect(modal).toMatch(/metodos\?\.includes\("senha"\) && \(/);
    expect(modal).toMatch(/metodos\?\.includes\("google"\) && \(/);
    expect(modal).toMatch(/type="password"/);
  });

  it("senha: confere com a senha da PRÓPRIA conta (e-mail do usuário logado)", () => {
    expect(reauth).toMatch(
      /const email = data\.user\?\.email;[\s\S]{0,200}signInWithPassword\(\{\s*email,\s*password: senha,/
    );
  });

  it("só chama onConfirmado quando a senha confere", () => {
    expect(modal).toMatch(
      /if \(r\.ok\) onConfirmado\(\);\s*else setErro\(r\.erro\);/
    );
  });

  it("Google: marca antes de sair, escolhe a conta e volta para o app com o motivo", () => {
    expect(reauth).toMatch(
      /entradaAnterior: data\.user\.last_sign_in_at \?\? null/
    );
    expect(reauth).toMatch(/sessionStorage\.setItem\(CHAVE_MARCA/);
    expect(reauth).toMatch(/queryParams: \{ prompt: "select_account" \}/);
    expect(reauth).toMatch(/const next = `\/\?reauth=\$\{motivo\}`;/);
  });

  it("na volta, a marca vale uma vez só e é conferida pela regra testada", () => {
    expect(reauth).toMatch(
      /sessionStorage\.removeItem\(CHAVE_MARCA\);[\s\S]{0,200}return retornoDoGoogleValido\(marca, motivo, data\.user, Date\.now\(\)\);/
    );
  });
});

describe("Regra 1: 'Esqueci o PIN' pede a conta e cria um PIN novo", () => {
  it("o link abre a confirmação da conta, não um atalho", () => {
    expect(pin).toMatch(/onClick=\{\(\) => setEtapa\("reauth"\)\}/);
    expect(pin).toMatch(
      /etapa === "reauth" \? \([\s\S]{0,200}<ReauthModal[\s\S]{0,80}motivo="esqueci-pin"/
    );
  });

  it("só depois da conta confirmada vai para o PIN novo", () => {
    expect(pin).toMatch(
      /onConfirmado=\{\(\) => \{\s*setDigits\(\[\]\);\s*setEtapa\("novo"\);/
    );
  });

  it("PIN novo digitado duas vezes; diferentes, recomeça", () => {
    expect(pin).toMatch(
      /if \(etapa === "novo"\) \{\s*setPrimeiro\(digits\.join\(""\)\);\s*setDigits\(\[\]\);\s*setEtapa\("confirmar"\);/
    );
    expect(pin).toMatch(/if \(novo !== primeiro\) \{/);
  });

  it("grava o hash novo na conta (nunca o PIN), zera o limite e avisa o pai", () => {
    expect(pin).toMatch(/const hash = await hashPin\(novo\);/);
    expect(pin).toMatch(
      /const gravou = await reauth\.gravarPin\(usuarioId, hash\);/
    );
    expect(pin).toMatch(
      /zerarTentativas\(usuarioId\);[\s\S]{0,200}onPinRedefinido\?\.\(hash\);\s*unlock\(\);/
    );
  });

  it("o PIN antigo nunca aparece: a tela não mostra o hash nem tem como lê-lo", () => {
    expect(pin).not.toMatch(/\{pinHash\}/);
    expect(pin).not.toMatch(/pin_hash/);
  });

  it("volta do Google com o motivo do Esqueci também leva ao PIN novo", () => {
    expect(pin).toMatch(
      /reauth\.motivoPendente\(\) !== "esqueci-pin"[\s\S]{0,120}reauth\.retornoDoGoogle\("esqueci-pin"\)/
    );
    expect(pin).toMatch(
      /if \(vivo && ok\) \{\s*setDigits\(\[\]\);\s*setEtapa\("novo"\);/
    );
  });

  it("a trava do app e a do Cofre recebem o hash novo", () => {
    expect(page).toMatch(
      /onPinRedefinido=\{\(hash\) => \{\s*setPinHash\(hash\);\s*if \(usuario\) pinHashCache\.gravar\(usuario\.id, hash\);/
    );
    expect(cofre).toMatch(/onPinRedefinido=\{onPinHashChange\}/);
    expect(page).toMatch(
      /onPinHashChange=\{\(h\) => \{\s*setPinHash\(h\);\s*pinHashCache\.gravar\(usuario\.id, h\);/
    );
  });
});

describe("Regra 2: desligar ou trocar o PIN nos Ajustes pede a conta", () => {
  it("tocar no PIN ativo pede a confirmação; não desliga direto", () => {
    expect(ajustes).toMatch(/pinEnabled \? pedirDesligarPin : abrirPinSetup/);
    expect(ajustes).toMatch(
      /function pedirDesligarPin\(\) \{\s*setReauthMotivo\("desligar-pin"\);/
    );
  });

  it("handleDisablePin só roda depois da conta confirmada", () => {
    const chamadas = ajustes.match(/(?<!function )handleDisablePin\(\)/g) ?? [];
    expect(chamadas).toHaveLength(1);
    expect(ajustes).toMatch(
      /if \(motivo === "desligar-pin"\) void handleDisablePin\(\);/
    );
  });

  it("trocar (abrir o PinSetup com um PIN ativo) também pede a conta", () => {
    expect(ajustes).toMatch(
      /if \(pinEnabled\) setReauthMotivo\("trocar-pin"\);\s*else setPinSetupOpen\(true\);/
    );
    expect(ajustes).toMatch(
      /else if \(motivo === "trocar-pin"\) setPinSetupOpen\(true\);/
    );
  });

  it("o ReauthModal dos Ajustes chama a ação só no onConfirmado", () => {
    expect(ajustes).toMatch(
      /<ReauthModal[\s\S]{0,200}onConfirmado=\{\(\) => reauthMotivo && contaConfirmada\(reauthMotivo\)\}/
    );
  });

  it("volta do Google: a página abre os Ajustes e eles conferem antes de agir", () => {
    expect(page).toMatch(
      /motivo === "desligar-pin" \|\| motivo === "trocar-pin"\)\s*setActiveTab\("ajustes"\)/
    );
    expect(ajustes).toMatch(/if \(vivo && valeu\) contaConfirmada\(motivo\);/);
  });
});

describe("Regra 3: limite de tentativas", () => {
  it("cada erro conta, ANTES de checar se a tela fechou (sair não escapa)", () => {
    expect(pin).toMatch(
      /const depois = registrarErro\(lerTentativas\(usuarioId\), Date\.now\(\)\);\s*gravarTentativas\(usuarioId, depois\);\s*if \(cancelled\) return;/
    );
  });

  it("na espera o teclado não aceita nada e a tela diz quanto falta", () => {
    expect(pin).toMatch(/if \(verifying \|\| emEspera\) return;/);
    expect(pin).toMatch(/disabled=\{verifying \|\| emEspera\}/);
    // sem o contorno de "próxima casa" enquanto não dá para digitar
    expect(pin).toMatch(/!verifying && !emEspera \? styles\.current/);
    expect(pin).toMatch(
      /`Muitas tentativas\. Tente de novo em \$\{formatarEspera\(espera\)\}\.`/
    );
  });

  it("a espera vem do contador guardado (fechar e abrir a tela não zera)", () => {
    expect(pin).toMatch(
      /useState<EstadoTentativas>\(\(\) =>\s*lerTentativas\(usuarioId\)/
    );
    expect(pin).toMatch(
      /const espera = etapa === "teclado" \? restanteDaEspera\(tentativas, agora\) : 0;/
    );
  });

  it("acertar o PIN zera o contador", () => {
    expect(pin).toMatch(
      /if \(ok\) \{\s*onUnlock\(\);\s*zerarTentativas\(usuarioId\);/
    );
  });

  it("sair da conta zera o contador (para voltar é preciso a senha ou o Google)", () => {
    expect(page).toMatch(
      /async function handleSignOut\(\) \{[\s\S]{0,600}zerarTodasAsTentativas\(\);/
    );
  });

  it("a trava do app e a do Cofre usam o mesmo contador (mesma conta)", () => {
    expect(page).toMatch(
      /<PinScreen[\s\S]{0,200}usuarioId=\{usuario\?\.id \?\? ""\}/
    );
    expect(cofre).toMatch(/<PinScreen[\s\S]{0,300}usuarioId=\{userId\}/);
    expect(lab).toMatch(/<PinScreen[\s\S]{0,200}usuarioId=\{usuario\.id\}/);
  });

  it("o 'Esqueci o PIN' continua disponível durante a espera", () => {
    expect(pin).not.toMatch(/emEspera[^;\n]{0,40}data-pin-esqueci/);
    expect(pin).toMatch(
      /onClick=\{\(\) => setEtapa\("reauth"\)\}\s*data-pin-esqueci/
    );
  });
});

describe("laboratório: sem Supabase, confirmação falsa", () => {
  it("instala o adaptador do laboratório antes dos filhos e desfaz ao sair", () => {
    expect(lab).toMatch(
      /useState\(\(\) => usarReauth\(reauthDeLaboratorio\)\);/
    );
    expect(lab).toMatch(
      /useEffect\(\(\) => \{\s*usarReauth\(reauthDeLaboratorio\);\s*return \(\) => usarReauth\(null\);\s*\}, \[\]\);/
    );
  });
});
