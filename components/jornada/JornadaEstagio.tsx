"use client";

import { Sparkles } from "lucide-react";
import type { EstadoJornada } from "@/lib/jornada/estado";
import {
  NOME_GLOW,
  NOTA,
  glowAteProximo,
  nomeEstagio,
  numero,
  rotuloEstagio,
} from "@/lib/jornada/textos";
import { JornadaBarra } from "./JornadaPecas";
import { faltaProProximo, fracaoDoEstagio } from "./progresso";

/**
 * O topo da tela: estágio, Glow total e quanto falta pro próximo estágio.
 * Os números são os do servidor; a tela só escreve.
 */
export function JornadaEstagio({ estado }: { estado: EstadoJornada }) {
  const proximo = estado.estagio + 1;
  return (
    <section
      className="flex flex-col gap-3"
      style={{
        padding: "20px",
        borderRadius: "var(--radius-lg)",
        background: "var(--j-hero-bg)",
        color: "var(--j-hero-texto)",
      }}
    >
      <div>
        <p
          className="font-semibold"
          style={{ fontSize: "12px", color: "var(--j-hero-texto-2)" }}
        >
          {rotuloEstagio(estado.estagio)}
        </p>
        <p className="font-extrabold" style={{ fontSize: "24px" }}>
          {nomeEstagio(estado.estagio)}
        </p>
      </div>
      <p className="flex items-center gap-2">
        <Sparkles size={22} aria-hidden />
        <span
          className="font-extrabold tabular-nums leading-none"
          style={{ fontSize: "34px" }}
        >
          {numero(estado.glowTotal)}
        </span>
        <span
          className="font-semibold"
          style={{ fontSize: "14px", color: "var(--j-hero-texto-2)" }}
        >
          {NOME_GLOW}
        </span>
      </p>
      <JornadaBarra
        fracao={fracaoDoEstagio(estado)}
        trilho="var(--j-hero-trilho)"
        cor="var(--j-hero-progresso)"
        altura={8}
      />
      <p style={{ fontSize: "13px", color: "var(--j-hero-texto-2)" }}>
        {glowAteProximo(faltaProProximo(estado), proximo)}
      </p>
      <p
        className="leading-snug"
        style={{ fontSize: "12px", color: "var(--j-hero-texto-2)" }}
      >
        {NOTA.estagio}
      </p>
    </section>
  );
}
