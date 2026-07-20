"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { calcEarnings } from "@/lib/finance";
import { DEFAULT_METAS } from "./constants";
import { VisaoTab } from "./VisaoTab";
import { EntradasTab } from "./EntradasTab";
import { SaidasTab } from "./SaidasTab";
import { MetasTab } from "./MetasTab";
import type {
  Job,
  Meta,
  Despesa,
  ReceitaAvulsa,
  Objetivo,
  PeriodoMeta,
} from "@/lib/types";

type InnerTab = "visao" | "entradas" | "saidas" | "metas";

const TABS: { id: InnerTab; label: string }[] = [
  { id: "visao", label: "Visão" },
  { id: "entradas", label: "Entradas" },
  { id: "saidas", label: "Saídas" },
  { id: "metas", label: "Metas" },
];

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

  return (
    <div className="pb-4">
      <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>
        Financeiro
      </h2>

      <SegmentedControl
        className="mb-5"
        options={TABS}
        value={tab}
        onChange={changeTab}
      />

      {loading ? (
        <div className="flex justify-center pt-12">
          <div
            className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent)" }}
          />
        </div>
      ) : (
        <>
          {tab === "visao" && (
            <VisaoTab
              jobs={jobs}
              receitas={receitas}
              totalEntradaMes={totalEntradaMes}
              totalDespMes={totalDespMes}
              saldo={saldo}
              chartType={chartType}
            />
          )}
          {tab === "entradas" && (
            <EntradasTab
              jobs={jobs}
              receitas={receitas}
              totalEntradaMes={totalEntradaMes}
              onAddReceita={onAddReceita}
              onDeleteReceita={deleteReceita}
            />
          )}
          {tab === "saidas" && (
            <SaidasTab
              despesas={despesas}
              despMes={despMes}
              totalDespMes={totalDespMes}
              onAddDespesa={onAddDespesa}
              onDeleteDespesa={deleteDespesa}
            />
          )}
          {tab === "metas" && (
            <MetasTab
              jobs={jobs}
              receitas={receitas}
              metas={metas}
              objetivos={objetivos}
              userId={userId}
              onObjetivoAdded={onObjetivoAdded}
              onToggleObjetivo={onToggleObjetivo}
            />
          )}
        </>
      )}
    </div>
  );
}
