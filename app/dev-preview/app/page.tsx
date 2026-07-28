"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { BottomNav } from "@/components/BottomNav";
import { FAB } from "@/components/FAB";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import { HeroCard } from "@/components/home/HeroCard";
import { NextJobCard } from "@/components/home/NextJobCard";
import { ObjetivosCard } from "@/components/home/ObjetivosCard";
import { JobsTab } from "@/components/jobs/JobsTab";
import { JobForm } from "@/components/jobs/JobForm";
import { FinanceiroTab } from "@/components/financeiro/FinanceiroTab";
import { MetaForm } from "@/components/financeiro/MetaForm";
import { DespesaForm } from "@/components/financeiro/DespesaForm";
import { ReceitaForm } from "@/components/financeiro/ReceitaForm";
import { CofreTab } from "@/components/cofre/CofreTab";
import { UploadSheet } from "@/components/cofre/UploadSheet";
import { RedeGatedTab } from "@/components/rede/RedeGatedTab";
import { AjustesTab } from "@/components/ajustes/AjustesTab";
import { PinScreen } from "@/components/pin/PinScreen";
import { RecapSheet } from "@/components/recap/RecapSheet";
import { InstallBanner } from "@/components/install/InstallBanner";
import { useToast } from "@/components/Toast";
import { supabase, __setMockSupabaseClient } from "@/lib/supabase";
import { createMockSupabaseClient } from "@/lib/mockSupabase";
import { buildMockAppSeed, MOCK_APP_USUARIO } from "@/lib/mockAppData";
import type {
  TabId,
  Job,
  Meta,
  Objetivo,
  HomeCardConfig,
  ChartPrefConfig,
} from "@/lib/types";

/**
 * Cópia completa da casca do app (pílula flutuante, todas as 6 abas),
 * 100% mockada — sem Supabase de verdade, sem login. Existe só pra ver o
 * frontend inteiro navegável (transições, abas) antes de fechar como isso
 * se conecta ao backend real. A aba Rede usa o gate (vitrine → código de
 * acesso → Feed completo) em vez da RedeTeaserTab estática de produção.
 */

const DEFAULT_HOME_CARDS: HomeCardConfig = {
  nextJob: true,
  financeSummary: true,
  objetivos: true,
};
const DEFAULT_CHART_PREFS: ChartPrefConfig = { financeiro: "bar", jobs: "bar" };

export default function DevPreviewApp() {
  // Ativa o client mockado uma única vez, síncrono, antes de qualquer aba
  // filha montar e disparar seu próprio fetch (que agora cai no mock).
  const mockInitialized = useRef(false);
  if (!mockInitialized.current) {
    mockInitialized.current = true;
    __setMockSupabaseClient(createMockSupabaseClient(buildMockAppSeed()));
  }

  const toast = useToast();
  const usuario = MOCK_APP_USUARIO;

  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [fabOpen, setFabOpen] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);

  const [pinHash, setPinHash] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const [dataLoaded, setDataLoaded] = useState(false);

  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobsRefreshKey, setJobsRefreshKey] = useState(0);

  const [metaFormOpen, setMetaFormOpen] = useState(false);
  const [despesaFormOpen, setDespesaFormOpen] = useState(false);
  const [receitaFormOpen, setReceitaFormOpen] = useState(false);
  const [financeiroRefreshKey, setFinanceiroRefreshKey] = useState(0);
  const [objetivosRefreshKey, setObjetivosRefreshKey] = useState(0);

  const [finInnerTab, setFinInnerTab] = useState("visao");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [cofreRefreshKey, setCofreRefreshKey] = useState(0);

  const [homeCards] = useState<HomeCardConfig>(DEFAULT_HOME_CARDS);
  const [chartPrefs, setChartPrefs] =
    useState<ChartPrefConfig>(DEFAULT_CHART_PREFS);

  // Simula o teclado no chat da Rede — some com a BottomNav, como no
  // preview isolado de /dev-preview/rede.
  const [chatComposerFocused, setChatComposerFocused] = useState(false);

  useEffect(() => {
    if (locked) return;
    Promise.all([
      supabase.from("jobs").select("*").order("data").order("hora"),
      supabase.from("metas").select("*").eq("user_id", usuario.id),
    ]).then(([{ data: jobsData }, { data: metasData }]) => {
      if (jobsData) {
        setJobs(
          (jobsData as Record<string, unknown>[]).map((j) => ({
            id: j.id as string,
            clienteNome: j.cliente_nome as string,
            data: j.data as string,
            hora: j.hora as string,
            valor: j.valor as number,
            modalidade: j.modalidade as Job["modalidade"],
            local: (j.local as string | null) ?? undefined,
            status: j.status as Job["status"],
            observacoes: (j.observacoes as string | null) ?? undefined,
            criadoEm: j.criado_em as string,
          }))
        );
      }
      if (metasData) {
        setMetas(
          (metasData as Record<string, unknown>[]).map((m) => ({
            periodo: m.periodo as Meta["periodo"],
            valorAlvo: m.valor_alvo as number,
          }))
        );
      }
      setDataLoaded(true);
    });
  }, [locked, jobsRefreshKey, financeiroRefreshKey, usuario.id]);

  useEffect(() => {
    if (locked) return;
    supabase
      .from("objetivos")
      .select("*")
      .eq("user_id", usuario.id)
      .order("criado_em", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setObjetivos(
            (data as Record<string, unknown>[]).map((r) => ({
              id: r.id as string,
              titulo: r.titulo as string,
              descricao: (r.descricao as string | null) ?? undefined,
              categoria: r.categoria as string,
              concluido: r.concluido as boolean,
              criadoEm: r.criado_em as string,
            }))
          );
        }
      });
  }, [locked, objetivosRefreshKey, usuario.id]);

  function handleSignOut() {
    toast.success("Preview não tem sessão real — recarregando do zero.");
    window.location.reload();
  }

  function handleTabChange(tab: TabId) {
    setActiveTab(tab);
    setFabOpen(false);
  }

  function handleFabAction() {
    if (activeTab === "jobs" || activeTab === "home") {
      setEditingJob(null);
      setJobFormOpen(true);
    } else if (activeTab === "financeiro") {
      if (finInnerTab === "entradas") setReceitaFormOpen(true);
      else if (finInnerTab === "saidas") setDespesaFormOpen(true);
      else if (finInnerTab === "metas") setMetaFormOpen(true);
      else setDespesaFormOpen(true);
    } else if (activeTab === "cofre") {
      setUploadOpen(true);
    }
  }

  async function handleToggleObjetivo(id: string, concluido: boolean) {
    await supabase.from("objetivos").update({ concluido }).eq("id", id);
    setObjetivos((prev) =>
      prev.map((o) => (o.id === id ? { ...o, concluido } : o))
    );
  }

  if (locked && pinHash) {
    return <PinScreen pinHash={pinHash} onUnlock={() => setLocked(false)} />;
  }

  return (
    <div className="relative flex flex-col min-h-screen">
      <LoadingScreen isLoading={!dataLoaded} />

      <main
        className="flex-1 overflow-y-auto pb-40 px-4"
        style={{ paddingTop: "calc(24px + env(safe-area-inset-top, 0px))" }}
      >
        {activeTab === "home" && (
          <>
            <GreetingHeader usuario={usuario} />
            <div className="mt-6 space-y-4">
              <HeroCard
                jobs={jobs}
                metas={metas}
                onGoToFinanceiro={() => handleTabChange("financeiro")}
              />
              {homeCards.nextJob && <NextJobCard jobs={jobs} />}
              {(homeCards.objetivos ?? true) && (
                <ObjetivosCard
                  objetivos={objetivos}
                  onToggle={handleToggleObjetivo}
                  onGoToMetas={() => handleTabChange("financeiro")}
                />
              )}
              <InstallBanner />
            </div>
          </>
        )}

        {activeTab === "jobs" && (
          <JobsTab
            userId={usuario.id}
            refreshTrigger={jobsRefreshKey}
            chartType={chartPrefs.jobs}
            onEditJob={(job) => {
              setEditingJob(job);
              setJobFormOpen(true);
            }}
          />
        )}

        {activeTab === "financeiro" && (
          <FinanceiroTab
            userId={usuario.id}
            refreshTrigger={financeiroRefreshKey}
            chartType={chartPrefs.financeiro}
            onInnerTabChange={setFinInnerTab}
            onAddDespesa={() => setDespesaFormOpen(true)}
            onAddReceita={() => setReceitaFormOpen(true)}
            objetivos={objetivos}
            onObjetivoAdded={() => setObjetivosRefreshKey((k) => k + 1)}
            onToggleObjetivo={handleToggleObjetivo}
          />
        )}

        {activeTab === "cofre" && (
          <CofreTab userId={usuario.id} refreshTrigger={cofreRefreshKey} />
        )}

        {activeTab === "rede" && (
          <RedeGatedTab
            usuario={usuario}
            onChatFocusChange={setChatComposerFocused}
          />
        )}

        {activeTab === "ajustes" && (
          <AjustesTab
            userId={usuario.id}
            jobs={jobs}
            onSignOut={handleSignOut}
            onPinHashChange={(h) => setPinHash(h)}
            onHomeCardsChange={() => {}}
            onCardStylesChange={() => {}}
            onChartPrefsChange={setChartPrefs}
          />
        )}
      </main>

      {!chatComposerFocused && (
        <>
          <FAB
            activeTab={activeTab}
            open={fabOpen}
            onToggle={() => setFabOpen((v) => !v)}
            onAction={handleFabAction}
          />
          <BottomNav activeTab={activeTab} onChange={handleTabChange} />
        </>
      )}

      {dataLoaded && <RecapSheet jobs={jobs} />}

      <JobForm
        open={jobFormOpen}
        job={editingJob}
        userId={usuario.id}
        onClose={() => setJobFormOpen(false)}
        onSaved={() => {
          setJobsRefreshKey((k) => k + 1);
          toast.success(
            editingJob ? "Atendimento atualizado!" : "Atendimento registrado!"
          );
        }}
      />
      <MetaForm
        open={metaFormOpen}
        userId={usuario.id}
        onClose={() => setMetaFormOpen(false)}
        onSaved={() => {
          setFinanceiroRefreshKey((k) => k + 1);
          toast.success("Meta salva!");
        }}
      />
      <DespesaForm
        open={despesaFormOpen}
        userId={usuario.id}
        onClose={() => setDespesaFormOpen(false)}
        onSaved={() => {
          setFinanceiroRefreshKey((k) => k + 1);
          toast.success("Despesa registrada!");
        }}
      />
      <ReceitaForm
        open={receitaFormOpen}
        userId={usuario.id}
        onClose={() => setReceitaFormOpen(false)}
        onSaved={() => {
          setFinanceiroRefreshKey((k) => k + 1);
          toast.success("Entrada registrada!");
        }}
      />
      <UploadSheet
        open={uploadOpen}
        userId={usuario.id}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setCofreRefreshKey((k) => k + 1);
          toast.success("Arquivo enviado!");
        }}
      />
    </div>
  );
}
