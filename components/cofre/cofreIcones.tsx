/**
 * Ícones do Cofre com o traço EXATO da referência
 * (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html, layout C).
 * Os do lucide-react são parecidos mas não iguais (escudo com o "check"
 * dentro, seta de enviar, folha com linhas, balão, pasta, miniatura de
 * imagem, seta da linha): a perfeição de pixel pede o desenho de lá.
 * Só forma; quem usa decide tamanho e cor (currentColor).
 *
 * Mesma convenção dos ícones da Agenda (components/jobs/agendaIcones.tsx).
 */

import type { CSSProperties, ReactNode } from "react";

function Svg({
  size,
  strokeWidth = 2,
  className,
  style,
  children,
}: {
  size: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <svg
      className={className}
      style={style}
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

type P = { size?: number; className?: string; style?: CSSProperties };

/** Escudo com o "check" dentro -- o orbe do card "Protegido". */
export const IconeEscudo = ({ size = 26, ...r }: P) => (
  <Svg size={size} strokeWidth={2.2} {...r}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

/** Seta para cima sobre a linha -- azulejo "Enviar". */
export const IconeEnviar = ({ size = 22, ...r }: P) => (
  <Svg size={size} {...r}>
    <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
  </Svg>
);

/** Folha com dobra e duas linhas -- azulejo "Comprovantes". */
export const IconeComprovante = ({ size = 22, ...r }: P) => (
  <Svg size={size} {...r}>
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Svg>
);

/** Balão -- azulejo "Conversas". */
export const IconeConversa = ({ size = 22, ...r }: P) => (
  <Svg size={size} {...r}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z" />
  </Svg>
);

/** Pasta -- azulejo "Documentos". */
export const IconePasta = ({ size = 22, ...r }: P) => (
  <Svg size={size} {...r}>
    <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
  </Svg>
);

/** Pessoa -- azulejo "Pessoal" (só no app; a referência não desenha esta
 *  categoria, então usa-se o mesmo traço do avatar dela). */
export const IconePessoa = ({ size = 22, ...r }: P) => (
  <Svg size={size} {...r}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);

/** Miniatura de imagem -- o quadradinho de cada linha de arquivo. */
export const IconeArquivoImagem = ({ size = 20, ...r }: P) => (
  <Svg size={size} {...r}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-5-5L5 21" />
  </Svg>
);

/** Seta ">" no fim da linha de arquivo. */
export const IconeSeta = ({ size = 16, ...r }: P) => (
  <Svg size={size} {...r}>
    <path d="m9 18 6-6-6-6" />
  </Svg>
);
