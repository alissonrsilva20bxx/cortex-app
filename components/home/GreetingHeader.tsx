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
        <p className="text-xl font-bold" style={{ color: "var(--text)" }}>
          {greeting}, {firstName}!
        </p>
        <p
          className="text-sm capitalize mt-0.5"
          style={{ color: "var(--text-muted)" }}
        >
          {date}
        </p>
      </div>

      <div
        className="flex items-center justify-center rounded-full shrink-0 text-sm font-bold overflow-hidden"
        style={{
          width: "44px",
          height: "44px",
          background: usuario.avatarUrl
            ? "transparent"
            : "rgb(var(--accent-rgb) / 0.15)",
          border: "2px solid var(--border-color)",
          color: "var(--accent)",
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
          firstName.charAt(0).toUpperCase()
        )}
      </div>
    </div>
  );
}
