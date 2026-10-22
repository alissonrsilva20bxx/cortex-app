"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { resumoDaSemana } from "@/lib/atendimentos/resumoSemana";
import type { Job } from "@/lib/types";
import { RESUMO_SEMANA } from "./textosAgenda";

interface Props {
  open: boolean;
  onClose: () => void;
  jobs: readonly Job[];
  /** O relógio da Agenda (`useAgora`), o mesmo das listas "Esta semana". */
  agora: Date;
}

/**
 * "Resumo da semana": o tempo de trabalho (feitos, pela frente, desmarcados,
 * dias livres), sem dinheiro, que mora no Financeiro. Só apresenta o que
 * `resumoDaSemana` calcula, na mesma semana da Agenda.
 */
export function AgendaResumoSheet({ open, onClose, jobs, agora }: Props) {
  const resumo = resumoDaSemana(jobs, agora);
  const numeros = [
    { rotulo: RESUMO_SEMANA.feitos, valor: resumo.feitos },
    { rotulo: RESUMO_SEMANA.pelaFrente, valor: resumo.pelaFrente },
    { rotulo: RESUMO_SEMANA.desmarcados, valor: resumo.desmarcados },
    { rotulo: RESUMO_SEMANA.diasLivres, valor: resumo.diasLivres.length },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title={RESUMO_SEMANA.titulo}>
      <div className="px-5 py-6" data-resumo-semana>
        <div className="grid grid-cols-2 gap-3">
          {numeros.map(({ rotulo, valor }) => (
            <div
              key={rotulo}
              className="rounded-2xl px-4 py-4"
              style={{
                background: "var(--card-solid)",
                border: "1px solid var(--border-color)",
              }}
            >
              <p
                className="text-4xl font-bold leading-none"
                style={{ color: "var(--text)" }}
              >
                {valor}
              </p>
              <p
                className="text-sm mt-2"
                style={{ color: "var(--text-muted)" }}
              >
                {rotulo}
              </p>
            </div>
          ))}
        </div>
        <p
          className="text-base mt-5 text-center"
          style={{ color: "var(--text)" }}
          data-resumo-frase
        >
          {resumo.frase}
        </p>
      </div>
    </BottomSheet>
  );
}
