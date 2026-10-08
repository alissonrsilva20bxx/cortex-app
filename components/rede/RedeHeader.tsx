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
        // A referência marca "tem coisa nova" com um PONTO de 8px no
        // acento, não com um número: `top:6 right:7; width:8; height:8;
        // border-radius:50%; background: var(--t-acc)`. O número ficava
        // maior que o ponto e com outra cor, e aparecia em toda abertura
        // da tela. A contagem continua acessível onde ela importa, dentro
        // de cada folha (notificações e conversas).
        <span
          aria-hidden
          className="absolute rounded-full"
          style={{
            top: 6,
            right: 7,
            width: 8,
            height: 8,
            background: "var(--accent)",
          }}
        />
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
    <div
      className="flex items-center justify-between gap-2"
      style={{ marginBottom: "12px" }}
    >
      {/* Jornada J06 (mockup 5-telas-8-temas-claro-escuro.html, tela Rede):
          título 24px/800, -0.5px. */}
      <h2
        className="font-extrabold shrink-0"
        style={{
          fontSize: "24px",
          // A referência não declara line-height no título: ele herda 1.1 do
          // corpo da tela. No app a herança vinha de 1.5 (36px), o que
          // empurrava o cabeçalho e tudo abaixo dele.
          lineHeight: 1.1,
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
