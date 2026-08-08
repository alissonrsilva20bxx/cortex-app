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
    <div className="flex items-start justify-between">
      <div>
        {/* Escala literal do laboratório (page.tsx:256-260): 17px/-0.035em
            título, 10px/-0.01em data — bem mais discreto que o título de
            27px que o app tinha antes. */}
        <h1
          className="font-semibold leading-none"
          style={{
            fontSize: "17px",
            letterSpacing: "-0.035em",
            color: "var(--text)",
          }}
        >
          {greeting}, {firstName}
        </h1>
        <p
          className="capitalize font-medium mt-1 leading-none"
          style={{
            fontSize: "10px",
            letterSpacing: "-0.01em",
            color: "var(--text-muted)",
          }}
        >
          {date}
        </p>
      </div>

      {/* Avatar — dado real (foto/inicial), moldura sóbria do laboratório
          (border-white/[0.07] + bg-white/[0.035], sem glow): brilho só em
          seleção/progresso/ação primária, nunca decorativo. 36px como os
          botões de ícone do laboratório (não é alvo de toque — decorativo,
          sem onClick — então não se aplica a regra de 44px mínimo). */}
      <div
        className="relative flex items-center justify-center rounded-full shrink-0 overflow-hidden"
        style={{
          width: "36px",
          height: "36px",
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
