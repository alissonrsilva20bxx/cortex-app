"use client";

import { Search, Bell, MessageCircle } from "lucide-react";
import { Avatar } from "./Avatar";

interface Props {
  usuarioNome: string;
  usuarioFotoUrl: string | null;
  unreadChats: number;
  unreadNotifs: number;
  onSearch: () => void;
  onOpenNotifs: () => void;
  onOpenChat: () => void;
  onOpenMeuEspaco: () => void;
}

function IconButton({
  onClick,
  children,
  badge,
  label,
}: {
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative flex items-center justify-center rounded-full transition-opacity active:opacity-70"
      // O círculo que se vê tem os 40px do mockup; o botão fica com 44 de
      // alvo de toque e margem negativa de 2px, a mesma receita já aprovada
      // no #198 (JornadaScreen) -- assim o desenho é o do mockup sem perder
      // o mínimo de toque.
      style={{ width: 44, height: 44, margin: -2 }}
    >
      <span
        aria-hidden
        className="absolute flex items-center justify-center rounded-full"
        style={{ width: 40, height: 40, background: "var(--surface-sub)" }}
      >
        {children}
      </span>
      {!!badge && (
        <span
          className="absolute flex items-center justify-center rounded-full font-bold"
          style={{
            top: 0,
            right: 0,
            minWidth: 16,
            height: 16,
            padding: "0 3px",
            fontSize: 9,
            background: "var(--danger)",
            color: "#fff",
            boxShadow: "0 0 0 2px var(--bg)",
          }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

export function RedeHeader({
  usuarioNome,
  usuarioFotoUrl,
  unreadChats,
  unreadNotifs,
  onSearch,
  onOpenNotifs,
  onOpenChat,
  onOpenMeuEspaco,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-2" style={{ marginBottom: "14px" }}>
      {/* Jornada J06 (mockup 5-telas-8-temas-claro-escuro.html, tela Rede):
          título 24px/800, -0.5px. */}
      <h2
        className="font-extrabold shrink-0"
        style={{
          fontSize: "24px",
          letterSpacing: "-0.5px",
          color: "var(--text)",
        }}
      >
        Rede
      </h2>

      <div className="flex items-center gap-2">
        <IconButton onClick={onSearch} label="Buscar">
          <Search size={20} style={{ color: "var(--text)" }} />
        </IconButton>
        <IconButton
          onClick={onOpenNotifs}
          label="Notificações"
          badge={unreadNotifs}
        >
          <Bell size={20} style={{ color: "var(--text)" }} />
        </IconButton>
        <IconButton onClick={onOpenChat} label="Conversas" badge={unreadChats}>
          <MessageCircle size={20} style={{ color: "var(--text)" }} />
        </IconButton>
        {/* Alvo do tour do app (lib/appTour.ts, passo "rede-perfil"). */}
        <span data-tour="rede-perfil" className="inline-flex rounded-full">
          <Avatar
            nome={usuarioNome}
            fotoUrl={usuarioFotoUrl}
            size="md"
            onClick={onOpenMeuEspaco}
          />
        </span>
      </div>
    </div>
  );
}
