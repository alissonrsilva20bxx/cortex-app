/**
 * Ícones da barra pílula com o traço EXATO do mockup aprovado das 5 telas
 * (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html, `.b2`).
 * Os do lucide-react são parecidos mas não iguais (a casa, a carteira, o
 * escudo): a perfeição de pixel pede o desenho de lá. Mesma assinatura do
 * lucide (`size`, `strokeWidth`), pra a barra trocar um pelo outro.
 */

import type { ReactNode } from "react";

export interface IconeNavProps {
  size?: number;
  strokeWidth?: number;
}

function Svg({
  size = 22,
  strokeWidth = 2,
  children,
}: IconeNavProps & { children: ReactNode }) {
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

export const IconeInicio = (p: IconeNavProps) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </Svg>
);

export const IconeAgenda = (p: IconeNavProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);

export const IconeFinanceiro = (p: IconeNavProps) => (
  <Svg {...p}>
    <path d="M20 7H5a2 2 0 0 1 0-4h13v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15V7" />
    <path d="M16 14h.01" />
  </Svg>
);

export const IconeCofre = (p: IconeNavProps) => (
  <Svg {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

export const IconeRede = (p: IconeNavProps) => (
  <Svg {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);
