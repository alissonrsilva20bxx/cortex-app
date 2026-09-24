"use client";

import { useState } from "react";
import { ChevronDown, MapPin, Video, Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  getDaysUntil,
  countdownLabel,
  formatDayBadge,
} from "@/lib/proximoAtendimento";
import type { Job } from "@/lib/types";

interface Props {
  jobs: Job[];
}

function getProximoJob(jobs: Job[]): Job | null {
  const now = new Date();
  const upcoming = jobs
    .filter((j) => j.status === "agendado" || j.status === "confirmado")
    .filter((j) => new Date(`${j.data}T${j.hora}`) >= now)
    .sort(
      (a, b) =>
        new Date(`${a.data}T${a.hora}`).getTime() -
        new Date(`${b.data}T${b.hora}`).getTime()
    );
  return upcoming[0] ?? null;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v
  );

const formatTime = (hora: string) => {
  const [h, m] = hora.split(":");
  return `${h}h${m}`;
};

// `formatDayBadge` reexportado do módulo de lógica pura (lib/
// proximoAtendimento.ts, achado #131) — JobDetailSheet.tsx importa daqui,
// então o caminho de import dele continua o mesmo sem precisar tocar lá.
export { formatDayBadge };

export function NextJobCard({ jobs }: Props) {
  const [expanded, setExpanded] = useState(false);
  const job = getProximoJob(jobs);
  const dayBadge = job ? formatDayBadge(job.data) : null;
  // Fallback honesto (achado #131): data inválida/implausível vira `null`
  // em vez de "em 12131022 dias" -- o selo some, não mente.
  const countdown = job ? countdownLabel(getDaysUntil(job.data)) : null;

  return (
    <GlassCard
      className="p-5 duration-300"
      onClick={job ? () => setExpanded((v) => !v) : undefined}
      radius="lg"
      // O card inteiro é uma ação real (expande ao toque) — marca pro FAB
      // recuar se colidir (achado #131, ver FAB.tsx).
      fabAvoid
      // Fundação Visual (#142): sem `style` de superfície, o card usa o
      // material neutro compartilhado de `.glass-card` (globals.css) —
      // nada de superfície/borda duplicada por arquivo aqui (ver nota de
      // HeroCard.tsx sobre a correção desse padrão). Achado #131: o glow
      // extra de quando expandido (`var(--glow-sm)`) não tem equivalente
      // no protótipo — removido, sobra só a elevação normal do
      // `.glass-card`, sem tratamento especial nenhum aqui.
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        {/* `.card-title` (globals.css, achado #131) — mesma regra
            compartilhada de HeroCard/ObjetivosCard, espelhando o único
            `.card h2` (20px/400) do protótipo aprovado. Antes era um
            13px/600 próprio deste arquivo (ver histórico do componente),
            fora do padrão do protótipo medido por computedStyle. */}
        <h2 className="card-title">Próximo atendimento</h2>
        {job && (
          <ChevronDown
            size={15}
            style={{
              color: "var(--text-muted)",
              transition: "transform 0.3s ease",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        )}
      </div>

      {!job ? (
        <p
          className="font-medium"
          style={{ fontSize: "14px", color: "var(--text-muted)" }}
        >
          Nenhum atendimento agendado ainda. Toque no + para registrar.
        </p>
      ) : (
        <>
          {/* Bloco interno (Fundação Visual #142/#131) — o card externo já é
              uma superfície (.glass-card); a composição aprovada do
              protótipo (`.nextJob`) tem um SEGUNDO bloco, mais discreto,
              só pra linha de resumo — não a mistura direto no padding do
              card. Fundo NEUTRO (color-mix com --text, não --surface):
              medição de computedStyle (revisão #131) achou que --surface
              é tingida de acento por tema (pink-neon:
              rgba(255,45,120,0.05)) — mesma classe de problema do
              --border-color no card externo, só que no preenchimento. O
              protótipo usa um branco neutro (rgba(255,255,255,0.04));
              color-mix com --text reproduz isso E se adapta sozinho ao
              modo claro (--text vira escuro), sem precisar de um segundo
              valor hardcoded por modo. */}
          <div
            className="flex items-start justify-between gap-3"
            style={{
              padding: "13px",
              borderRadius: "var(--radius-sm)",
              background: "color-mix(in srgb, var(--text) 4%, transparent)",
              border: "1px solid var(--card-border)",
            }}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="grid shrink-0 place-items-center"
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--card-border)",
                  // Neutro, mesmo raciocínio do bloco interno acima — o
                  // protótipo usa o mesmo branco neutro pro `.dateTile`
                  // (rgba(255,255,255,0.04)) que pro `.nextJob` em volta.
                  background: "color-mix(in srgb, var(--text) 4%, transparent)",
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
                  {dayBadge?.day}
                </span>
                <span
                  className="mt-0.5 font-semibold uppercase"
                  style={{ fontSize: "9px", color: "var(--text-muted)" }}
                >
                  {dayBadge?.month}
                </span>
              </div>

              <div className="min-w-0">
                <p
                  className="font-bold truncate"
                  style={{
                    fontSize: "15px",
                    letterSpacing: "-0.02em",
                    color: "var(--text)",
                  }}
                >
                  {job.clienteNome}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Clock size={11} style={{ color: "var(--text-muted)" }} />
                  <span
                    className="font-medium truncate"
                    style={{ fontSize: "12.5px", color: "var(--text-muted)" }}
                  >
                    {formatTime(job.hora)} ·{" "}
                    {job.modalidade === "online"
                      ? "Online"
                      : (job.local ?? "Presencial")}
                  </span>
                </div>
              </div>
            </div>

            {/* Valor em --warning (protótipo, `.jobValue strong` — cor de
                atendimento agendado/pendente, ver IOS_VISUAL_SYSTEM.md),
                não mais var(--accent). O selo de contagem virou legenda
                simples acima do valor (sem pílula/glow/borda própria) —
                nenhum chip pode dominar a composição (achado da revisão
                visual de #131); `null` (data inválida/implausível, achado
                #131) some em vez de mostrar uma contagem inventada. */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              {countdown && (
                <span
                  className="font-semibold"
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.01em",
                    color: "var(--text-muted)",
                  }}
                >
                  {countdown}
                </span>
              )}
              <span
                className="font-bold"
                style={{
                  fontSize: "15px",
                  letterSpacing: "-0.02em",
                  color: "var(--warning)",
                }}
              >
                {formatBRL(job.valor)}
              </span>
            </div>
          </div>

          {/* Expanded details */}
          <div
            style={{
              maxHeight: expanded ? "200px" : "0px",
              overflow: "hidden",
              transition: "max-height 0.38s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div
              className="mt-4 pt-4 flex flex-col gap-3"
              style={{
                borderTop: "1px solid var(--divider, var(--border-color))",
              }}
            >
              <div className="flex items-center gap-2">
                {job.modalidade === "online" ? (
                  <Video size={13} style={{ color: "var(--accent)" }} />
                ) : (
                  <MapPin size={13} style={{ color: "var(--accent)" }} />
                )}
                <span
                  className="font-medium"
                  style={{
                    fontSize: "13px",
                    color: "var(--text-2, var(--text))",
                  }}
                >
                  {job.modalidade === "online"
                    ? "Atendimento online"
                    : (job.local ?? "Presencial")}
                </span>
              </div>

              <div>
                <span
                  className="font-semibold capitalize px-3 py-1 rounded-full"
                  style={{
                    fontSize: "11px",
                    background: "var(--surface-2, var(--surface))",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {job.status}
                </span>
              </div>

              {job.observacoes && (
                <p
                  className="font-medium leading-relaxed"
                  style={{ fontSize: "13px", color: "var(--text-muted)" }}
                >
                  {job.observacoes}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </GlassCard>
  );
}
