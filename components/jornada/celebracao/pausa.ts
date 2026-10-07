/**
 * Quem pode pausar a comemoração (issue #196). Uma camada de cada vez: a
 * comemoração nunca cai em cima de outra coisa que já está na tela (spec
 * §9). Enquanto alguma camada estiver aberta, o palco não mostra nada e não
 * consome nada -- a fila persistente da J11 guarda tudo, e ela retoma
 * quando a última camada fecha. O som não repete (trava por id em
 * sessao.ts).
 *
 * Hoje a única camada que pausa é o recap do mês (RecapSheet), que abre
 * sozinho no começo do mês: recap primeiro, comemoração depois.
 */

import { useEffect, useSyncExternalStore } from "react";

const abertas = new Set<string>();
const ouvintes = new Set<() => void>();

function avisar() {
  ouvintes.forEach((o) => o());
}

/** Marca (ou desmarca) uma camada que pausa a comemoração. */
export function definirPausa(camada: string, ativa: boolean): void {
  const tinha = abertas.has(camada);
  if (ativa === tinha) return;
  if (ativa) abertas.add(camada);
  else abertas.delete(camada);
  avisar();
}

export function comemoracaoPausada(): boolean {
  return abertas.size > 0;
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Para o palco: true enquanto alguma camada estiver aberta. */
export function useComemoracaoPausada(): boolean {
  return useSyncExternalStore(assinar, comemoracaoPausada, () => false);
}

/**
 * Para a camada: pausa a comemoração enquanto `aberta` for true. Desmontar
 * a camada também solta a pausa (nunca prende a fila).
 */
export function usePausarComemoracao(camada: string, aberta: boolean): void {
  useEffect(() => {
    definirPausa(camada, aberta);
    return () => definirPausa(camada, false);
  }, [camada, aberta]);
}

/** Só testes. */
export function _resetPausa(): void {
  abertas.clear();
  avisar();
}
