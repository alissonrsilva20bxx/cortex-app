"use client";

import { ChevronRight } from "lucide-react";

/**
 * Bloco contextual que se mistura ao Feed ("duas solicitações de amizade",
 * "desejo perto da meta"...). Deliberadamente discreto — mesma altura de um
 * post curto, nunca um banner que domina a rolagem.
 *
 * Modelo Doca (protótipo aprovado .lavish/rede-doca-final.html): fundo no
 * tom do acento, o ícone num quadrado da cor do cartão, título forte e a
 * seta à direita. O cartão inteiro é o alvo de toque.
 */

interface Props {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}

export function ContextualBlock({ icon, title, subtitle, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-aviso-feed=""
      className="flex items-center w-full text-left transition-transform active:scale-[0.98]"
      style={{
        gap: 12,
        minHeight: 64,
        padding: "12px 10px 12px 12px",
        borderRadius: 22,
        background: "var(--accent-tint)",
      }}
    >
      <span
        className="grid place-items-center shrink-0"
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          background: "var(--card-solid)",
          color: "var(--accent-deep-2)",
        }}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span
          className="block truncate"
          style={{ fontSize: "14.5px", fontWeight: 800, color: "var(--text)" }}
        >
          {title}
        </span>
        <span
          className="block truncate"
          style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}
        >
          {subtitle}
        </span>
      </span>
      <ChevronRight
        size={18}
        className="shrink-0"
        style={{ color: "var(--text-muted)" }}
      />
    </button>
  );
}
