"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { JobCard } from "./JobCard";
import { NotasSection } from "./NotasSection";
import type { Job, JobStatus } from "@/lib/types";

type Filter = "todos" | JobStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "agendado", label: "Agendado" },
  { id: "confirmado", label: "Confirmado" },
  { id: "concluído", label: "Concluído" },
  { id: "cancelado", label: "Cancelado" },
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

interface Props {
  userId: string;
  refreshTrigger: number;
  onEditJob: (job: Job) => void;
}

export function JobsTab({ userId, refreshTrigger, onEditJob }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<Filter>("todos");
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="pb-4">
      {/* Title */}
      <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>
        Jobs
      </h2>

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
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* List */}
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

      {/* Notas gerais */}
      <NotasSection userId={userId} />
    </div>
  );
}
