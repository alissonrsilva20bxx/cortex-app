/**
 * Ícones da Agenda com o traço EXATO do mockup aprovado
 * (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html, layout C).
 * Os do lucide-react são parecidos mas não iguais (raio da lupa, cabo,
 * barras do gráfico, balão): a perfeição de pixel pede o desenho de lá.
 * Só forma; quem usa decide tamanho e cor (currentColor).
 */

import type { ReactNode } from "react";

function Svg({
  size,
  strokeWidth = 2,
  children,
}: {
  size: number;
  strokeWidth?: number;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

export const IconeBusca = ({ size = 20 }: P) => (
  <Svg size={size}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const IconeSino = ({ size = 20 }: P) => (
  <Svg size={size}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Svg>
);

export const IconeMais = ({ size = 22 }: P) => (
  <Svg size={size}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconeBloquear = ({ size = 22 }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  </Svg>
);

export const IconeResumo = ({ size = 22 }: P) => (
  <Svg size={size}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);

export const IconeAnotacoes = ({ size = 22 }: P) => (
  <Svg size={size}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z" />
    <path d="M8 11h8M8 14h5" />
  </Svg>
);

export const IconeConcluido = ({ size = 18 }: P) => (
  <Svg size={size}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);

export const IconeAgendado = ({ size = 18 }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Svg>
);
