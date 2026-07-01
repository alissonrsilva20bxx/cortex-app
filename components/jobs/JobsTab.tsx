"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MiniBarChart } from "@/components/charts/MiniBarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { JobCard } from "./JobCard";
import { NotasSection } from "./NotasSection";
import type { Job, JobStatus } from "@/lib/types";

type Filter = "todos" | JobStatus;
type Period = "sem" | "mes" | "ano";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "agendado", label: "Agendado" },
  { id: "confirmado", label: "Confirmado" },
  { id: "concluído", label: "Concluído" },
  { id: "cancelado", label: "Cancelado" },
];

const STATUS_COLORS: Record<JobStatus, string> = {
  agendado: "#64b4ff",
  confirmado: "#50dc78",
  concluído: "var(--accent)",
  cancelado: "#ff5050",
};

const PERIOD_OPTS: { id: Period; label: string }[] = [
  { id: "sem", label: "S" },
  { id: "mes", label: "M" },
  { id: "ano", label: "A" },
];

function dbRowToJob(row: {
  id: string;
  cliente_nome: string;
  data: string;
  hora: string;
  valor: number;
  modalidade: "presencial" | "online";
  local: string | null;
  status: JobStatus;
  observacoes: string | null;
  criado_em: string;
}): Job {
  return {
    id: row.id,
    clienteNome: row.cliente_nome,
    data: row.data,
    hora: row.hora,
    valor: row.valor,
    modalidade: row.modalidade,
    local: row.local ?? undefined,
    status: row.status,
    observacoes: row.observacoes ?? undefined,
    criadoEm: row.criado_em,
  };
}

function buildPeriodData(
  jobs: Job[],
  period: Period
): { label: string; value: number }[] {
  const done = jobs.filter((j) => j.status === "concluído");

  if (period === "sem") {
    return Array.from({ length: 8 }, (_, i) => {
      const end = new Date();
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const value = done
        .filter((j) => {
          const d = new Date(j.data + "T00:00:00");
          return d >= start && d <= end;
        })
        .reduce((s, j) => s + j.valor, 0);
      return { label: `S${8 - i}`, value };
    }).reverse();
  }

  if (period === "mes") {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const m = (now.getMonth() - 11 + i + 12) % 12;
      const y = now.getFullYear() - (now.getMonth() - 11 + i < 0 ? 1 : 0);
      const label = new Date(y, m, 1).toLocaleDateString("pt-BR", {
        month: "short",
      });
      const value = done
        .filter((j) => {
          const d = new Date(j.data + "T00:00:00");
          return d.getMonth() === m && d.getFullYear() === y;
        })
        .reduce((s, j) => s + j.valor, 0);
      return { label, value };
    });
  }

  // ano
  const nowY = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => {
    const y = nowY - 4 + i;
    const value = done
      .filter((j) => new Date(j.data + "T00:00:00").getFullYear() === y)
      .reduce((s, j) => s + j.valor, 0);
    return { label: String(y), value };
  });
}

interface Props {
  userId: string;
  refreshTrigger: number;
  onEditJob: (job: Job) => void;
  chartType?: "bar" | "donut";
}

export function JobsTab({
  userId,
  refreshTrigger,
  onEditJob,
  chartType = "bar",
}: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<Filter>("todos");
  const [loading, setLoading] = useState(true);
  const [chartOpen, setChartOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("sem");

  useEffect(() => {
    setLoading(true);
    supabase
      .from("jobs")
      .select("*")
      .order("data", { ascending: true })
      .order("hora", { ascending: true })
      .then(({ data }) => {
        setJobs(data ? data.map(dbRowToJob) : []);
        setLoading(false);
      });
  }, [refreshTrigger]);

  const filtered =
    filter === "todos" ? jobs : jobs.filter((j) => j.status === filter);

  const periodData = buildPeriodData(jobs, period);
  const donutSegments = (
    ["agendado", "confirmado", "concluído", "cancelado"] as JobStatus[]
  )
    .map((s) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: jobs.filter((j) => j.status === s).length,
      color: STATUS_COLORS[s],
    }))
    .filter((s) => s.value > 0);

  return (
    <div className="pb-4">
      <div className="flex items-baseline gap-2 mb-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>
          Jobs
        </h2>
        {!loading && (
          <span
            className="text-xs font-bold tabular-nums px-2 py-px rounded-full"
            style={{
              background: "rgb(var(--accent-rgb) / 0.12)",
              color: "var(--accent)",
            }}
          >
            {filtered.length}
          </span>
        )}
      </div>

      {/* Collapsible chart */}
      {!loading && jobs.length > 0 && (
        <div className="glass-card rounded-2xl mb-4 overflow-hidden">
          <button
            className="flex items-center justify-between w-full px-4 py-3"
            onClick={() => setChartOpen((v) => !v)}
          >
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              {chartType === "donut" ? "Distribuição por status" : "Receitas"}
            </span>
            <ChevronDown
              size={14}
              style={{
                color: "var(--text-muted)",
                transform: chartOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.25s ease",
              }}
            />
          </button>
          <div
            style={{
              maxHeight: chartOpen ? "320px" : 0,
              overflow: "hidden",
              transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <div className="px-4 pb-4">
              {chartType === "donut" ? (
                <div className="flex justify-center pt-2">
                  <DonutChart
                    segments={donutSegments}
                    size={130}
                    centerValue={String(jobs.length)}
                    centerLabel="jobs"
                  />
                </div>
              ) : (
                <>
                  {/* Period selector */}
                  <div className="flex justify-end mb-3">
                    <div
                      className="flex gap-1 p-0.5 rounded-xl"
                      style={{ background: "var(--surface-2, var(--surface))" }}
                    >
                      {PERIOD_OPTS.map(({ id, label }) => {
                        const active = period === id;
                        return (
                          <button
                            key={id}
                            onClick={() => setPeriod(id)}
                            className="px-3 py-1 rounded-lg text-[11px] font-bold transition-all"
                            style={{
                              background: active
                                ? "var(--accent)"
                                : "transparent",
                              color: active ? "#fff" : "var(--text-muted)",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <MiniBarChart data={periodData} height={100} id="jobs-bar" />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
        {FILTERS.map(({ id, label }) => {
          const active = filter === id;
          return (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: active
                  ? "rgb(var(--accent-rgb) / 0.18)"
                  : "var(--surface)",
                border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                color: active ? "var(--accent)" : "var(--text-muted)",
                boxShadow: active ? "var(--glow-sm)" : "none",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center pt-12">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent)" }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <p
            className="text-sm text-center pt-12"
            style={{ color: "var(--text-muted)" }}
          >
            {filter === "todos"
              ? "Nenhum job ainda. Toque no + para criar."
              : `Nenhum job com status "${filter}".`}
          </p>
        ) : (
          filtered.map((job) => (
            <JobCard key={job.id} job={job} onClick={onEditJob} />
          ))
        )}
      </div>

      <NotasSection userId={userId} />
    </div>
  );
}
