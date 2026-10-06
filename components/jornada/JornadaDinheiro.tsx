"use client";

import { Check, Lock } from "lucide-react";
import { MARCOS_DINHEIRO, type EstadoJornada } from "@/lib/jornada/estado";
import {
  MARCOS_DO_TOTAL,
  SECAO,
  contagemMetas,
  money,
  textoMarco,
} from "@/lib/jornada/textos";
import { JornadaSecao } from "./JornadaPecas";

/**
 * Seu dinheiro: quantas metas ela concluiu e os marcos do total guardado
 * (€ 500, € 1.000, € 2.500, € 5.000; spec §7). O que acende é o que o
 * servidor mandou em `marcos`.
 */
export function JornadaDinheiro({ estado }: { estado: EstadoJornada }) {
  return (
    <JornadaSecao
      titulo={SECAO.dinheiro}
      chip={contagemMetas(estado.metasConcluidas)}
    >
      <p
        className="font-semibold"
        style={{ fontSize: "11px", color: "var(--text-muted)" }}
      >
        {MARCOS_DO_TOTAL}
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {MARCOS_DINHEIRO.map((marco) => {
          const batido = estado.marcos.includes(marco);
          const Icone = batido ? Check : Lock;
          return (
            <li
              key={marco}
              aria-label={textoMarco(marco)}
              className="flex items-center gap-2 font-bold tabular-nums"
              style={{
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                fontSize: "13px",
                background: batido ? "var(--j-selo-bg)" : "var(--j-card-sub)",
                color: batido ? "var(--j-selo-icone)" : "var(--text-muted)",
              }}
            >
              <Icone size={14} aria-hidden />
              <span aria-hidden>{money(marco)}</span>
            </li>
          );
        })}
      </ul>
    </JornadaSecao>
  );
}
