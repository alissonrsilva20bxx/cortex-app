/**
 * Abertura "Rota das metas" (proposta 2, aprovada em motion-atlas.html):
 * os números da rota, extraídos do próprio desenho (que os calcula no
 * navegador com `getPointAtLength`). Ficam aqui prontos para a animação
 * começar já no HTML do servidor, no mesmo relógio do resto da cena, sem
 * esperar a hidratação. Coordenadas no quadro do desenho (390×844).
 *
 * Linha do tempo (4,0 s): os pontos da rota acendem de 0,25 s a 2,75 s com o
 * ✦ viajando por ela; cada parada aparece quando a rota chega nela; o pin
 * de PARIS cai aos 2,75 s; a marca entra aos 3,2 s; a saída começa aos
 * 3,72 s e termina aos 4,0 s.
 */

/** O traçado da rota (viewBox 0 0 390 844). */
export const CAMINHO_DA_ROTA =
  "M60 700 C 70 640, 90 590, 120 560 C 170 510, 240 505, 285 470 C 330 432, 180 392, 110 352 C 60 324, 170 272, 272 250 C 340 236, 270 160, 200 120";

/** Duração total da abertura, em ms (até o fim da saída). */
export const DURACAO_DA_ABERTURA_MS = 4000;
/** Quando a saída começa (ms): 4,0 s menos os 280 ms da transição. */
export const INICIO_DA_SAIDA_MS = 3720;
/** Movimento reduzido: só o quadro final, parado, por pouco tempo (ms). */
export const ABERTURA_ESTATICA_MS = 900;

/** Os 65 pontos da rota: x, y, raio e o atraso (s) em que acendem. */
export const PONTOS_DA_ROTA: readonly (readonly [
  number,
  number,
  number,
  number,
])[] = [
  [60, 700, 2.4, 0.25],
  [62.79, 684.82, 1.6, 0.289],
  [66.1, 669.75, 2.4, 0.328],
  [69.99, 654.81, 1.6, 0.367],
  [74.52, 640.06, 2.4, 0.406],
  [79.75, 625.54, 1.6, 0.445],
  [85.76, 611.33, 2.4, 0.484],
  [92.66, 597.53, 1.6, 0.523],
  [100.55, 584.27, 2.4, 0.563],
  [109.56, 571.74, 1.6, 0.602],
  [119.8, 560.2, 2.4, 0.641],
  [131.19, 549.8, 1.6, 0.68],
  [143.46, 540.45, 2.4, 0.719],
  [156.45, 532.13, 1.6, 0.758],
  [169.99, 524.71, 2.4, 0.797],
  [183.91, 518.06, 1.6, 0.836],
  [198.08, 511.95, 2.4, 0.875],
  [212.39, 506.17, 1.6, 0.914],
  [226.73, 500.46, 2.4, 0.953],
  [240.99, 494.56, 1.6, 0.992],
  [255.03, 488.16, 2.4, 1.031],
  [268.67, 480.93, 1.6, 1.07],
  [281.61, 472.54, 2.4, 1.109],
  [291.98, 461.36, 1.6, 1.148],
  [290.59, 446.62, 2.4, 1.188],
  [280.23, 435.28, 1.6, 1.227],
  [267.64, 426.38, 2.4, 1.266],
  [254.26, 418.69, 1.6, 1.305],
  [240.51, 411.69, 2.4, 1.344],
  [226.54, 405.13, 1.6, 1.383],
  [212.45, 398.84, 2.4, 1.422],
  [198.29, 392.7, 1.6, 1.461],
  [184.1, 386.63, 2.4, 1.5],
  [169.91, 380.55, 1.6, 1.539],
  [155.76, 374.38, 2.4, 1.578],
  [141.7, 368.03, 1.6, 1.617],
  [127.77, 361.39, 2.4, 1.656],
  [114.07, 354.28, 1.6, 1.695],
  [101.51, 345.46, 2.4, 1.734],
  [98.28, 331.12, 1.6, 1.773],
  [106.74, 318.38, 2.4, 1.813],
  [118.56, 308.49, 1.6, 1.852],
  [131.55, 300.16, 2.4, 1.891],
  [145.12, 292.82, 1.6, 1.93],
  [159.06, 286.19, 2.4, 1.969],
  [173.25, 280.13, 1.6, 2.008],
  [187.63, 274.53, 2.4, 2.047],
  [202.17, 269.36, 1.6, 2.086],
  [216.84, 264.57, 2.4, 2.125],
  [231.63, 260.14, 1.6, 2.164],
  [246.51, 256.07, 2.4, 2.203],
  [261.5, 252.36, 1.6, 2.242],
  [276.54, 248.92, 2.4, 2.281],
  [290.53, 242.62, 1.6, 2.32],
  [299.11, 230.19, 2.4, 2.359],
  [298.11, 214.97, 1.6, 2.398],
  [291.73, 200.96, 2.4, 2.438],
  [282.97, 188.26, 1.6, 2.477],
  [272.92, 176.55, 2.4, 2.516],
  [262.02, 165.63, 1.6, 2.555],
  [250.51, 155.36, 2.4, 2.594],
  [238.49, 145.67, 1.6, 2.633],
  [226.05, 136.54, 2.4, 2.672],
  [213.21, 127.97, 1.6, 2.711],
  [200, 120, 2.4, 2.75],
];

/** O ✦ que viaja pela rota: porcentagem do trajeto (2,5 s), x, y. Os
 * mesmos quadros estão em `@keyframes rotaViajante`
 * (components/entry/OpeningMotion.module.css); um teste confere que batem. */
export const QUADROS_DO_VIAJANTE: readonly (readonly [
  number,
  number,
  number,
])[] = [
  [0, 60, 700],
  [2.5, 64.7, 675.8],
  [5, 70.8, 651.8],
  [7.5, 78.6, 628.4],
  [10, 88.4, 605.8],
  [12.5, 100.5, 584.3],
  [15, 115.5, 564.7],
  [17.5, 133.6, 547.8],
  [20, 153.8, 533.7],
  [22.5, 175.5, 522],
  [25, 198.1, 511.9],
  [27.5, 221, 502.8],
  [30, 243.8, 493.3],
  [32.5, 266, 482.5],
  [35, 286.4, 468.7],
  [37.5, 290.6, 446.6],
  [40, 272.8, 429.7],
  [42.5, 251.5, 417.2],
  [45, 229.3, 406.4],
  [47.5, 206.8, 396.4],
  [50, 184.1, 386.6],
  [52.5, 161.4, 376.9],
  [55, 138.9, 366.7],
  [57.5, 116.8, 355.7],
  [60, 98.3, 340.2],
  [62.5, 106.7, 318.4],
  [65, 126.3, 303.4],
  [67.5, 147.9, 291.4],
  [70, 170.4, 281.3],
  [72.5, 193.4, 272.4],
  [75, 216.8, 264.6],
  [77.5, 240.5, 257.7],
  [80, 264.5, 251.7],
  [82.5, 288, 244.3],
  [85, 299.7, 224.1],
  [87.5, 291.7, 201],
  [90, 277.1, 181.1],
  [92.5, 259.8, 163.5],
  [95, 240.9, 147.6],
  [97.5, 221, 133],
  [100, 200, 120],
];

export type IconeDaParada =
  | "inicio"
  | "agenda"
  | "financeiro"
  | "cofre"
  | "jornada";

/** As paradas (abas do app) na ordem da rota; atraso em segundos. */
export const PARADAS: readonly {
  nome: string;
  icone: IconeDaParada;
  x: number;
  y: number;
  atraso: number;
}[] = [
  { nome: "Início", icone: "inicio", x: 60, y: 700, atraso: 0.17 },
  { nome: "Agenda", icone: "agenda", x: 120, y: 560, atraso: 0.56 },
  { nome: "Financeiro", icone: "financeiro", x: 285, y: 470, atraso: 1.04 },
  { nome: "Cofre", icone: "cofre", x: 110, y: 352, atraso: 1.63 },
  { nome: "Jornada", icone: "jornada", x: 272, y: 250, atraso: 2.2 },
];
