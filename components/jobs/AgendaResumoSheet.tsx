"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { resumoDaSemana } from "@/lib/atendimentos/resumoSemana";
import {
  semanaViva,
  type MarcaDoAtendimento,
} from "@/lib/atendimentos/semanaViva";
import type { Job } from "@/lib/types";
import { formatHora } from "./agendaSemana";
import { ACONTECEU, RESUMO_SEMANA } from "./textosAgenda";

interface Props {
  open: boolean;
  onClose: () => void;
  jobs: readonly Job[];
  /** O relógio da Agenda (`useAgora`), o mesmo das listas "Esta semana". */
  agora: Date;
}

/** Bolinhas por dia; o resto vira "+n" pra pilha não esticar a semana. */
const MAX_BOLINHAS = 3;

const CINZA = "color-mix(in srgb, var(--text-muted) 45%, transparent)";

/** As bolinhas da Jornada: feito cheio, pela frente vazado, desmarcado cinza. */
const BOLINHA: Record<MarcaDoAtendimento, CSSProperties> = {
  feito: { background: "var(--accent)" },
  frente: { boxShadow: "inset 0 0 0 2px var(--accent)" },
  aberto: { boxShadow: `inset 0 0 0 2px ${CINZA}` },
  desmarcado: { background: CINZA },
};

const TAG: Record<
  MarcaDoAtendimento,
  { texto: string; estilo: CSSProperties }
> = {
  feito: {
    texto: RESUMO_SEMANA.tagFeito,
    estilo: {
      background: "rgb(var(--accent-rgb) / 0.16)",
      color: "var(--accent-soft)",
    },
  },
  frente: {
    texto: RESUMO_SEMANA.tagPelaFrente,
    estilo: {
      boxShadow: "inset 0 0 0 1px var(--accent)",
      color: "var(--accent-soft)",
    },
  },
  aberto: {
    texto: ACONTECEU.titulo,
    estilo: {
      boxShadow: `inset 0 0 0 1px ${CINZA}`,
      color: "var(--text-muted)",
    },
  },
  desmarcado: {
    texto: RESUMO_SEMANA.tagDesmarcado,
    estilo: { background: "var(--border-color)", color: "var(--text-muted)" },
  },
};

/**
 * "Resumo da semana" como Semana viva: os 7 dias com as bolinhas da Jornada
 * e, ao tocar num dia, o que houve nele logo abaixo. Sem dinheiro, que mora
 * no Financeiro. A frase continua vindo de `resumoDaSemana`; os dias, de
 * `semanaViva`, na mesma semana da Agenda.
 */
export function AgendaResumoSheet({ open, onClose, jobs, agora }: Props) {
  const resumo = resumoDaSemana(jobs, agora);
  const semana = semanaViva(jobs, agora);
  const [escolhido, setEscolhido] = useState<string | null>(null);

  // Cada vez que abre, começa por hoje.
  useEffect(() => {
    if (open) setEscolhido(null);
  }, [open]);

  const dia =
    semana.dias.find((d) => d.iso === escolhido) ??
    semana.dias.find((d) => d.hoje) ??
    semana.dias[0];

  return (
    <BottomSheet open={open} onClose={onClose} title={RESUMO_SEMANA.titulo}>
      <div className="px-5 py-5" data-resumo-semana>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {semana.periodo}
        </p>
        <p
          className="text-[19px] font-bold leading-tight tracking-[-0.01em] mt-1"
          style={{ color: "var(--text)" }}
          data-resumo-frase
        >
          {comNumerosEmDestaque(resumo.frase)}
        </p>

        <div
          className="grid grid-cols-7 mt-4"
          style={{ gap: 6 }}
          role="group"
          aria-label={RESUMO_SEMANA.diasDaSemana}
        >
          {semana.dias.map((d) => {
            const ativo = d.iso === dia.iso;
            const extra = d.atendimentos.length - MAX_BOLINHAS;
            return (
              <button
                key={d.iso}
                type="button"
                aria-pressed={ativo}
                onClick={() => setEscolhido(d.iso)}
                className="flex flex-col items-center gap-2 rounded-2xl pt-2 pb-2.5 focus-visible:outline focus-visible:outline-2"
                style={{
                  background: ativo ? "var(--card-solid)" : "transparent",
                  border: `1px solid ${ativo ? "var(--border-color)" : "transparent"}`,
                  outlineColor: "var(--accent)",
                }}
              >
                <span
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {d.rotulo}
                </span>
                <span className="relative grid place-items-center w-7 h-7">
                  {d.hoje && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{ background: "rgb(var(--accent-rgb) / 0.35)" }}
                    />
                  )}
                  <span
                    className="relative grid place-items-center w-7 h-7 rounded-full text-[15px] font-bold"
                    style={
                      d.hoje
                        ? { background: "var(--accent)", color: "#fff" }
                        : { color: "var(--text)" }
                    }
                  >
                    {d.numero}
                  </span>
                </span>
                <span
                  className="flex flex-col-reverse items-center gap-1"
                  style={{ minHeight: 58 }}
                  aria-hidden
                >
                  {d.atendimentos.length === 0 ? (
                    <span
                      className="rounded-full"
                      style={{
                        width: 14,
                        height: 14,
                        border: `1.5px dashed ${CINZA}`,
                      }}
                    />
                  ) : (
                    d.atendimentos
                      .slice(0, MAX_BOLINHAS)
                      .map((a) => (
                        <span
                          key={a.id}
                          className="rounded-full"
                          style={{ width: 14, height: 14, ...BOLINHA[a.marca] }}
                        />
                      ))
                  )}
                  {extra > 0 && (
                    <span
                      className="text-[10px] leading-none"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {RESUMO_SEMANA.mais(extra)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="rounded-2xl px-4 py-3.5 mt-3"
          style={{
            background: "var(--card-solid)",
            border: "1px solid var(--border-color)",
          }}
          aria-live="polite"
          data-resumo-dia
        >
          <p
            className="text-sm font-bold mb-1.5"
            style={{ color: "var(--text)" }}
          >
            {tituloDoDia(dia.hoje, dia.nome, dia.numero)}
          </p>
          {dia.atendimentos.length === 0 ? (
            <p className="text-sm py-1" style={{ color: "var(--text-muted)" }}>
              {dia.passado
                ? RESUMO_SEMANA.diaSemAtendimento
                : RESUMO_SEMANA.diaLivre}
            </p>
          ) : (
            dia.atendimentos.map((a, i) => (
              <div
                key={a.id}
                className="flex items-center gap-2.5 py-2 text-sm"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid var(--border-color)",
                }}
              >
                <span
                  className="w-12 flex-none tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatHora(a.hora)}
                </span>
                <span
                  className="min-w-0 truncate"
                  style={
                    a.marca === "desmarcado"
                      ? {
                          color: "var(--text-muted)",
                          textDecoration: "line-through",
                        }
                      : { color: "var(--text)" }
                  }
                >
                  {a.cliente}
                </span>
                <span
                  className="ml-auto flex-none rounded-full px-2 py-0.5 text-[11px]"
                  style={TAG[a.marca].estilo}
                >
                  {TAG[a.marca].texto}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

/** Os números da frase na cor de destaque, como no gabarito. */
function comNumerosEmDestaque(frase: string) {
  return frase.split(/(\d+)/).map((parte, i) =>
    i % 2 === 1 ? (
      <em key={i} className="not-italic" style={{ color: "var(--accent)" }}>
        {parte}
      </em>
    ) : (
      parte
    )
  );
}

/** "Hoje, quinta 22" / "Terça 20". */
function tituloDoDia(hoje: boolean, nome: string, numero: number): string {
  return hoje
    ? `${RESUMO_SEMANA.hoje}, ${nome.toLowerCase()} ${numero}`
    : `${nome} ${numero}`;
}
