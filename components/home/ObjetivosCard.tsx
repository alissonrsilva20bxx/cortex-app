"use client";

import type { Objetivo } from "@/lib/types";
import { InicioCard } from "./InicioCard";
import {
  CARD_PEQUENO,
  IconeCard,
  ROTULO_CARD,
  VALOR_CARD,
} from "./pecasMockup";

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
function IconeObjetivos() {
  return (
    <IconeCard>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </IconeCard>
  );
}

export function ObjetivosCard({ objetivos, onGoToMetas }: Props) {
  const total = objetivos.length;
  const feitos = objetivos.filter((o) => o.concluido).length;

  if (objetivos.length === 0) {
    return (
      <InicioCard onClick={onGoToMetas} style={CARD_PEQUENO}>
        <IconeObjetivos />
        <span style={ROTULO_CARD}>Objetivos</span>
        <span style={{ fontSize: "13px", fontWeight: 700 }}>
          Adicionar objetivo
        </span>
      </InicioCard>
    );
  }

  return (
    <InicioCard
      onClick={onGoToMetas}
      ariaLabel={`Objetivos: ${feitos} de ${total}`}
      style={CARD_PEQUENO}
    >
      <IconeObjetivos />
      <span style={ROTULO_CARD}>Objetivos</span>
      <span style={VALOR_CARD}>
        {feitos} de {total}
      </span>
      {total <= MAX_TRACOS ? (
        // Mockup: `grid; gap:4px`, traços de 5px raio 3; os concluídos
        // acendem primeiro ("1 de 4" = o 1º traço), em `--t-acc`.
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`,
            gap: "4px",
          }}
          aria-hidden
        >
          {objetivos.map((obj, i) => (
            <span
              key={obj.id}
              style={{
                height: "5px",
                borderRadius: "3px",
                background: i < feitos ? "var(--t-acc)" : "var(--t-line)",
              }}
            />
          ))}
        </div>
      ) : (
        <div
          aria-hidden
          style={{
            height: "5px",
            borderRadius: "3px",
            background: "var(--t-line)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.round((feitos / total) * 100)}%`,
              height: "5px",
              background: "var(--t-acc)",
            }}
          />
        </div>
      )}
    </InicioCard>
  );
}
