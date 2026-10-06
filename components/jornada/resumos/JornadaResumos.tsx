"use client";

import { useState } from "react";
import { TIPOS_PERIODO, type TipoPeriodo } from "@/lib/jornada/estado";
import { RESUMO_ABA } from "@/lib/jornada/textos";
import { useJornada } from "@/components/jornada/useJornada";
import { doEstado } from "./leitura";
import { ResumoPeriodo } from "./ResumoPeriodo";

/**
 * Os resumos da Jornada (J14, #164): semana, mês e ano, um de cada vez.
 *
 * Lê o estado pelo hook da J11 -- nenhum Supabase, nenhuma conta aqui. Se o
 * estado ainda não chegou, não mostra nada: quem cuida de carregando e erro
 * é a tela que abre este bloco (J12).
 */
interface Props {
  userId: string;
}

export function JornadaResumos({ userId }: Props) {
  const { estado } = useJornada(userId);
  const [aba, setAba] = useState<TipoPeriodo>("semana");

  if (!estado) return null;
  const { atual, fechado } = doEstado(estado, aba);

  return (
    <div className="flex flex-col gap-3" data-jornada-resumos>
      <div role="tablist" aria-orientation="horizontal" className="flex gap-2">
        {TIPOS_PERIODO.map((tipo) => {
          const ativa = tipo === aba;
          return (
            <button
              key={tipo}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => setAba(tipo)}
              className="rounded-full px-4 font-bold transition-opacity active:opacity-70"
              style={{
                minHeight: "44px",
                fontSize: "13px",
                background: ativa ? "var(--accent-fill)" : "var(--surface)",
                color: ativa ? "var(--on-accent)" : "var(--text-muted)",
              }}
            >
              {RESUMO_ABA[tipo]}
            </button>
          );
        })}
      </div>

      <ResumoPeriodo tipo={aba} atual={atual} fechado={fechado} />
    </div>
  );
}
