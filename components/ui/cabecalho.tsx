"use client";

/**
 * Peças de cabeçalho das telas no visual EXATO do mockup aprovado das 5
 * telas (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html):
 *
 *  - `BotaoNovo`: a pílula "+ Novo" do Início e do Financeiro (38px de
 *    altura, raio 19, 13px/700, acento com texto branco);
 *  - `BotaoRedondo`: os botões redondos de 40px da Agenda e do Cofre
 *    (busca, sino, cadeado);
 *  - `AvatarAjustes`: o avatar de 42px que abre Ajustes.
 *
 * O desenho tem o tamanho do mockup; a área de toque é de 44px (mínimo do
 * app), com margem negativa pra nada sair do lugar.
 */

import type { ReactNode } from "react";

export function BotaoNovo({
  onClick,
  children,
}: {
  onClick: () => void;
  /** O rótulo ("Novo"). */
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-fab-avoid
      className="flex shrink-0 items-center transition-opacity active:opacity-80"
      style={{ minHeight: "44px", margin: "-3px 0" }}
    >
      <span
        className="flex items-center rounded-full font-bold"
        style={{
          height: "38px",
          padding: "0 14px",
          gap: "6px",
          fontSize: "13px",
          // Mockup: texto branco sobre o acento (--t-acc), mesmo onde fica
          // abaixo de 4,5:1 (listado no PR, decisão do operador).
          background: "var(--accent)",
          color: "#fff",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        {children}
      </span>
    </button>
  );
}

export function BotaoRedondo({
  rotulo,
  onClick,
  expandido,
  children,
}: {
  rotulo: string;
  /** Sem ação = desabilitado (a ação não existe no app). */
  onClick?: () => void;
  expandido?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={rotulo}
      aria-expanded={expandido}
      className="flex shrink-0 items-center justify-center active:opacity-70"
      style={{ width: "44px", height: "44px", margin: "-2px" }}
    >
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: "40px",
          height: "40px",
          background: "var(--card-solid)",
          color: "var(--text)",
        }}
      >
        {children}
      </span>
    </button>
  );
}

export function AvatarAjustes({
  inicial,
  foto,
  onClick,
  "aria-label": rotulo,
  "data-tour": tour,
}: {
  inicial: string;
  foto?: string | null;
  onClick: () => void;
  "aria-label": string;
  "data-tour"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      data-tour={tour}
      className="flex shrink-0 items-center justify-center transition-opacity active:opacity-70"
      style={{ width: "44px", height: "44px", margin: "-1px" }}
    >
      <span
        className="relative flex items-center justify-center overflow-hidden rounded-full"
        style={{
          width: "42px",
          height: "42px",
          background: "var(--accent-tint)",
        }}
      >
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" className="h-full w-full object-cover" />
        ) : (
          <span
            className="font-extrabold"
            style={{ fontSize: "15px", color: "var(--accent-deep)" }}
          >
            {inicial}
          </span>
        )}
      </span>
    </button>
  );
}

/** Cadeado do cabeçalho do Cofre, com o traço do mockup. */
export function IconeCadeado({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
