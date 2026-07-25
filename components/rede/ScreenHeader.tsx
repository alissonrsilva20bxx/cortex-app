"use client";

import { ArrowLeft } from "lucide-react";

/**
 * Cabeçalho compartilhado das subtelas da Rede (Amigas, Chat, Meu espaço,
 * Wishlist, Clientes, Perfil público…). Voltar sempre sobe um nível na
 * pilha — nunca há uma segunda barra de navegação concorrendo com a
 * BottomNav principal.
 */

interface Props {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, action }: Props) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <button
        onClick={onBack}
        aria-label="Voltar"
        className="flex items-center justify-center rounded-full shrink-0 transition-opacity active:opacity-70"
        style={{ width: 40, height: 40, background: "var(--surface)" }}
      >
        <ArrowLeft size={18} style={{ color: "var(--text)" }} />
      </button>
      <h2
        className="font-extrabold flex-1 truncate"
        style={{
          fontSize: "22px",
          letterSpacing: "-0.02em",
          color: "var(--text)",
        }}
      >
        {title}
      </h2>
      {action}
    </div>
  );
}
