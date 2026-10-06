"use client";

import { Target } from "lucide-react";
import type { Objetivo } from "@/lib/types";
import { InicioCard } from "./InicioCard";

interface Props {
  objetivos: Objetivo[];
  onGoToMetas: () => void;
}

/** Até quantos objetivos a fila de traços mostra um por um. */
const MAX_TRACOS = 8;

/**
 * Card "Objetivos" da grade da Início (Jornada J02, mockup
 * `5-telas-8-temas-claro-escuro.html`): "<concluídos> de <total>" e um
 * traço por objetivo, aceso quando concluído. O modelo continua binário
 * (`concluido`), sem percentual inventado. Tocar leva a Financeiro ›
 * Metas, onde a lista completa é marcada -- a Início só resume.
 */
export function ObjetivosCard({ objetivos, onGoToMetas }: Props) {
  const total = objetivos.length;
  const feitos = objetivos.filter((o) => o.concluido).length;

  if (objetivos.length === 0) {
    return (
      <InicioCard
        onClick={onGoToMetas}
        className="flex flex-col gap-2"
        style={{ padding: "16px" }}
      >
        <Target size={20} style={{ color: "var(--accent-deep)" }} aria-hidden />
        <span
          className="font-semibold"
          style={{ fontSize: "11px", color: "var(--text-muted)" }}
        >
          Objetivos
        </span>
        <span className="font-bold" style={{ fontSize: "13px" }}>
          Adicionar objetivo
        </span>
      </InicioCard>
    );
  }

  return (
    <InicioCard
      onClick={onGoToMetas}
      ariaLabel={`Objetivos: ${feitos} de ${total}`}
      className="flex flex-col gap-2"
      style={{ padding: "16px" }}
    >
      <Target size={20} style={{ color: "var(--accent-deep)" }} aria-hidden />
      <span
        className="font-semibold"
        style={{ fontSize: "11px", color: "var(--text-muted)" }}
      >
        Objetivos
      </span>
      <span
        className="font-extrabold tabular-nums leading-none"
        style={{ fontSize: "20px" }}
      >
        {feitos} de {total}
      </span>
      {total <= MAX_TRACOS ? (
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
          aria-hidden
        >
          {objetivos.map((obj) => (
            <span
              key={obj.id}
              style={{
                height: "5px",
                borderRadius: "var(--radius-pill)",
                background: obj.concluido
                  ? "var(--accent)"
                  : "var(--card-border)",
              }}
            />
          ))}
        </div>
      ) : (
        <div
          aria-hidden
          style={{
            height: "5px",
            borderRadius: "var(--radius-pill)",
            background: "var(--card-border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.round((feitos / total) * 100)}%`,
              height: "5px",
              background: "var(--accent)",
            }}
          />
        </div>
      )}
    </InicioCard>
  );
}
