"use client";

import { MapPin, Video } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { StatusBadge } from "./StatusBadge";
import { formatDayBadge } from "@/components/home/NextJobCard";
import { formatBRL } from "@/lib/finance";
import type { Job } from "@/lib/types";

/** "15h30" — mesma convenção já usada em NextJobCard/lib/notificacoes.ts. */
function formatHora(hora: string): string {
  const [h, m] = hora.split(":");
  return `${h}h${m}`;
}

interface Props {
  job: Job | null;
  onClose: () => void;
  onEdit: (job: Job) => void;
}

/**
 * "Abrir atendimento" (contrato de paridade, seção Agenda) — passo
 * distinto de "editar", como no protótipo aprovado: no `/dev-preview/ios`,
 * tocar o card da timeline abre um sheet só de leitura
 * (`kind === "detalhe-atendimento"`); "Editar atendimento" no rodapé é
 * que leva ao formulário. Antes desta ticket (#135) o toque no card ia
 * direto pro `JobForm` — esse atalho não desaparece, só ganha uma parada
 * intermediária somente-leitura no meio do caminho. Toda a função de
 * edição real continua em `JobForm.tsx` (intocado); este sheet só chama
 * `onEdit`, que o `JobsTab` liga ao mesmo `onEditJob` que já existia.
 *
 * Usa o `BottomSheet` compartilhado (`components/ui/BottomSheet.tsx`) —
 * mesmo casco de `ClienteDetailSheet` (Rede) — em vez de reinventar
 * overlay/pega/foco: já tem focus trap, Esc e `role="dialog"`.
 */
export function JobDetailSheet({ job, onClose, onEdit }: Props) {
  const dayBadge = job ? formatDayBadge(job.data) : null;

  return (
    <BottomSheet
      open={!!job}
      onClose={onClose}
      title="Atendimento"
      footer={
        job ? (
          <button
            onClick={() => onEdit(job)}
            className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80"
            style={{ background: "var(--accent)", color: "white" }}
          >
            Editar atendimento
          </button>
        ) : undefined
      }
    >
      {job && (
        <div className="px-5 py-5 space-y-5">
          {/* Selo de data + cliente — mesma composição de dateTile já
              usada em NextJobCard (Início), via o helper importado de lá
              em vez de recalculado aqui. */}
          <div className="flex items-start gap-3.5">
            <div
              className="grid shrink-0 place-items-center"
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-color)",
                background: "var(--surface)",
              }}
            >
              <span
                className="font-semibold leading-none"
                style={{
                  fontSize: "18px",
                  letterSpacing: "-0.03em",
                  color: "var(--text)",
                }}
              >
                {dayBadge!.day}
              </span>
              <span
                className="mt-0.5 font-semibold uppercase"
                style={{ fontSize: "9px", color: "var(--text-muted)" }}
              >
                {dayBadge!.month}
              </span>
            </div>
            <div className="min-w-0">
              <p
                className="font-bold truncate"
                style={{ fontSize: "17px", color: "var(--text)" }}
              >
                {job.clienteNome}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                {job.modalidade === "online" ? (
                  <Video size={12} style={{ color: "var(--text-muted)" }} />
                ) : (
                  <MapPin size={12} style={{ color: "var(--text-muted)" }} />
                )}
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatHora(job.hora)} ·{" "}
                  {job.modalidade === "online"
                    ? "Online"
                    : (job.local ?? "Presencial")}
                </span>
              </div>
            </div>
          </div>

          {/* Status/Valor/Modalidade/Local — todos os campos reais do
              contrato de paridade, exceto Cliente/Data/Hora (já no
              cabeçalho acima) e Observações (bloco próprio abaixo, só
              quando preenchido). */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Status
              </span>
              <StatusBadge status={job.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Valor
              </span>
              <strong
                className="text-sm font-bold"
                style={{ color: "var(--accent)" }}
              >
                {formatBRL(job.valor, 2)}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Modalidade
              </span>
              <strong
                className="text-sm font-semibold capitalize"
                style={{ color: "var(--text)" }}
              >
                {job.modalidade}
              </strong>
            </div>
            {job.modalidade === "presencial" && job.local && (
              <div className="flex items-center justify-between gap-3">
                <span
                  className="text-sm shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  Local
                </span>
                <strong
                  className="text-sm font-semibold text-right truncate"
                  style={{ color: "var(--text)" }}
                >
                  {job.local}
                </strong>
              </div>
            )}
          </div>

          {job.observacoes && (
            <div>
              <p className="section-label mb-2">Observações</p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-2)" }}
              >
                {job.observacoes}
              </p>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
