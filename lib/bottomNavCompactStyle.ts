/**
 * Valores de forma da BottomNav para os estados expandido/compacto —
 * pílula 2 "Recolhe pra aba atual" (escolhida no /visualize em
 * 01/10/2026, entre 5 variantes de pílula flutuante estilo Instagram):
 * aberta, é a pílula com as 5 abas e o "+" redondo AO LADO, na mesma
 * linha; rolando pra baixo, a pílula recolhe numa bolinha só com o ícone
 * da aba atual e o "+" diminui junto. Tocar na bolinha (ou rolar pra
 * cima) abre de novo. Nada desliza pra fora da tela — só um acomodo de
 * poucos px (o bug antigo usava `translateY(42%)`, que lia como
 * "esconder", não "compactar").
 *
 * Medidas e cores = as do mockup aprovado das 5 telas (`.b2` em
 * docs/jornada/referencias/5-telas-8-temas-claro-escuro.html): pílula de
 * 288×60 em vidro do tema, abas de 46×44 (a ativa 54×44, sem brilho),
 * "+" de 60, recolhida em 50, tudo a 22px do fundo. O vidro e a sombra
 * são os mesmos aberta e recolhida (tokens --glass*).
 *
 * Extraído como dado puro (em vez de inline no componente) pra poder ser
 * testado sem depender de DOM/React.
 */

export interface BottomNavCompactStyle {
  /** `true` = pílula recolhida numa bolinha só com a aba atual. */
  collapsed: boolean;
  /** Altura da pílula, em px — recolhida, também é a largura (círculo). */
  pillHeight: number;
  /** Lado do botão "+" ao lado da pílula, em px. */
  fabSize: number;
  /** Acomodo vertical sutil, em px — não é um recolhimento pra fora da tela. */
  translateY: number;
  /** `box-shadow` completo (o do mockup, igual aberta e recolhida). */
  shadow: string;
}

/**
 * Touch target mínimo (WCAG 2.5.5 / fb6b6c9) — vale para TODOS os botões
 * em QUALQUER estado: os 5 botões da pílula aberta, a bolinha recolhida e
 * o "+" (aberto ou compacto) nunca ficam abaixo disso.
 */
export const BOTTOM_NAV_MIN_TOUCH_TARGET = 44;

/** Largura do botão da aba ativa na pílula aberta (mockup: 54). */
export const BOTTOM_NAV_ACTIVE_WIDTH = 54;

/** Largura das outras abas na pílula aberta (mockup: 46×44). */
export const BOTTOM_NAV_ITEM_WIDTH = 46;

/** Largura da pílula aberta (mockup: 288, fixa). */
export const BOTTOM_NAV_PILL_WIDTH = 288;

/** Distância da pílula e do "+" até o fundo da tela (mockup: 22). */
export const BOTTOM_NAV_OFFSET = 22;

/** Respiro da linha até as bordas da tela, e entre a pílula e o "+". */
export const BOTTOM_NAV_EDGE = 16;
export const BOTTOM_NAV_GAP = 10;

export const BOTTOM_NAV_EXPANDED: BottomNavCompactStyle = {
  collapsed: false,
  pillHeight: 60,
  fabSize: 60,
  translateY: 0,
  shadow: "0 10px 30px var(--glass-shadow)",
};

export const BOTTOM_NAV_COMPACT: BottomNavCompactStyle = {
  collapsed: true,
  pillHeight: 50,
  fabSize: 50,
  translateY: 0,
  shadow: "0 10px 30px var(--glass-shadow)",
};

export function getBottomNavCompactStyle(
  compact: boolean
): BottomNavCompactStyle {
  return compact ? BOTTOM_NAV_COMPACT : BOTTOM_NAV_EXPANDED;
}

/** Curva/duração compartilhadas pela pílula e pelo "+" (mesmo movimento). */
export const BOTTOM_NAV_EASE = "cubic-bezier(0.3, 0.8, 0.25, 1)";
export const BOTTOM_NAV_DURATION_MS = 420;
