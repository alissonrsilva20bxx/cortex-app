"use client";

import { useState, useEffect } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { TabPanel } from "@/components/TabPanel";
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
import { OpeningMotion } from "@/components/entry/OpeningMotion";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { RecapSheet } from "@/components/recap/RecapSheet";
import { InstallBanner } from "@/components/install/InstallBanner";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import type {
  TabId,
  Usuario,
  Job,
  Meta,
  Objetivo,
  HomeCardConfig,
  CardStyleConfig,
  ChartPrefConfig,
} from "@/lib/types";

const DEFAULT_HOME_CARDS: HomeCardConfig = {
  nextJob: true,
  financeSummary: true,
  objetivos: true,
};
const DEFAULT_CARD_STYLES: CardStyleConfig = {
  nextJob: "standard",
  financeSummary: "standard",
};
const DEFAULT_CHART_PREFS: ChartPrefConfig = { financeiro: "bar", jobs: "bar" };

export default function Page() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [fabOpen, setFabOpen] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);

  const [pinHash, setPinHash] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  // Roda em paralelo com o fetch de usuário/PIN abaixo, não em sequência.
  const [entryDone, setEntryDone] = useState(false);

  // Distingue "ainda não sei se ela tem dados" de "confirmei que não tem" —
  // sem isso, uma usuária antiga com dados reais veria o onboarding piscar
  // na janela entre revelar `usuario` e o fetch de jobs/metas terminar.
  const [dataLoaded, setDataLoaded] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

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

  // Some com a BottomNav quando o composer do chat da Rede está focado,
  // igual ao shell mockado de /dev-preview/app.
  const [chatComposerFocused, setChatComposerFocused] = useState(false);

  const [homeCards, setHomeCards] =
    useState<HomeCardConfig>(DEFAULT_HOME_CARDS);
  const [cardStyles, setCardStyles] =
    useState<CardStyleConfig>(DEFAULT_CARD_STYLES);
  const [chartPrefs, setChartPrefs] =
    useState<ChartPrefConfig>(DEFAULT_CHART_PREFS);

  useEffect(() => {
    try {
      const hc = localStorage.getItem("jobapp-home-cards");
      if (hc) setHomeCards(JSON.parse(hc));
      const cs = localStorage.getItem("jobapp-card-styles");
      if (cs) setCardStyles(JSON.parse(cs));
      const cp = localStorage.getItem("jobapp-chart-prefs");
      if (cp) setChartPrefs(JSON.parse(cp));
    } catch (_) {}
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const u: Usuario = {
        id: data.user.id,
        nome:
          data.user.user_metadata?.full_name ?? data.user.email ?? "Usuário",
        email: data.user.email ?? "",
        avatarUrl: data.user.user_metadata?.avatar_url,
      };

      // Só revela o usuário (e libera as buscas de dados sensíveis) depois
      // de saber se há PIN a cumprir — evita a tela de conteúdo desenhar
      // (ou pré-carregar dados) antes da trava, mesmo por um instante (§5.2).
      supabase
        .from("configuracoes")
        .select("pin_hash")
        .eq("user_id", data.user.id)
        .single()
        .then(({ data: cfg }) => {
          if (cfg?.pin_hash) {
            setPinHash(cfg.pin_hash);
            setLocked(true);
          }
          setUsuario(u);
        });
    });
  }, []);

  // Re-trava ~30s depois de ir para segundo plano (§5.2): "abriu, minimizou,
  // alguém pegou" fecha aqui. Mede o tempo decorrido ao voltar, sem depender
  // de um timer rodando em background (que o navegador pode suspender).
  useEffect(() => {
    if (!pinHash) return;
    let hiddenAt: number | null = null;
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (document.visibilityState === "visible") {
        if (hiddenAt !== null && Date.now() - hiddenAt >= 30_000) {
          setLocked(true);
        }
        hiddenAt = null;
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [pinHash]);

  useEffect(() => {
    // Não busca dados sensíveis enquanto a trava do PIN está de pé (§5.2).
    if (!usuario || locked) return;
    Promise.all([
      supabase
        .from("jobs")
        .select("*")
        .eq("user_id", usuario.id)
        .order("data")
        .order("hora"),
      supabase.from("metas").select("*").eq("user_id", usuario.id),
    ]).then(([{ data: jobsData }, { data: metasData }]) => {
      if (jobsData) {
        setJobs(
          jobsData.map((j) => ({
            id: j.id,
            clienteNome: j.cliente_nome,
            data: j.data,
            hora: j.hora,
            valor: j.valor,
            modalidade: j.modalidade,
            local: j.local ?? undefined,
            status: j.status,
            observacoes: j.observacoes ?? undefined,
            criadoEm: j.criado_em,
          }))
        );
      }
      if (metasData) {
        setMetas(
          metasData.map((m) => ({
            periodo: m.periodo,
            valorAlvo: m.valor_alvo,
          }))
        );
      }
      setDataLoaded(true);
    });
  }, [usuario, locked, jobsRefreshKey, financeiroRefreshKey]);

  useEffect(() => {
    if (!usuario || locked) return;
    supabase
      .from("objetivos")
      .select("*")
      .eq("user_id", usuario.id)
      .order("criado_em", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setObjetivos(
            data.map((r) => ({
              id: r.id,
              titulo: r.titulo,
              descricao: r.descricao ?? undefined,
              categoria: r.categoria,
              concluido: r.concluido,
              criadoEm: r.criado_em,
            }))
          );
        }
      });
  }, [usuario, locked, objetivosRefreshKey]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
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

  if (!entryDone) {
    return <OpeningMotion onDone={() => setEntryDone(true)} />;
  }

  if (locked && pinHash) {
    return <PinScreen pinHash={pinHash} onUnlock={() => setLocked(false)} />;
  }

  // 1º uso: sem meta e sem atendimento nenhum, uma vez confirmado (não só
  // "ainda carregando"). Guia até o "aha" antes de soltar as abas (§6).
  const isNewUser =
    !!usuario &&
    dataLoaded &&
    jobs.length === 0 &&
    metas.length === 0 &&
    !onboardingDone;

  return (
    <div className="relative flex flex-col min-h-screen">
      <LoadingScreen isLoading={!usuario || !dataLoaded} />

      <main
        className="flex-1 overflow-y-auto pb-40 px-4"
        style={{ paddingTop: "calc(24px + env(safe-area-inset-top, 0px))" }}
      >
        {isNewUser && usuario && (
          <OnboardingFlow
            usuario={usuario}
            jobs={jobs}
            metas={metas}
            onOpenJobForm={() => {
              setEditingJob(null);
              setJobFormOpen(true);
            }}
            onMetaSaved={() => setFinanceiroRefreshKey((k) => k + 1)}
            onPinSaved={(h) => setPinHash(h)}
            onComplete={() => setOnboardingDone(true)}
          />
        )}

        {!isNewUser && usuario && (
          <>
            <TabPanel tab="home" activeTab={activeTab}>
              <GreetingHeader usuario={usuario} />
              <div className="mt-6 space-y-4">
                {/* Card-herói: a projeção viva das metas (o coração) */}
                <HeroCard
                  jobs={jobs}
                  metas={metas}
                  onGoToFinanceiro={() => handleTabChange("financeiro")}
                />

                {/* Próximo atendimento — o motor diário */}
                {homeCards.nextJob && <NextJobCard jobs={jobs} />}

                {/* Objetivos pessoais */}
                {(homeCards.objetivos ?? true) && (
                  <ObjetivosCard
                    objetivos={objetivos}
                    onToggle={handleToggleObjetivo}
                    onGoToMetas={() => handleTabChange("financeiro")}
                  />
                )}

                {/* Convite de instalação — dispensável, nunca compete com o
                    card-herói pela atenção (por isso vem por último). */}
                <InstallBanner />
              </div>
            </TabPanel>

            <TabPanel tab="jobs" activeTab={activeTab}>
              <JobsTab
                userId={usuario.id}
                refreshTrigger={jobsRefreshKey}
                chartType={chartPrefs.jobs}
                onEditJob={(job) => {
                  setEditingJob(job);
                  setJobFormOpen(true);
                }}
              />
            </TabPanel>

            <TabPanel tab="financeiro" activeTab={activeTab}>
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
            </TabPanel>

            <TabPanel tab="cofre" activeTab={activeTab}>
              <CofreTab
                userId={usuario.id}
                refreshTrigger={cofreRefreshKey}
                pinHash={pinHash}
                active={activeTab === "cofre"}
              />
            </TabPanel>

            <TabPanel tab="rede" activeTab={activeTab}>
              <RedeGatedTab
                usuario={usuario}
                onChatFocusChange={setChatComposerFocused}
              />
            </TabPanel>

            <TabPanel tab="ajustes" activeTab={activeTab}>
              <AjustesTab
                userId={usuario.id}
                jobs={jobs}
                onSignOut={handleSignOut}
                onPinHashChange={(h) => setPinHash(h)}
                onHomeCardsChange={setHomeCards}
                onCardStylesChange={setCardStyles}
                onChartPrefsChange={setChartPrefs}
              />
            </TabPanel>
          </>
        )}
      </main>

      {!isNewUser && !chatComposerFocused && (
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

      {!isNewUser && usuario && dataLoaded && <RecapSheet jobs={jobs} />}

      {usuario && (
        <>
          <JobForm
            open={jobFormOpen}
            job={editingJob}
            userId={usuario.id}
            onClose={() => setJobFormOpen(false)}
            onSaved={() => {
              setJobsRefreshKey((k) => k + 1);
              toast.success(
                editingJob
                  ? "Atendimento atualizado!"
                  : "Atendimento registrado!"
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
        </>
      )}
    </div>
  );
}
