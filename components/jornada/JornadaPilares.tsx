"use client";

import { PILARES, type EstadoJornada, type Pilar } from "@/lib/jornada/estado";
import {
  NOME_PILAR,
  SECAO,
  SO_VOCE_VE,
  glowTotal,
  textoAjudou,
  textoProtegeu,
} from "@/lib/jornada/textos";
import { JornadaBarra, JornadaSecao } from "./JornadaPecas";

const COR_DO_PILAR: Record<Pilar, string> = {
  organizar: "var(--j-pilar-organizar)",
  prosperar: "var(--j-pilar-prosperar)",
  proteger: "var(--j-pilar-proteger)",
  conectar: "var(--j-pilar-conectar)",
};

/**
 * Os 4 pilares: o Glow de cada um (do servidor) e a parte dele no total.
 * Embaixo, quantas disseram que a dica dela ajudou ou protegeu: só ela vê
 * (spec, decisão 12).
 */
export function JornadaPilares({ estado }: { estado: EstadoJornada }) {
  const total = estado.glowTotal;
  const temRetorno = estado.ajudou > 0 || estado.protegeu > 0;
  return (
    <JornadaSecao titulo={SECAO.pilares}>
      <ul className="grid grid-cols-2 gap-3">
        {PILARES.map((pilar) => {
          const valor = estado.glowPorPilar[pilar];
          return (
            <li
              key={pilar}
              className="flex flex-col gap-[6px]"
              style={{
                padding: "12px",
                borderRadius: "var(--radius-sm)",
                background: "var(--j-card-sub)",
              }}
            >
              <span className="font-bold" style={{ fontSize: "13px" }}>
                {NOME_PILAR[pilar]}
              </span>
              <span
                className="tabular-nums"
                style={{ fontSize: "12px", color: "var(--text-muted)" }}
              >
                {glowTotal(valor)}
              </span>
              <JornadaBarra
                fracao={total > 0 ? valor / total : 0}
                cor={COR_DO_PILAR[pilar]}
              />
            </li>
          );
        })}
      </ul>
      {temRetorno && (
        <div
          className="flex flex-col gap-1"
          style={{ fontSize: "12px", color: "var(--text-muted)" }}
        >
          <span className="font-bold" style={{ color: "var(--text)" }}>
            {SO_VOCE_VE}
          </span>
          {estado.ajudou > 0 && <span>{textoAjudou(estado.ajudou)}</span>}
          {estado.protegeu > 0 && <span>{textoProtegeu(estado.protegeu)}</span>}
        </div>
      )}
    </JornadaSecao>
  );
}
