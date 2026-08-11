import { describe, expect, it } from "vitest";
import {
  computeGateState,
  nextUnlockedOnActiveChange,
  nextUnlockedOnLoseFocus,
} from "../../components/cofre/lockGate";

/**
 * Teste determinístico de sequência — não grep de texto. Reproduz
 * exatamente o bug relatado manualmente:
 *
 *   início -> toca Cofre -> deveria mostrar só PinScreen imediatamente
 *   -> troca de aba -> PinScreen não pode aparecer fora do Cofre
 *   -> volta ao Cofre -> deveria pedir PIN de novo
 *
 * A causa real: o gate (`if (pinHash && !unlocked) return <PinScreen/>`)
 * nunca checava `active`. Isso deixava o portal do PinScreen renderizar
 * (via `createPortal(..., document.body)`, que ignora o `display:none`
 * do TabPanel) em QUALQUER aba sempre que `unlocked` fosse `false` — e
 * deixava o conteúdo sensível renderizar sempre que `unlocked` fosse
 * `true`, também independente da aba ativa. `CofreTab` nunca desmonta de
 * verdade (o `TabPanel` compartilhado só alterna `display:none`), então
 * esse estado "vazava" entre trocas de aba.
 *
 * Este arquivo testa `computeGateState`/`nextUnlockedOnActiveChange`
 * diretamente — funções puras, sem precisar de jsdom/RTL (que este
 * projeto não tem) — mas cobrindo a sequência real de eventos, não só a
 * forma do código fonte.
 */

describe("Cofre lock gate — sequência exata do bug relatado", () => {
  it("boot no Início (Cofre montado em segundo plano, inativo) não mostra nada do Cofre", () => {
    expect(
      computeGateState({ active: false, pinHash: "hash", unlocked: false })
    ).toBe("hidden");
  });

  it("primeira entrada no Cofre com PIN ativo mostra SÓ a PinScreen — nunca o conteúdo", () => {
    expect(
      computeGateState({ active: true, pinHash: "hash", unlocked: false })
    ).toBe("locked");
  });

  it("PIN correto libera o conteúdo (unlocked=true) enquanto a aba continua ativa", () => {
    expect(
      computeGateState({ active: true, pinHash: "hash", unlocked: true })
    ).toBe("content");
  });

  it("PIN errado (unlocked continua false) mantém a PinScreen, nunca libera", () => {
    expect(
      computeGateState({ active: true, pinHash: "hash", unlocked: false })
    ).toBe("locked");
  });

  it("sair do Cofre esconde TUDO (nem PinScreen nem conteúdo) — nenhuma outra aba recebe o portal", () => {
    expect(
      computeGateState({ active: false, pinHash: "hash", unlocked: true })
    ).toBe("hidden");
    // Defesa extra: mesmo que `unlocked` ainda não tenha sido resetado
    // (janela entre o render e o efeito rodar), active=false já esconde.
    expect(
      computeGateState({ active: false, pinHash: "hash", unlocked: false })
    ).toBe("hidden");
  });

  it("sair da aba sempre rebloqueia (nextUnlockedOnActiveChange) — a próxima entrada não herda o desbloqueio", () => {
    expect(nextUnlockedOnActiveChange(false, true)).toBe(false);
    expect(nextUnlockedOnActiveChange(false, false)).toBe(false);
  });

  it("permanecer ativo não mexe no desbloqueio (nextUnlockedOnActiveChange não desbloqueia sozinho)", () => {
    expect(nextUnlockedOnActiveChange(true, false)).toBe(false);
    expect(nextUnlockedOnActiveChange(true, true)).toBe(true);
  });

  it("voltar ao Cofre depois de sair exige PIN de novo — não herda o desbloqueio anterior", () => {
    // Simula a sequência completa: entra, desbloqueia, sai, volta.
    let unlocked = false;
    let active = false;
    const pinHash = "hash";

    active = true; // toca Cofre
    expect(computeGateState({ active, pinHash, unlocked })).toBe("locked");

    unlocked = true; // PIN correto
    expect(computeGateState({ active, pinHash, unlocked })).toBe("content");

    active = false; // troca de aba
    unlocked = nextUnlockedOnActiveChange(active, unlocked);
    expect(computeGateState({ active, pinHash, unlocked })).toBe("hidden");

    active = true; // volta ao Cofre
    expect(computeGateState({ active, pinHash, unlocked })).toBe("locked"); // <- pede PIN de novo
  });

  it("app já desbloqueado (sessão autenticada) não implica Cofre desbloqueado — pinHash/unlocked são os únicos fatores, não usuario/locked do app", () => {
    // A função nem aceita usuario/locked como parâmetro — estruturalmente
    // impossível confundir sessão do app com autorização do Cofre.
    expect(
      computeGateState({ active: true, pinHash: "hash", unlocked: false })
    ).toBe("locked");
  });

  it("sem PIN configurado, o Cofre abre direto quando ativo — mesmo comportamento do resto do app", () => {
    expect(
      computeGateState({ active: true, pinHash: null, unlocked: false })
    ).toBe("content");
    expect(
      computeGateState({ active: false, pinHash: null, unlocked: false })
    ).toBe("hidden");
  });

  it("perder foco/visibilidade/pagehide sempre rebloqueia, sem exceção", () => {
    expect(nextUnlockedOnLoseFocus()).toBe(false);
  });

  it("sequência repetida Cofre -> Início -> Cofre 10x nunca vaza o desbloqueio nem pula a PinScreen", () => {
    let unlocked = false;
    let active = false;
    const pinHash = "hash";

    for (let i = 0; i < 10; i++) {
      active = true; // entra no Cofre
      expect(computeGateState({ active, pinHash, unlocked })).toBe("locked");

      unlocked = true; // PIN correto desta entrada
      expect(computeGateState({ active, pinHash, unlocked })).toBe("content");

      active = false; // volta pro Início
      unlocked = nextUnlockedOnActiveChange(active, unlocked);
      expect(computeGateState({ active, pinHash, unlocked })).toBe("hidden");
    }
  });
});
