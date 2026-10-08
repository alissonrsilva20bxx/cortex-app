"use client";

import { formatBRL } from "@/lib/finance";
import { podeLembrar } from "@/lib/lembrete/cartaoAgenda";
import { countdownLabel, getDaysUntil } from "@/lib/proximoAtendimento";
import type { Job } from "@/lib/types";
import {
  formatDiaExtenso,
  formatHora,
  localDoAtendimento,
} from "./agendaSemana";

interface Props {
  /** Próximo atendimento real (`proximoAtendimento`), ou `null` se não houver. */
  job: Job | null;
  /** Abre o detalhe do atendimento (mesmo `JobDetailSheet` da timeline). */
  onOpen: (job: Job) => void;
  /** Abre o "Lembrar cliente" (cartão de agenda para mandar no WhatsApp). */
  onLembrar?: (job: Job) => void;
}

/**
 * Card em destaque do próximo atendimento (J03), no topo da Agenda.
 *
 * Fundo, texto apagado e sombra vêm dos tokens `--hero-*` da fundação
 * (J01), os mesmos do mockup em cada tema e modo. Tudo o que aparece é
 * dado real do atendimento: nome, dia por extenso, hora, local
 * (`localDoAtendimento` omite o trecho quando não há local salvo) e valor
 * com centavos. A pílula de tempo relativo usa `countdownLabel`, a mesma
 * da Início, e some quando a data é inválida em vez de inventar contagem.
 *
 * "Lembrar cliente ›" abre o cartão de agenda (proposta 2) com a mensagem
 * curta do WhatsApp: é opcional, nada é enviado sozinho. A decisão antiga
 * que mantinha o botão desabilitado foi revogada pelo operador. Fica
 * desabilitado só quando não faz sentido lembrar (concluído ou cancelado).
 */
export function AgendaProximoCard({ job, onOpen, onLembrar }: Props) {
  const countdown = job ? countdownLabel(getDaysUntil(job.data)) : null;
  const local = job ? localDoAtendimento(job) : null;

  return (
    <section
      className="flex flex-col"
      style={{
        background: "var(--hero-bg)",
        color: "#fff",
        borderRadius: "26px",
        padding: "22px",
        gap: "12px",
        boxShadow: "0 14px 30px var(--hero-shadow)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--hero-text-muted)",
          }}
        >
          Próximo atendimento
        </span>
        {countdown && (
          <span
            className="rounded-full"
            style={{
              fontSize: "11px",
              fontWeight: 700,
              padding: "3px 9px",
              // Pixel do mockup: texto --text sobre o acento (--t-ink sobre
              // --t-acc). Volta a valer sobre o ajuste de contraste do #175;
              // os temas em que fica abaixo de 4,5:1 estão listados no PR.
              background: "var(--accent)",
              color: "var(--text)",
            }}
          >
            {countdown}
          </span>
        )}
      </div>

      {job ? (
        <>
          <button
            type="button"
            onClick={() => onOpen(job)}
            // Nome e linha de baixo como no mockup: 12px entre eles.
            className="flex flex-col text-left active:opacity-70"
            style={{ minHeight: "44px", gap: "12px" }}
          >
            <span
              className="block truncate"
              style={{
                fontSize: "26px",
                fontWeight: 800,
                letterSpacing: "-0.5px",
              }}
            >
              {job.clienteNome}
            </span>
            <span
              className="block"
              style={{ fontSize: "13px", color: "var(--hero-text-muted)" }}
            >
              {[formatDiaExtenso(job.data), formatHora(job.hora), local]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </button>
          <div
            className="flex items-center justify-between gap-2"
            style={{ marginTop: "4px" }}
          >
            {/* Sem tabular-nums: o mockup usa os dígitos proporcionais. */}
            <span style={{ fontSize: "20px", fontWeight: 800 }}>
              {formatBRL(job.valor, 2)}
            </span>
            {/* Toque de 44px sem crescer a linha (30px no mockup). */}
            <button
              type="button"
              onClick={() => onLembrar?.(job)}
              disabled={!onLembrar || !podeLembrar(job)}
              aria-label={`Lembrar ${job.clienteNome} do atendimento`}
              className="active:opacity-70 disabled:opacity-60"
              style={{
                fontSize: "12px",
                fontWeight: 700,
                minHeight: "44px",
                margin: "-7px 0",
              }}
            >
              Lembrar cliente ›
            </button>
          </div>
        </>
      ) : (
        <p style={{ fontSize: "13px", color: "var(--hero-text-muted)" }}>
          Nenhum atendimento agendado ainda. Toque no + para registrar.
        </p>
      )}
    </section>
  );
}
