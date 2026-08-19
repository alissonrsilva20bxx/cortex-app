"use client";

import { Search, Bell, MessageCircle } from "lucide-react";
import { Avatar } from "./Avatar";

interface Props {
  usuarioNome: string;
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
      style={{ width: 44, height: 44, background: "var(--surface)" }}
    >
      {children}
      {!!badge && (
        <span
          className="absolute flex items-center justify-center rounded-full font-bold"
          style={{
            top: -2,
            right: -2,
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
  unreadChats,
  unreadNotifs,
  onSearch,
  onOpenNotifs,
  onOpenChat,
  onOpenMeuEspaco,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-2 mb-5">
      <h2
        className="font-extrabold shrink-0"
        style={{
          fontSize: "26px",
          letterSpacing: "-0.03em",
          color: "var(--text)",
        }}
      >
        Rede
      </h2>

      <div className="flex items-center gap-2">
        <IconButton onClick={onSearch} label="Buscar">
          <Search size={17} style={{ color: "var(--text-muted)" }} />
        </IconButton>
        <IconButton
          onClick={onOpenNotifs}
          label="Notificações"
          badge={unreadNotifs}
        >
          <Bell size={17} style={{ color: "var(--text-muted)" }} />
        </IconButton>
        <IconButton onClick={onOpenChat} label="Conversas" badge={unreadChats}>
          <MessageCircle size={17} style={{ color: "var(--text-muted)" }} />
        </IconButton>
        <Avatar nome={usuarioNome} size="md" onClick={onOpenMeuEspaco} />
      </div>
    </div>
  );
}
