/**
 * Relógio de 1 minuto para o que depende da hora de agora (a pergunta
 * "Aconteceu?" e os botões do detalhe do atendimento): sem ele, a tela só
 * percebia que o horário passou quando outra coisa a redesenhava.
 *
 * Lógica sem React, para ter teste de verdade (tests/lib/relogio.test.ts).
 * O hook que usa é `lib/useAgora.ts`.
 */

export const INTERVALO_DO_RELOGIO_MS = 60_000;

/** Os eventos de voltar o foco que o relógio escuta (aba visível, janela). */
interface AlvoDeEventos {
  addEventListener(tipo: string, ouvinte: () => void): void;
  removeEventListener(tipo: string, ouvinte: () => void): void;
}

export interface AmbienteDoRelogio {
  documento?: AlvoDeEventos & { visibilityState?: string };
  janela?: AlvoDeEventos;
  intervaloMs?: number;
}

/** Avisa `aoTocar` a cada minuto e quando a aba volta a ficar visível ou a
 * janela volta a ter foco (o celular dorme os timers com a aba em segundo
 * plano). Devolve a função que para tudo. */
export function assinarRelogio(
  aoTocar: () => void,
  {
    documento = typeof document === "undefined" ? undefined : document,
    janela = typeof window === "undefined" ? undefined : window,
    intervaloMs = INTERVALO_DO_RELOGIO_MS,
  }: AmbienteDoRelogio = {}
): () => void {
  const id = setInterval(aoTocar, intervaloMs);
  const aoVoltarAVisivel = () => {
    if (documento?.visibilityState !== "hidden") aoTocar();
  };
  documento?.addEventListener("visibilitychange", aoVoltarAVisivel);
  janela?.addEventListener("focus", aoTocar);
  return () => {
    clearInterval(id);
    documento?.removeEventListener("visibilitychange", aoVoltarAVisivel);
    janela?.removeEventListener("focus", aoTocar);
  };
}

/** Mantém `anterior` se ainda é o mesmo minuto: quem usa isso num setState
 * não redesenha à toa quando o foco volta várias vezes no mesmo minuto. */
export function agoraSeMudouDeMinuto(anterior: Date, agora: Date): Date {
  return Math.floor(anterior.getTime() / 60_000) ===
    Math.floor(agora.getTime() / 60_000)
    ? anterior
    : agora;
}
