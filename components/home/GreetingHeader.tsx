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
          className="font-extrabold leading-none"
          style={{
            fontSize: "27px",
            letterSpacing: "-0.03em",
            color: "var(--text)",
          }}
        >
          {greeting}, {firstName}!
        </h1>
        <p
          className="capitalize font-medium mt-1.5"
          style={{ fontSize: "13px", color: "var(--text-muted)" }}
        >
          {date}
        </p>
      </div>

      {/* Avatar with accent glow ring */}
      <div
        className="relative flex items-center justify-center rounded-full shrink-0 overflow-hidden"
        style={{
          width: "46px",
          height: "46px",
          border: "1.5px solid var(--accent)",
          boxShadow:
            "0 0 0 3px rgb(var(--accent-rgb) / 0.1), 0 0 16px rgb(var(--accent-rgb) / 0.28)",
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
