"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Job, Meta, PeriodoMeta } from "@/lib/types";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v
  );

const formatBRLShort = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

function calcEarnings(jobs: Job[], periodo: PeriodoMeta): number {
  const now = new Date();
  return jobs
    .filter((j) => {
      if (j.status !== "concluído") return false;
      const d = new Date(j.data + "T00:00:00");
      if (periodo === "dia") return d.toDateString() === now.toDateString();
      if (periodo === "mes")
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      return d.getFullYear() === now.getFullYear();
    })
    .reduce((s, j) => s + j.valor, 0);
}

const formatDate = (data: string) =>
  new Date(data + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });

const DEFAULT_METAS: Meta[] = [
  { periodo: "dia", valorAlvo: 300 },
  { periodo: "mes", valorAlvo: 3000 },
  { periodo: "ano", valorAlvo: 36000 },
];

const PERIODO_LABELS: Record<PeriodoMeta, string> = {
  dia: "Hoje",
  mes: "Este mês",
  ano: "Este ano",
};

interface Props {
  userId: string;
  refreshTrigger: number;
}

export function FinanceiroTab({ userId, refreshTrigger }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [metas, setMetas] = useState<Meta[]>(DEFAULT_METAS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase
        .from("jobs")
        .select("*")
        .order("data", { ascending: false })
        .order("hora", { ascending: false }),
      supabase.from("metas").select("*").eq("user_id", userId),
    ]).then(([jobsRes, metasRes]) => {
      if (jobsRes.data) {
        setJobs(
          jobsRes.data.map((r) => ({
            id: r.id,
            clienteNome: r.cliente_nome,
            data: r.data,
            hora: r.hora,
            valor: r.valor,
            modalidade: r.modalidade,
            local: r.local ?? undefined,
            status: r.status,
            observacoes: r.observacoes ?? undefined,
            criadoEm: r.criado_em,
          }))
        );
      }
      if (metasRes.data && metasRes.data.length > 0) {
        setMetas(
          metasRes.data.map((r) => ({
            periodo: r.periodo as PeriodoMeta,
            valorAlvo: r.valor_alvo,
          }))
        );
      }
      setLoading(false);
    });
  }, [userId, refreshTrigger]);

  const concluidos = jobs.filter((j) => j.status === "concluído");

  return (
    <div className="pb-4">
      <h2 className="text-xl font-bold mb-5" style={{ color: "var(--text)" }}>
        Financeiro
      </h2>

      {loading ? (
        <div className="flex justify-center pt-12">
          <div
            className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent)" }}
          />
        </div>
      ) : (
        <>
          {/* Resumo de ganhos */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {(["dia", "mes", "ano"] as PeriodoMeta[]).map((p) => {
              const total = calcEarnings(jobs, p);
              return (
                <div
                  key={p}
                  className="rounded-2xl p-3 flex flex-col gap-1"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {PERIODO_LABELS[p]}
                  </p>
                  <p
                    className="font-bold text-sm"
                    style={{ color: "var(--accent)" }}
                  >
                    {formatBRLShort(total)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Metas */}
          <div
            className="rounded-2xl p-4 mb-5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-color)",
            }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              Metas
            </p>
            <div className="flex flex-col gap-4">
              {metas
                .sort((a, b) => {
                  const order: PeriodoMeta[] = ["dia", "mes", "ano"];
                  return order.indexOf(a.periodo) - order.indexOf(b.periodo);
                })
                .map((meta) => {
                  const current = calcEarnings(jobs, meta.periodo);
                  const pct = Math.min(100, (current / meta.valorAlvo) * 100);
                  return (
                    <div key={meta.periodo}>
                      <div className="flex items-baseline justify-between mb-2">
                        <span
                          className="text-sm font-medium"
                          style={{ color: "var(--text)" }}
                        >
                          {PERIODO_LABELS[meta.periodo]}
                        </span>
                        <span
                          className="text-xs tabular-nums"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {formatBRLShort(current)}&nbsp;/&nbsp;
                          {formatBRLShort(meta.valorAlvo)}
                        </span>
                      </div>
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{ background: "rgb(var(--accent-rgb) / 0.12)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background:
                              "linear-gradient(90deg, var(--accent), var(--accent-soft))",
                            transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Histórico */}
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            Histórico
          </p>
          {concluidos.length === 0 ? (
            <p
              className="text-sm text-center pt-4"
              style={{ color: "var(--text-muted)" }}
            >
              Nenhum job concluído ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {concluidos.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between px-4 py-3 rounded-2xl"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div>
                    <p
                      className="font-medium text-sm"
                      style={{ color: "var(--text)" }}
                    >
                      {job.clienteNome}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {formatDate(job.data)} · {job.hora}
                    </p>
                  </div>
                  <span
                    className="font-bold text-sm"
                    style={{ color: "var(--accent)" }}
                  >
                    {formatBRL(job.valor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
