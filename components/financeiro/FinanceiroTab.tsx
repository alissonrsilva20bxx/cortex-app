"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Trash2,
  Check,
  Target,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MiniBarChart } from "@/components/charts/MiniBarChart";
import { AreaSparkline } from "@/components/charts/AreaSparkline";
import type {
  Job,
  Meta,
  Despesa,
  ReceitaAvulsa,
  Objetivo,
  PeriodoMeta,
} from "@/lib/types";

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
const formatDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });

function calcEarnings(
  jobs: Job[],
  receitas: ReceitaAvulsa[],
  periodo: PeriodoMeta
): number {
  const now = new Date();
  const jobTotal = jobs
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

  const receitaTotal = receitas
    .filter((r) => {
      const d = new Date(r.data + "T00:00:00");
      if (periodo === "dia") return d.toDateString() === now.toDateString();
      if (periodo === "mes")
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      return d.getFullYear() === now.getFullYear();
    })
    .reduce((s, r) => s + r.valor, 0);

  return jobTotal + receitaTotal;
}

type ChartPeriod = "sem" | "mes" | "ano";

function buildChartData(
  jobs: Job[],
  receitas: ReceitaAvulsa[],
  period: ChartPeriod
): { label: string; value: number }[] {
  if (period === "sem") {
    return Array.from({ length: 8 }, (_, i) => {
      const end = new Date();
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const jobV = jobs
        .filter((j) => {
          if (j.status !== "concluído") return false;
          const d = new Date(j.data + "T00:00:00");
          return d >= start && d <= end;
        })
        .reduce((s, j) => s + j.valor, 0);
      const recV = receitas
        .filter((r) => {
          const d = new Date(r.data + "T00:00:00");
          return d >= start && d <= end;
        })
        .reduce((s, r) => s + r.valor, 0);
      return { label: `S${8 - i}`, value: jobV + recV };
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
      const jobV = jobs
        .filter((j) => {
          if (j.status !== "concluído") return false;
          const d = new Date(j.data + "T00:00:00");
          return d.getMonth() === m && d.getFullYear() === y;
        })
        .reduce((s, j) => s + j.valor, 0);
      const recV = receitas
        .filter((r) => {
          const d = new Date(r.data + "T00:00:00");
          return d.getMonth() === m && d.getFullYear() === y;
        })
        .reduce((s, r) => s + r.valor, 0);
      return { label, value: jobV + recV };
    });
  }

  // ano
  const nowY = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => {
    const y = nowY - 4 + i;
    const jobV = jobs
      .filter(
        (j) =>
          j.status === "concluído" &&
          new Date(j.data + "T00:00:00").getFullYear() === y
      )
      .reduce((s, j) => s + j.valor, 0);
    const recV = receitas
      .filter((r) => new Date(r.data + "T00:00:00").getFullYear() === y)
      .reduce((s, r) => s + r.valor, 0);
    return { label: String(y), value: jobV + recV };
  });
}

function last30DaysSpark(jobs: Job[], receitas: ReceitaAvulsa[]): number[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const ds = d.toISOString().slice(0, 10);
    const jobV = jobs
      .filter((j) => j.status === "concluído" && j.data === ds)
      .reduce((s, j) => s + j.valor, 0);
    const recV = receitas
      .filter((r) => r.data === ds)
      .reduce((s, r) => s + r.valor, 0);
    return jobV + recV;
  });
}

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

const CAT_LABELS: Record<string, string> = {
  alimentacao: "Alimentação",
  transporte: "Transporte",
  moradia: "Moradia",
  saude: "Saúde",
  educacao: "Educação",
  lazer: "Lazer",
  vestuario: "Vestuário",
  marketing: "Marketing",
  ferramentas: "Ferramentas",
  equipamentos: "Equipamentos",
  impostos: "Impostos",
  internet: "Internet",
  combustivel: "Combustível",
  outros: "Outros",
};
const CAT_EMOJIS: Record<string, string> = {
  alimentacao: "🍽️",
  transporte: "🚗",
  moradia: "🏠",
  saude: "🏥",
  educacao: "📚",
  lazer: "🎮",
  vestuario: "👕",
  marketing: "📣",
  ferramentas: "💻",
  equipamentos: "🔧",
  impostos: "📋",
  internet: "📡",
  combustivel: "⛽",
  outros: "📦",
};

const REC_CAT_EMOJIS: Record<string, string> = {
  freelance: "💼",
  investimento: "📈",
  venda: "🛒",
  bonus: "🎁",
  outros: "💰",
};
const REC_CAT_LABELS: Record<string, string> = {
  freelance: "Freelance",
  investimento: "Investimento",
  venda: "Venda",
  bonus: "Bônus",
  outros: "Outros",
};

const OBJ_CATS = [
  { id: "afazeres", label: "Afazeres", emoji: "✅" },
  { id: "vida", label: "Vida", emoji: "🌟" },
  { id: "saude", label: "Saúde", emoji: "💪" },
  { id: "financeiro", label: "Financeiro", emoji: "💰" },
  { id: "outros", label: "Outros", emoji: "📌" },
];

type InnerTab = "visao" | "entradas" | "saidas" | "metas";

interface Props {
  userId: string;
  refreshTrigger: number;
  chartType?: "bar" | "area";
  onInnerTabChange?: (tab: string) => void;
  onAddDespesa?: () => void;
  onAddReceita?: () => void;
  objetivos: Objetivo[];
  onObjetivoAdded: () => void;
  onToggleObjetivo: (id: string, done: boolean) => Promise<void>;
}

export function FinanceiroTab({
  userId,
  refreshTrigger,
  chartType = "bar",
  onInnerTabChange,
  onAddDespesa,
  onAddReceita,
  objetivos,
  onObjetivoAdded,
  onToggleObjetivo,
}: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [metas, setMetas] = useState<Meta[]>(DEFAULT_METAS);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [receitas, setReceitas] = useState<ReceitaAvulsa[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<InnerTab>("visao");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("sem");

  // Objetivo inline form
  const [objTitulo, setObjTitulo] = useState("");
  const [objCat, setObjCat] = useState("afazeres");
  const [objSaving, setObjSaving] = useState(false);
  const [objFormOpen, setObjFormOpen] = useState(false);

  function changeTab(t: InnerTab) {
    setTab(t);
    onInnerTabChange?.(t);
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase
        .from("jobs")
        .select("*")
        .order("data", { ascending: false })
        .order("hora", { ascending: false }),
      supabase.from("metas").select("*").eq("user_id", userId),
      supabase
        .from("despesas")
        .select("*")
        .eq("user_id", userId)
        .order("data", { ascending: false }),
      supabase
        .from("receitas_avulsas")
        .select("*")
        .eq("user_id", userId)
        .order("data", { ascending: false }),
    ]).then(([jobsRes, metasRes, despRes, recRes]) => {
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
      if (despRes.data) {
        setDespesas(
          despRes.data.map((r) => ({
            id: r.id,
            descricao: r.descricao,
            valor: r.valor,
            categoria: r.categoria,
            data: r.data,
            criadoEm: r.criado_em,
          }))
        );
      }
      if (recRes.data) {
        setReceitas(
          recRes.data.map((r) => ({
            id: r.id,
            descricao: r.descricao,
            valor: r.valor,
            categoria: r.categoria,
            data: r.data,
            criadoEm: r.criado_em,
          }))
        );
      }
      setLoading(false);
    });
  }, [userId, refreshTrigger]);

  const now = new Date();
  const despMes = despesas.filter((d) => {
    const dd = new Date(d.data + "T00:00:00");
    return (
      dd.getMonth() === now.getMonth() && dd.getFullYear() === now.getFullYear()
    );
  });
  const totalDespMes = despMes.reduce((s, d) => s + d.valor, 0);
  const totalEntradaMes = calcEarnings(jobs, receitas, "mes");
  const saldo = totalEntradaMes - totalDespMes;

  async function deleteDespesa(id: string) {
    await supabase.from("despesas").delete().eq("id", id);
    setDespesas((prev) => prev.filter((d) => d.id !== id));
  }

  async function deleteReceita(id: string) {
    await supabase.from("receitas_avulsas").delete().eq("id", id);
    setReceitas((prev) => prev.filter((r) => r.id !== id));
  }

  async function saveObjetivo() {
    if (!objTitulo.trim()) return;
    setObjSaving(true);
    await supabase.from("objetivos").insert({
      user_id: userId,
      titulo: objTitulo.trim(),
      categoria: objCat,
    });
    setObjSaving(false);
    setObjTitulo("");
    setObjCat("afazeres");
    setObjFormOpen(false);
    onObjetivoAdded();
  }

  const chartData = buildChartData(jobs, receitas, chartPeriod);
  const sparkData = last30DaysSpark(jobs, receitas);

  const TABS: { id: InnerTab; label: string }[] = [
    { id: "visao", label: "Visão" },
    { id: "entradas", label: "Entradas" },
    { id: "saidas", label: "Saídas" },
    { id: "metas", label: "Metas" },
  ];

  const PERIOD_OPTS: { id: ChartPeriod; label: string }[] = [
    { id: "sem", label: "S" },
    { id: "mes", label: "M" },
    { id: "ano", label: "A" },
  ];

  return (
    <div className="pb-4">
      <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>
        Financeiro
      </h2>

      {/* Inner tabs */}
      <div
        className="flex gap-1 p-1 rounded-2xl mb-5"
        style={{ background: "var(--surface)" }}
      >
        {TABS.map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => changeTab(id)}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#fff" : "var(--text-muted)",
                boxShadow: active ? "var(--glow-sm)" : "none",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center pt-12">
          <div
            className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent)" }}
          />
        </div>
      ) : (
        <>
          {/* ── VISÃO ── */}
          {tab === "visao" && (
            <div className="space-y-4">
              {/* Entradas / Saídas cards */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="glass-card rounded-2xl p-4 flex flex-col gap-1"
                  style={{ borderLeft: "3px solid #22c55e" }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp size={13} color="#22c55e" />
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "#22c55e" }}
                    >
                      Entradas
                    </p>
                  </div>
                  <p
                    className="font-extrabold text-[17px] tabular-nums leading-none"
                    style={{ color: "var(--text)" }}
                  >
                    {formatBRLShort(totalEntradaMes)}
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    este mês
                  </p>
                </div>
                <div
                  className="glass-card rounded-2xl p-4 flex flex-col gap-1"
                  style={{ borderLeft: "3px solid #ef4444" }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingDown size={13} color="#ef4444" />
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "#ef4444" }}
                    >
                      Saídas
                    </p>
                  </div>
                  <p
                    className="font-extrabold text-[17px] tabular-nums leading-none"
                    style={{ color: "var(--text)" }}
                  >
                    {formatBRLShort(totalDespMes)}
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    este mês
                  </p>
                </div>
              </div>

              {/* Saldo */}
              <div className="glass-card rounded-2xl p-4">
                <p
                  className="text-xs font-bold uppercase tracking-wider mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Saldo do mês
                </p>
                <p
                  className="font-extrabold text-[26px] tabular-nums"
                  style={{
                    color: saldo >= 0 ? "var(--accent)" : "#ef4444",
                    letterSpacing: "-0.03em",
                    textShadow:
                      saldo >= 0
                        ? "0 0 18px rgb(var(--accent-rgb) / 0.4)"
                        : "0 0 18px rgba(239,68,68,0.4)",
                  }}
                >
                  {formatBRL(saldo)}
                </p>
              </div>

              {/* Chart com seletor de período */}
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Receitas
                  </p>
                  {chartType !== "area" && (
                    <div
                      className="flex gap-1 p-0.5 rounded-xl"
                      style={{ background: "var(--surface-2, var(--surface))" }}
                    >
                      {PERIOD_OPTS.map(({ id, label }) => {
                        const active = chartPeriod === id;
                        return (
                          <button
                            key={id}
                            onClick={() => setChartPeriod(id)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
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
                  )}
                </div>
                {chartType === "area" ? (
                  <AreaSparkline data={sparkData} height={90} id="fin-area" />
                ) : (
                  <MiniBarChart data={chartData} height={110} id="fin-bar" />
                )}
              </div>
            </div>
          )}

          {/* ── ENTRADAS ── */}
          {tab === "entradas" && (
            <div>
              {/* Header total */}
              <div className="glass-card rounded-2xl p-4 mb-4 flex items-center justify-between">
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wider mb-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Total este mês
                  </p>
                  <p
                    className="font-extrabold text-[22px] tabular-nums"
                    style={{ color: "#22c55e" }}
                  >
                    {formatBRL(totalEntradaMes)}
                  </p>
                </div>
                <TrendingUp
                  size={24}
                  color="#22c55e"
                  style={{ opacity: 0.5 }}
                />
              </div>

              <button
                onClick={() => onAddReceita?.()}
                className="flex items-center gap-2 w-full py-3 rounded-2xl mb-4 font-bold text-sm transition-all active:scale-[0.98]"
                style={{
                  background: "rgba(34,197,94,0.1)",
                  color: "#22c55e",
                  border: "1px dashed rgba(34,197,94,0.35)",
                }}
              >
                <Plus
                  size={16}
                  style={{ marginLeft: "auto", marginRight: 4 }}
                />
                <span style={{ marginRight: "auto" }}>Nova Entrada</span>
              </button>

              {/* Lista: jobs concluídos + receitas avulsas ordenados por data */}
              {(() => {
                const jobEntradas = jobs
                  .filter((j) => j.status === "concluído")
                  .map((j) => ({
                    id: j.id,
                    desc: j.clienteNome,
                    valor: j.valor,
                    data: j.data,
                    tipo: "job" as const,
                    cat: "job",
                  }));
                const recEntradas = receitas.map((r) => ({
                  id: r.id,
                  desc: r.descricao,
                  valor: r.valor,
                  data: r.data,
                  tipo: "receita" as const,
                  cat: r.categoria,
                }));
                const all = [...jobEntradas, ...recEntradas].sort((a, b) =>
                  b.data.localeCompare(a.data)
                );
                if (all.length === 0)
                  return (
                    <p
                      className="text-sm text-center pt-12"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Nenhuma entrada ainda.
                    </p>
                  );
                return (
                  <div className="space-y-2">
                    {all.map((item) => (
                      <div
                        key={item.tipo + item.id}
                        className="glass-card flex items-center gap-3 px-4 py-3 rounded-2xl"
                      >
                        <span style={{ fontSize: 20 }}>
                          {item.tipo === "job"
                            ? "💼"
                            : (REC_CAT_EMOJIS[item.cat] ?? "💰")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-semibold text-sm truncate"
                            style={{ color: "var(--text)" }}
                          >
                            {item.desc}
                          </p>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {item.tipo === "job"
                              ? "Job"
                              : (REC_CAT_LABELS[item.cat] ?? item.cat)}{" "}
                            · {formatDate(item.data)}
                          </p>
                        </div>
                        <span
                          className="font-bold text-sm tabular-nums shrink-0"
                          style={{ color: "#22c55e" }}
                        >
                          +{formatBRLShort(item.valor)}
                        </span>
                        {item.tipo === "receita" && (
                          <button
                            onClick={() => deleteReceita(item.id)}
                            className="shrink-0 flex items-center justify-center rounded-lg transition-opacity active:opacity-50"
                            style={{
                              width: 28,
                              height: 28,
                              background: "rgba(255,80,80,0.08)",
                            }}
                          >
                            <Trash2 size={13} color="#ff5050" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── SAÍDAS ── */}
          {tab === "saidas" && (
            <div>
              {/* Header total */}
              <div className="glass-card rounded-2xl p-4 mb-4 flex items-center justify-between">
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wider mb-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Total este mês
                  </p>
                  <p
                    className="font-extrabold text-[22px] tabular-nums"
                    style={{ color: "#ef4444" }}
                  >
                    {formatBRL(totalDespMes)}
                  </p>
                </div>
                <TrendingDown
                  size={24}
                  color="#ef4444"
                  style={{ opacity: 0.5 }}
                />
              </div>

              <button
                onClick={() => onAddDespesa?.()}
                className="flex items-center gap-2 w-full py-3 rounded-2xl mb-4 font-bold text-sm transition-all active:scale-[0.98]"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  color: "#ef4444",
                  border: "1px dashed rgba(239,68,68,0.35)",
                }}
              >
                <Plus
                  size={16}
                  style={{ marginLeft: "auto", marginRight: 4 }}
                />
                <span style={{ marginRight: "auto" }}>Nova Saída</span>
              </button>

              {/* Breakdown por categoria */}
              {despMes.length > 0 && (
                <div className="glass-card rounded-2xl p-4 mb-4">
                  <p
                    className="text-xs font-bold uppercase tracking-wider mb-3"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Por categoria
                  </p>
                  {Object.entries(
                    despMes.reduce(
                      (acc, d) => {
                        acc[d.categoria] = (acc[d.categoria] || 0) + d.valor;
                        return acc;
                      },
                      {} as Record<string, number>
                    )
                  )
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, val]) => {
                      const maxVal = Math.max(
                        ...Object.values(
                          despMes.reduce(
                            (acc, d) => {
                              acc[d.categoria] =
                                (acc[d.categoria] || 0) + d.valor;
                              return acc;
                            },
                            {} as Record<string, number>
                          )
                        ),
                        1
                      );
                      return (
                        <div
                          key={cat}
                          className="flex items-center gap-3 mb-2.5"
                        >
                          <span style={{ fontSize: 16 }}>
                            {CAT_EMOJIS[cat] ?? "📦"}
                          </span>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span
                                className="text-xs font-medium"
                                style={{ color: "var(--text)" }}
                              >
                                {CAT_LABELS[cat] ?? cat}
                              </span>
                              <span
                                className="text-xs tabular-nums"
                                style={{ color: "#ef4444" }}
                              >
                                {formatBRLShort(val)}
                              </span>
                            </div>
                            <div
                              className="progress-track"
                              style={{ height: 3 }}
                            >
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${(val / maxVal) * 100}%`,
                                  transition: "width 0.6s ease",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {despesas.length === 0 ? (
                <p
                  className="text-sm text-center pt-8"
                  style={{ color: "var(--text-muted)" }}
                >
                  Nenhuma despesa registrada.
                </p>
              ) : (
                <div className="space-y-2">
                  {despesas.map((d) => (
                    <div
                      key={d.id}
                      className="glass-card flex items-center gap-3 px-4 py-3 rounded-2xl"
                    >
                      <span style={{ fontSize: 20 }}>
                        {CAT_EMOJIS[d.categoria] ?? "📦"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-semibold text-sm truncate"
                          style={{ color: "var(--text)" }}
                        >
                          {d.descricao}
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {CAT_LABELS[d.categoria] ?? d.categoria} ·{" "}
                          {formatDate(d.data)}
                        </p>
                      </div>
                      <span
                        className="font-bold text-sm tabular-nums shrink-0"
                        style={{ color: "#ef4444" }}
                      >
                        -{formatBRLShort(d.valor)}
                      </span>
                      <button
                        onClick={() => deleteDespesa(d.id)}
                        className="shrink-0 flex items-center justify-center rounded-lg transition-opacity active:opacity-50"
                        style={{
                          width: 28,
                          height: 28,
                          background: "rgba(255,80,80,0.1)",
                        }}
                      >
                        <Trash2 size={13} color="#ff5050" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── METAS ── */}
          {tab === "metas" && (
            <div className="space-y-4">
              {/* Metas financeiras */}
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Target size={14} style={{ color: "var(--accent)" }} />
                  <p
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Metas Financeiras
                  </p>
                </div>
                <div className="flex flex-col gap-5">
                  {metas
                    .sort(
                      (a, b) =>
                        ["dia", "mes", "ano"].indexOf(a.periodo) -
                        ["dia", "mes", "ano"].indexOf(b.periodo)
                    )
                    .map((meta) => {
                      const current = calcEarnings(
                        jobs,
                        receitas,
                        meta.periodo
                      );
                      const pct = Math.min(
                        100,
                        (current / meta.valorAlvo) * 100
                      );
                      const done = pct >= 100;
                      return (
                        <div key={meta.periodo}>
                          <div className="flex items-baseline justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-sm font-semibold"
                                style={{ color: "var(--text)" }}
                              >
                                {PERIODO_LABELS[meta.periodo]}
                              </span>
                              {done && (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-px rounded-full"
                                  style={{
                                    background: "rgb(var(--accent-rgb) / 0.15)",
                                    color: "var(--accent)",
                                    border:
                                      "1px solid rgb(var(--accent-rgb) / 0.3)",
                                  }}
                                >
                                  ✓ Meta
                                </span>
                              )}
                            </div>
                            <span
                              className="text-xs tabular-nums"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {formatBRLShort(current)} /{" "}
                              {formatBRLShort(meta.valorAlvo)}
                            </span>
                          </div>
                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${pct}%`,
                                transition:
                                  "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Objetivos de vida */}
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 14 }}>🌟</span>
                    <p
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Objetivos de Vida
                    </p>
                  </div>
                  <button
                    onClick={() => setObjFormOpen((v) => !v)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                    style={{
                      background: objFormOpen
                        ? "var(--accent)"
                        : "rgb(var(--accent-rgb) / 0.12)",
                      color: objFormOpen ? "#fff" : "var(--accent)",
                      border: `1px solid rgb(var(--accent-rgb) / 0.3)`,
                    }}
                  >
                    <Plus size={12} />
                    Novo
                  </button>
                </div>

                {/* Form inline */}
                {objFormOpen && (
                  <div
                    className="rounded-2xl p-3 mb-4"
                    style={{
                      background: "rgb(var(--accent-rgb) / 0.05)",
                      border: "1px solid rgb(var(--accent-rgb) / 0.15)",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Título do objetivo..."
                      value={objTitulo}
                      onChange={(e) => setObjTitulo(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 mb-2 text-sm font-medium outline-none"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border-color)",
                        color: "var(--text)",
                      }}
                    />
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {OBJ_CATS.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setObjCat(c.id)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                          style={{
                            background:
                              objCat === c.id
                                ? "var(--accent)"
                                : "var(--surface)",
                            color:
                              objCat === c.id ? "#fff" : "var(--text-muted)",
                            border: `1px solid ${objCat === c.id ? "var(--accent)" : "var(--border-color)"}`,
                          }}
                        >
                          {c.emoji} {c.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setObjFormOpen(false)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold"
                        style={{
                          background: "var(--surface)",
                          color: "var(--text-muted)",
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={saveObjetivo}
                        disabled={objSaving || !objTitulo.trim()}
                        className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                        style={{
                          background: "var(--accent)",
                          color: "#fff",
                          opacity: objSaving || !objTitulo.trim() ? 0.6 : 1,
                        }}
                      >
                        {objSaving ? "..." : "Salvar"}
                      </button>
                    </div>
                  </div>
                )}

                {objetivos.length === 0 ? (
                  <p
                    className="text-sm text-center py-6"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Nenhum objetivo ainda. Toque em + Novo para criar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {objetivos.map((obj) => (
                      <button
                        key={obj.id}
                        onClick={() => onToggleObjetivo(obj.id, !obj.concluido)}
                        className="flex items-center gap-3 w-full text-left px-3 py-3 rounded-xl transition-all active:scale-[0.98]"
                        style={{
                          background: obj.concluido
                            ? "rgb(var(--accent-rgb) / 0.06)"
                            : "var(--surface)",
                          border: `1px solid ${obj.concluido ? "rgb(var(--accent-rgb) / 0.2)" : "var(--border-color)"}`,
                        }}
                      >
                        <div
                          className="shrink-0 flex items-center justify-center rounded-full border-2 transition-all"
                          style={{
                            width: 22,
                            height: 22,
                            borderColor: obj.concluido
                              ? "var(--accent)"
                              : "var(--border-color)",
                            background: obj.concluido
                              ? "var(--accent)"
                              : "transparent",
                          }}
                        >
                          {obj.concluido && (
                            <Check size={12} color="white" strokeWidth={3} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-semibold truncate"
                            style={{
                              color: obj.concluido
                                ? "var(--text-muted)"
                                : "var(--text)",
                              textDecoration: obj.concluido
                                ? "line-through"
                                : "none",
                            }}
                          >
                            {obj.titulo}
                          </p>
                          <p
                            className="text-[10px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {
                              OBJ_CATS.find((c) => c.id === obj.categoria)
                                ?.emoji
                            }{" "}
                            {OBJ_CATS.find((c) => c.id === obj.categoria)
                              ?.label ?? obj.categoria}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
