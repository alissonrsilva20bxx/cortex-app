/**
 * Ícones da Rede no modelo Doca (os mesmos do protótipo aprovado,
 * .lavish/rede-doca-final.html): grade 24, traço 2, pontas redondas. Um
 * conjunto só para a barra da Rede, o cabeçalho e as ações do post.
 */

type Props = { size?: number; filled?: boolean; strokeWidth?: number };

function Svg({
  size = 22,
  strokeWidth = 2,
  filled = false,
  children,
}: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flex: "none", display: "block" }}
    >
      {children}
    </svg>
  );
}

export const IconeFeed = (p: Props) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="7" rx="2.5" />
    <rect x="4" y="13" width="16" height="7" rx="2.5" />
  </Svg>
);

export const IconeConversas = (p: Props) => (
  <Svg {...p}>
    <path d="M5 18.8V7.5A3.5 3.5 0 0 1 8.5 4h7A3.5 3.5 0 0 1 19 7.5v5a3.5 3.5 0 0 1-3.5 3.5H9.2z" />
    <path d="M9 9.3h6M9 12.3h3.5" />
  </Svg>
);

export const IconeAmigas = (p: Props) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19.5c.6-3.3 2.9-5.2 5.5-5.2s4.9 1.9 5.5 5.2" />
    <circle cx="16.6" cy="9.4" r="2.5" />
    <path d="M15.9 14.3c2.4.1 4.1 1.7 4.6 4.4" />
  </Svg>
);

export const IconeBusca = (p: Props) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.3" />
    <path d="M15.8 15.8l4 4" />
  </Svg>
);

export const IconeSino = (p: Props) => (
  <Svg {...p}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.4 1.8H4.6z" />
    <path d="M10 20.6a2.1 2.1 0 0 0 4 0" />
  </Svg>
);

export const IconeCasa = (p: Props) => (
  <Svg {...p}>
    <path d="M4.5 11L12 4.6l7.5 6.4v8.2c0 .8-.7 1.3-1.5 1.3h-3.3v-6h-5.4v6H6c-.8 0-1.5-.5-1.5-1.3z" />
  </Svg>
);

export const IconeVoltar = (p: Props) => (
  <Svg {...p}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </Svg>
);

export const IconeMais = (p: Props) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconeCoracao = (p: Props) => (
  <Svg {...p}>
    <path d="M12 20.2s-7.6-4.5-7.6-10.2A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 7.6 2.5c0 5.7-7.6 10.2-7.6 10.2z" />
  </Svg>
);

export const IconeComentario = (p: Props) => (
  <Svg {...p}>
    <path d="M20 11.5c0 3.9-3.6 7-8 7-1.2 0-2.4-.2-3.4-.7L4.5 19.3l1.3-3.4A6.6 6.6 0 0 1 4 11.5c0-3.9 3.6-7 8-7s8 3.1 8 7z" />
  </Svg>
);

export const IconeEnviar = (p: Props) => (
  <Svg {...p}>
    <path d="M20.5 3.5l-17 7.2 7.1 2.7 2.8 7.1z" />
    <path d="M10.6 13.4l4.2-4.2" />
  </Svg>
);

export const IconeReticencias = ({ size = 22 }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
    style={{ flex: "none", display: "block" }}
  >
    <circle cx="6" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="18" cy="12" r="1.6" />
  </svg>
);

export const IconeCamera = (p: Props) => (
  <Svg {...p}>
    <rect x="3.5" y="6.5" width="17" height="13" rx="3.5" />
    <circle cx="12" cy="13" r="3.4" />
    <path d="M9 6.5l1.2-2h3.6l1.2 2" />
  </Svg>
);
