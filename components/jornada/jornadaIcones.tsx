/**
 * Ícones do card da Jornada no Início com o traço EXATO do protótipo
 * aprovado (docs/jornada/referencias/prototipo-sua-jornada.html, `P` e
 * `ic()`): o ícone de cada estágio e o enfeite de cada mês. Os do
 * lucide-react são parecidos mas não iguais; a perfeição de pixel pede o
 * desenho de lá. Só forma; quem usa decide tamanho, traço e cor.
 */

import type { ReactNode } from "react";

function Svg({
  size,
  strokeWidth,
  children,
}: {
  size: number;
  strokeWidth: number;
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
      // `.ph svg{flex-shrink:0;display:block}` do protótipo.
      style={{ flexShrink: 0, display: "block" }}
    >
      {children}
    </svg>
  );
}

const PATHS: Record<string, ReactNode> = {
  chev: <path d="m9 18 6-6-6-6" />,
  shieldp: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  cal: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  receipt: (
    <>
      <path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z" />
      <path d="M8 9h8M8 13h6" />
    </>
  ),
  spark: (
    <path d="M12 3l1.9 5.6a2 2 0 0 0 1.3 1.3L21 12l-5.8 2.1a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.6a2 2 0 0 0-1.3-1.3L3 12l5.8-2.1a2 2 0 0 0 1.3-1.3z" />
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
  ),
  sprout: (
    <>
      <path d="M7 20h10M12 20v-8" />
      <path d="M12 12C12 8 9 6 5 6c0 4 3 6 7 6zM12 12c0-3 2-6 7-6 0 4-3 6-7 6z" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
    </>
  ),
  palette: (
    <>
      <circle cx="13.5" cy="6.5" r="1" />
      <circle cx="17.5" cy="10.5" r="1" />
      <circle cx="8.5" cy="7.5" r="1" />
      <circle cx="6.5" cy="12.5" r="1" />
      <path d="M12 2a10 10 0 0 0 0 20c1 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7H16a6 6 0 0 0 6-6C22 6 17.5 2 12 2z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  pulse: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  coins: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.1 10.4A6 6 0 1 1 10.3 18" />
      <path d="M7 6h1v4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  star: (
    <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
  ),
  layers: (
    <>
      <path d="m12 2 10 5-10 5L2 7z" />
      <path d="m2 12 10 5 10-5M2 17l10 5 10-5" />
    </>
  ),
  crown: <path d="m2 7 5 4 5-7 5 7 5-4-2 12H4z" />,
};

/** `STAGES[].ic` do protótipo: Começando, Em movimento, Organizada,
 * Prosperando, Icônica (e os níveis depois dela ficam com a coroa). */
const DO_ESTAGIO = ["sprout", "pulse", "layers", "star", "crown"];

/** `ORN[mes][1]` do protótipo: o enfeite de janeiro a dezembro. */
const DO_MES = [
  "spark",
  "heart",
  "sprout",
  "bulb",
  "palette",
  "sun",
  "pulse",
  "coins",
  "bell",
  "moon",
  "sprout",
  "star",
];

export function IconeDoEstagio({ estagio }: { estagio: number }) {
  const nome = DO_ESTAGIO[Math.min(estagio, DO_ESTAGIO.length - 1)];
  return (
    <Svg size={22} strokeWidth={2.2}>
      {PATHS[nome]}
    </Svg>
  );
}

/** `mes` de 1 a 12, como no estado da Jornada. */
export function IconeDoEnfeite({ mes }: { mes: number }) {
  return (
    <Svg size={13} strokeWidth={2.2}>
      {PATHS[DO_MES[mes - 1] ?? "spark"]}
    </Svg>
  );
}

export function IconeSeta() {
  return (
    <Svg size={20} strokeWidth={2}>
      {PATHS.chev}
    </Svg>
  );
}

/** Um ícone do `P` do protótipo, com o tamanho e o traço de quem usa
 * (`ic(nome, tamanho, traço)`). */
export function IconeDoPrototipo({
  nome,
  tamanho,
  traco,
}: {
  nome: string;
  tamanho: number;
  traco: number;
}) {
  return (
    <Svg size={tamanho} strokeWidth={traco}>
      {PATHS[nome]}
    </Svg>
  );
}

/** `icf('spark', n)` do protótipo: a faísca cheia, sem traço. */
export function FaiscaCheia({ tamanho }: { tamanho: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      {PATHS.spark}
    </svg>
  );
}
