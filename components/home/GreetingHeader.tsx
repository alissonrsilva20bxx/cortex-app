import { useMemo } from "react";
import type { Usuario } from "@/lib/types";

interface Props {
  usuario: Usuario;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function getFirstName(nome: string): string {
  return nome.split(" ")[0];
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function GreetingHeader({ usuario }: Props) {
  const greeting = useMemo(getGreeting, []);
  const date = useMemo(getFormattedDate, []);
  const firstName = getFirstName(usuario.nome);

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1
          className="font-bold leading-[30px]"
          style={{
            fontSize: "24px",
            letterSpacing: "-0.03em",
            color: "var(--text)",
          }}
        >
          {greeting}, {firstName}
        </h1>
        <p
          className="capitalize font-medium mt-1 leading-[18px]"
          style={{ fontSize: "13px", color: "var(--text-muted)" }}
        >
          {date}
        </p>
      </div>

      {/* Avatar — dado real (foto/inicial), moldura sóbria (sem glow),
          seguindo a disciplina do laboratório: brilho só em seleção/
          progresso/ação primária, nunca decorativo. */}
      <div
        className="relative flex items-center justify-center rounded-full shrink-0 overflow-hidden"
        style={{
          width: "44px",
          height: "44px",
          border: "1px solid var(--border-color)",
          background: "var(--surface)",
        }}
      >
        {usuario.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={usuario.avatarUrl}
            alt={usuario.nome}
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            className="text-sm font-bold"
            style={{ color: "var(--accent)" }}
          >
            {firstName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}
