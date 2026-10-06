"use client";

import { useEffect, type RefObject } from "react";

/**
 * #176 — o teclado do celular cobria o campo ativo nos formulários em sheet
 * (Novo atendimento, Nova Despesa, Nova Entrada).
 *
 * Duas causas, uma por plataforma:
 * - **iPhone (Safari):** o teclado não redimensiona a janela; ele cobre a
 *   parte de baixo dela. Um sheet `position: fixed; bottom: 0` fica atrás do
 *   teclado. Só o `visualViewport` sabe a área que sobrou.
 * - **Android (Chrome) e iPhone:** mesmo com o sheet visível, nada rolava a
 *   área interna até o campo focado. O campo podia estar abaixo da dobra.
 *
 * O efeito escreve duas variáveis CSS no painel, só enquanto o teclado está
 * aberto (recuo maior que zero):
 * - `--teclado-inset`: quanto o teclado cobre a janela (vira o `bottom`);
 * - `--teclado-altura-util`: a altura que sobrou (limita o `maxHeight`).
 * Sem teclado, as variáveis não existem e o painel usa exatamente os mesmos
 * valores de antes (os `var(..., fallback)` do componente).
 *
 * E, a cada foco num campo e a cada mudança da área visível, rola só o
 * container rolável do próprio sheet até o campo ficar inteiro à vista.
 * Nunca rola a página por trás nem chama `scrollIntoView` (que também
 * rolaria a janela).
 *
 * Toda a lógica mora em funções comuns, exportadas e testadas executando:
 * as contas (`recuoDoTeclado`, `variaveisDoTeclado`, `areaVisivel`,
 * `deslocamentoParaMostrar`) e o próprio efeito (`instalarCampoVisivel`),
 * que recebe a janela por parâmetro. O hook só liga o efeito ao React.
 */

/** Folga entre o campo e a borda da área visível. */
export const MARGEM_CAMPO_PX = 16;

/** As variáveis CSS que o efeito escreve no painel (e remove). */
export const VARIAVEIS_TECLADO = [
  "--teclado-inset",
  "--teclado-altura-util",
] as const;

const SELETOR_CAMPO = "input, textarea, select";

export interface Faixa {
  top: number;
  bottom: number;
}

/** O que o efeito usa do `visualViewport`. */
export interface ViewportVisivel {
  height: number;
  offsetTop: number;
  addEventListener(tipo: string, ouvinte: () => void): void;
  removeEventListener(tipo: string, ouvinte: () => void): void;
}

/** O que o efeito usa de um elemento (campo ou container). */
export interface ElementoDoSheet {
  parentElement: ElementoDoSheet | null;
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
  getBoundingClientRect(): Faixa;
  matches(seletor: string): boolean;
}

/** O que o efeito usa do painel do sheet. */
export interface PainelDoSheet extends ElementoDoSheet {
  style: {
    setProperty(nome: string, valor: string): void;
    removeProperty(nome: string): unknown;
  };
  contains(outro: unknown): boolean;
  addEventListener(tipo: string, ouvinte: () => void): void;
  removeEventListener(tipo: string, ouvinte: () => void): void;
}

/** O que o efeito usa da janela (`window` em produção; um falso no teste). */
export interface JanelaDoSheet {
  innerHeight: number;
  visualViewport: ViewportVisivel | null;
  document: { activeElement: unknown };
  addEventListener(tipo: string, ouvinte: () => void): void;
  removeEventListener(tipo: string, ouvinte: () => void): void;
  requestAnimationFrame(cb: () => void): number;
  cancelAnimationFrame(id: number): void;
  getComputedStyle(el: ElementoDoSheet): { overflowY: string };
}

/**
 * Quanto o teclado cobre a janela, em px. `0` quando não há teclado (ou o
 * navegador redimensiona a janela inteira, como o Chrome do Android).
 */
export function recuoDoTeclado(
  alturaJanela: number,
  viewport: { height: number; offsetTop: number } | null | undefined
): number {
  if (!viewport) return 0;
  return Math.max(
    0,
    Math.round(alturaJanela - (viewport.offsetTop + viewport.height))
  );
}

/**
 * Os valores das variáveis CSS com o teclado aberto, ou `null` sem teclado.
 * A altura útil é a do `visualViewport` (o que sobra acima do teclado), não
 * a da janela: com a da janela o sheet subiria 336px sem encolher e o topo
 * (título e "fechar") sairia da tela.
 */
export function variaveisDoTeclado(
  alturaJanela: number,
  viewport: { height: number; offsetTop: number } | null | undefined
): Record<(typeof VARIAVEIS_TECLADO)[number], string> | null {
  const recuo = recuoDoTeclado(alturaJanela, viewport);
  if (!viewport || recuo <= 0) return null;
  return {
    "--teclado-inset": `${recuo}px`,
    "--teclado-altura-util": `${Math.round(viewport.height)}px`,
  };
}

/**
 * A parte do container que a usuária vê de fato: o container cortado pelo
 * `visualViewport` (em cima e embaixo). Sem `visualViewport`, cortado pela
 * janela.
 */
export function areaVisivel(
  container: Faixa,
  viewport: { height: number; offsetTop: number } | null | undefined,
  alturaJanela: number
): Faixa {
  const desde = viewport ? viewport.offsetTop : 0;
  const ate = viewport ? viewport.offsetTop + viewport.height : alturaJanela;
  return {
    top: Math.max(container.top, desde),
    bottom: Math.min(container.bottom, ate),
  };
}

/**
 * Quanto rolar o container (positivo = pra baixo) pra o campo caber inteiro
 * na área visível com folga. `0` se já cabe. Campo maior que a área: alinha
 * pelo topo.
 */
export function deslocamentoParaMostrar(
  campo: Faixa,
  area: Faixa,
  margem: number = MARGEM_CAMPO_PX
): number {
  const topoLivre = area.top + margem;
  const baseLivre = area.bottom - margem;
  if (campo.bottom - campo.top > baseLivre - topoLivre) {
    return campo.top - topoLivre;
  }
  if (campo.bottom > baseLivre) return campo.bottom - baseLivre;
  if (campo.top < topoLivre) return campo.top - topoLivre;
  return 0;
}

function limparVariaveis(painel: PainelDoSheet): void {
  for (const nome of VARIAVEIS_TECLADO) painel.style.removeProperty(nome);
}

function containerRolavel(
  campo: ElementoDoSheet,
  painel: PainelDoSheet,
  janela: JanelaDoSheet
): ElementoDoSheet | null {
  for (let el = campo.parentElement; el; el = el.parentElement) {
    const { overflowY } = janela.getComputedStyle(el);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight
    ) {
      return el;
    }
    if (el === painel) break;
  }
  return null;
}

function ehCampoDoPainel(
  ativo: unknown,
  painel: PainelDoSheet
): ativo is ElementoDoSheet {
  return (
    typeof ativo === "object" &&
    ativo !== null &&
    typeof (ativo as ElementoDoSheet).matches === "function" &&
    painel.contains(ativo) &&
    (ativo as ElementoDoSheet).matches(SELETOR_CAMPO)
  );
}

/**
 * O efeito inteiro: ouve o `visualViewport`, a janela e o foco no painel,
 * escreve as variáveis e rola o container até o campo focado. Devolve a
 * limpeza (remove ouvintes e variáveis).
 */
export function instalarCampoVisivel(
  painel: PainelDoSheet,
  janela: JanelaDoSheet
): () => void {
  let quadro: number | null = null;

  function atualizar() {
    quadro = null;
    const vv = janela.visualViewport;
    const variaveis = variaveisDoTeclado(janela.innerHeight, vv);
    if (variaveis) {
      for (const nome of VARIAVEIS_TECLADO) {
        painel.style.setProperty(nome, variaveis[nome]);
      }
    } else {
      limparVariaveis(painel);
    }

    const ativo = janela.document.activeElement;
    if (!ehCampoDoPainel(ativo, painel)) return;
    const rolavel = containerRolavel(ativo, painel, janela);
    if (!rolavel) return;
    const delta = deslocamentoParaMostrar(
      ativo.getBoundingClientRect(),
      areaVisivel(rolavel.getBoundingClientRect(), vv, janela.innerHeight)
    );
    if (delta !== 0) rolavel.scrollTop += delta;
  }

  function agendar() {
    if (quadro === null) quadro = janela.requestAnimationFrame(atualizar);
  }

  const vv = janela.visualViewport;
  vv?.addEventListener("resize", agendar);
  vv?.addEventListener("scroll", agendar);
  janela.addEventListener("resize", agendar);
  painel.addEventListener("focusin", agendar);
  agendar();

  return () => {
    if (quadro !== null) janela.cancelAnimationFrame(quadro);
    vv?.removeEventListener("resize", agendar);
    vv?.removeEventListener("scroll", agendar);
    janela.removeEventListener("resize", agendar);
    painel.removeEventListener("focusin", agendar);
    limparVariaveis(painel);
  };
}

export function useCampoVisivelComTeclado(
  painelRef: RefObject<HTMLElement | null>,
  aberto: boolean
): void {
  useEffect(() => {
    const painel = painelRef.current;
    if (!aberto || !painel) return;
    return instalarCampoVisivel(painel, window);
  }, [painelRef, aberto]);
}
