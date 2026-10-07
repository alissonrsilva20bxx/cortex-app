"use client";

import { useEffect, useRef, useState } from "react";
import { TabPanel } from "@/components/TabPanel";
import { BottomNav } from "@/components/BottomNav";
import { FAB } from "@/components/FAB";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import { HeroCard } from "@/components/home/HeroCard";
import { NextJobCard } from "@/components/home/NextJobCard";
import { ObjetivosCard } from "@/components/home/ObjetivosCard";
import { FaltaMetaCard } from "@/components/home/FaltaMetaCard";
import { CofreCard } from "@/components/home/CofreCard";
import { SemanaSection } from "@/components/home/SemanaSection";
import { ProximosAtendimentos } from "@/components/home/ProximosAtendimentos";
import { JornadaCard } from "@/components/home/JornadaCard";
import { JornadaScreen } from "@/components/jornada/JornadaScreen";
import { ComemoracaoHost } from "@/components/jornada/celebracao/ComemoracaoHost";
import {
  lojaDaUsuaria,
  usarTransporteDeLaboratorio,
} from "@/lib/jornada/cliente";
import {
  criarTransporteJornadaLaboratorio,
  estadoJornadaAno,
  estadoJornadaContaNova,
  estadoJornadaExemplo,
  NOME_DO_PROTOTIPO,
  prepararComemoracaoDeLaboratorio,
  type DemoDeComemoracao,
} from "@/lib/mockJornada";
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
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { AppTour } from "@/components/onboarding/AppTour";
import type { RedeAcessoTour } from "@/lib/appTour";
import { RecapSheet } from "@/components/recap/RecapSheet";
import { InstallBanner } from "@/components/install/InstallBanner";
import { useToast } from "@/components/Toast";
import { supabase, __setMockSupabaseClient } from "@/lib/supabase";
import { useTabSwipe } from "@/lib/useTabSwipe";
import { createMockSupabaseClient } from "@/lib/mockSupabase";
import { buildMockAppSeed, MOCK_APP_USUARIO } from "@/lib/mockAppData";
import {
  enableDevPreviewGateSession,
  disableDevPreviewGateSession,
  type DevPreviewSessionStatus,
} from "@/lib/devPreview/clientSession";
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
 * se conecta ao backend real. A aba Rede usa o mesmo RedeGatedTab (vitrine
 * → código de acesso → Feed completo) da rota real.
 */

const DEFAULT_HOME_CARDS: HomeCardConfig = {
  nextJob: true,
  financeSummary: true,
  objetivos: true,
  agenda: true,
};
const DEFAULT_CHART_PREFS: ChartPrefConfig = { financeiro: "bar", jobs: "bar" };

export default function DevPreviewApp() {
  // Ativa o client mockado uma única vez, síncrono, antes de qualquer aba
  // filha montar e disparar seu próprio fetch (que agora cai no mock).
  const mockInitialized = useRef(false);
  if (!mockInitialized.current) {
    mockInitialized.current = true;
    // `?objetivos=0|1|N` — só diagnóstico do vão NextJobCard→ObjetivosCard
    // (#131, validação real): reproduz os 3 estados do critério de aceite
    // sem precisar de conta real. Ausente ou inválido = comportamento de
    // sempre (todos). Ver comentário de `buildMockAppSeed` em mockAppData.ts.
    const objetivosParam =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("objetivos")
        : null;
    const objetivosCount =
      objetivosParam !== null && /^\d+$/.test(objetivosParam)
        ? Number(objetivosParam)
        : undefined;
    __setMockSupabaseClient(
      createMockSupabaseClient(
        buildMockAppSeed({ objetivosCount }),
        MOCK_APP_USUARIO.id
      )
    );
    // "Sua Jornada" (J12): sem servidor, o estado vem de lib/mockJornada.ts.
    // `?jornada=nova` mostra a conta nova (tudo zero); sem o parâmetro, uma
    // usuária com algumas semanas de Jornada.
    const jornadaParam =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("jornada")
        : null;
    usarTransporteDeLaboratorio(
      criarTransporteJornadaLaboratorio(
        jornadaParam === "nova"
          ? estadoJornadaContaNova()
          : jornadaParam === "ano"
            ? estadoJornadaAno()
            : estadoJornadaExemplo()
      )
    );
  }

  const toast = useToast();
  // `?jornada=agora|ano`: a usuária do protótipo da Jornada (Bella), pra a
  // tela sair igual à referência; sem o parâmetro, a usuária dos mockups.
  const [usuario] = useState(() => {
    const jornada =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("jornada")
        : null;
    return jornada === "agora" || jornada === "ano"
      ? { ...MOCK_APP_USUARIO, nome: NOME_DO_PROTOTIPO }
      : MOCK_APP_USUARIO;
  });

  // Só afeta as duas chamadas reais do Gate da Rede (solicitar-beta,
  // convites) — anexa um bearer token de uma conta de teste local
  // descartável via window.fetch, sem RedeTeaserGate/SerialKeySheet
  // saberem que isso existe (mesmo princípio do __setMockSupabaseClient
  // acima: mock só no harness, nunca no componente real). Sem Supabase
  // local rodando, o status fica "unavailable" com o motivo exato — ver
  // banner na aba Rede logo abaixo.
  const [devPreviewSession, setDevPreviewSession] =
    useState<DevPreviewSessionStatus>({ kind: "loading" });
  useEffect(() => {
    let ativo = true;
    enableDevPreviewGateSession().then((status) => {
      if (ativo) setDevPreviewSession(status);
    });
    return () => {
      ativo = false;
      disableDevPreviewGateSession();
    };
  }, []);

  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [redeReselect, setRedeReselect] = useState(0);
  const [fabOpen, setFabOpen] = useState(false);
  const [jornadaAberta, setJornadaAberta] = useState(false);

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
  // Pulso de navegação pro Financeiro abrir direto numa sub-aba específica
  // ("metas" pro "Ver todos" de Objetivos, "visao" pro CTA "Ver minha
  // evolução" do HeroCard — issue #134) — ver comentário de `focusTab` em
  // FinanceiroTab.tsx (redesign iOS #122/#125).
  const [financeiroFocusTab, setFinanceiroFocusTab] = useState<
    "metas" | "visao" | null
  >(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [cofreRefreshKey, setCofreRefreshKey] = useState(0);

  const [homeCards] = useState<HomeCardConfig>(DEFAULT_HOME_CARDS);
  const [chartPrefs, setChartPrefs] =
    useState<ChartPrefConfig>(DEFAULT_CHART_PREFS);

  // Simula o teclado no chat da Rede — some com a BottomNav, como no
  // preview isolado de /dev-preview/rede.
  const [chatComposerFocused, setChatComposerFocused] = useState(false);

  // Gancho de teste (só no shell mockado): remonta a árvore de abas inteira
  // como o destravamento do PIN faz na rota real, SEM tocar no timer de 30s
  // nem na validação do PIN. `__previewLock()` troca a árvore pelo
  // PinScreen; `__previewUnlock()` volta — a Rede remonta e deve restaurar
  // do cache em memória (redeCache), sem skeleton.
  //
  // `__previewOnboarding()` existe pelo mesmo motivo: `OnboardingFlow` só é
  // montado na rota real (`app/page.tsx`), atrás de `isNewUser` (jobs/metas
  // vazios + sessão real) — inalcançável neste harness sem esse gancho, já
  // que os dados mockados aqui vêm sempre pré-semeados. Passa `jobs`/`metas`
  // vazios próprios (não os do app, que têm seed) só pra forçar os 4 passos
  // (welcome/goal/job/aha) a aparecerem; `onOpenJobForm` reaproveita o
  // `JobForm` já montado abaixo.
  const [onboardingPreview, setOnboardingPreview] = useState(false);
  // Tour guiado (espelha app/page.tsx); `__previewTour()` abre direto.
  const [tourOpen, setTourOpen] = useState(false);
  const [redeAcesso, setRedeAcesso] = useState<RedeAcessoTour>("pendente");
  // "+" da Rede (Postar): cada toque abre o compositor da Rede.
  const [redePostar, setRedePostar] = useState(0);
  // Foto do perfil da Rede: o Início mostra a mesma (cai na da conta Google
  // quando a Rede não tem foto ou não está liberada).
  const [fotoRede, setFotoRede] = useState<string | null>(null);
  useEffect(() => {
    const w = window as unknown as Record<string, () => void>;
    w.__previewLock = () => {
      setPinHash((h) => h ?? "preview-lock-000000000000000000000000000000");
      setLocked(true);
    };
    w.__previewUnlock = () => setLocked(false);
    w.__previewOnboarding = () => setOnboardingPreview(true);
    w.__previewTour = () => {
      setActiveTab("home");
      setTourOpen(true);
    };
    // "Sua Jornada": toca a mesma comemoração que o botão de demonstração do
    // protótipo (selo | estagio | meta), pelo caminho de verdade: o próximo
    // registro do laboratório devolve a fila e o palco toca.
    (
      w as unknown as Record<string, (demo: DemoDeComemoracao) => void>
    ).__previewComemoracao = (demo) => {
      const { acao } = prepararComemoracaoDeLaboratorio(demo);
      void lojaDaUsuaria(MOCK_APP_USUARIO.id).registrar(acao);
    };
    return () => {
      delete w.__previewComemoracao;
      delete w.__previewLock;
      delete w.__previewUnlock;
      delete w.__previewTour;
      delete w.__previewOnboarding;
    };
  }, []);

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
            pagoEm: (j.pago_em as string | null | undefined) ?? null,
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
    setFabOpen(false);
    // A barra fica por cima da Sua Jornada (protótipo): tocar numa aba fecha
    // a Jornada e vai pra aba.
    setJornadaAberta(false);
    // Mesmo gesto da rota real (app/page.tsx): tocar de novo na aba ativa
    // volta a Rede pra raiz ou rola a aba pro topo.
    if (tab === activeTab) {
      if (tab === "rede") setRedeReselect((n) => n + 1);
      else window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setActiveTab(tab);
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
    } else if (activeTab === "rede") {
      setRedePostar((n) => n + 1);
    }
  }

  async function handleToggleObjetivo(id: string, concluido: boolean) {
    await supabase.from("objetivos").update({ concluido }).eq("id", id);
    setObjetivos((prev) =>
      prev.map((o) => (o.id === id ? { ...o, concluido } : o))
    );
  }

  // Espelha app/page.tsx: "Cancelar" do PIN do Cofre volta pra aba
  // anterior, e arrastar pro lado troca de aba.
  const abaAntesDoCofre = useRef<TabId>("home");
  useEffect(() => {
    if (activeTab !== "cofre") abaAntesDoCofre.current = activeTab;
  }, [activeTab]);
  const mainRef = useRef<HTMLElement>(null);
  useTabSwipe({
    containerRef: mainRef,
    activeTab,
    enabled:
      !locked &&
      !onboardingPreview &&
      !fabOpen &&
      !tourOpen &&
      !chatComposerFocused &&
      activeTab !== "ajustes",
    onChange: handleTabChange,
  });

  if (locked && pinHash) {
    return <PinScreen pinHash={pinHash} onUnlock={() => setLocked(false)} />;
  }

  if (onboardingPreview) {
    return (
      <div className="relative flex flex-col min-h-screen">
        <main
          className="flex-1 overflow-y-auto no-scrollbar px-4"
          style={{
            paddingTop:
              "calc(var(--space-shell-top) + env(safe-area-inset-top, 0px))",
          }}
        >
          <OnboardingFlow
            usuario={usuario}
            jobs={[]}
            metas={[]}
            onOpenJobForm={() => setJobFormOpen(true)}
            onMetaSaved={() => {}}
            onPinSaved={(h) => setPinHash(h)}
            onComplete={() => {
              setOnboardingPreview(false);
              setTourOpen(true);
            }}
          />
        </main>
        <JobForm
          open={jobFormOpen}
          job={null}
          userId={usuario.id}
          onClose={() => setJobFormOpen(false)}
          onSaved={() => {
            setJobFormOpen(false);
            toast.success("Atendimento registrado!");
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-screen">
      <main
        className="flex-1 overflow-y-auto no-scrollbar pb-40 px-4"
        ref={mainRef}
        style={{
          paddingTop:
            "calc(var(--space-shell-top) + env(safe-area-inset-top, 0px))",
        }}
      >
        <TabPanel tab="home" activeTab={activeTab}>
          <GreetingHeader
            usuario={usuario}
            onOpenAjustes={() => handleTabChange("ajustes")}
            fotoUrl={fotoRede}
            onNovo={() => {
              setEditingJob(null);
              setJobFormOpen(true);
            }}
          />
          {/* Início no visual novo (Jornada J02, mockup
              5-telas-8-temas-claro-escuro.html): card principal, a grade de cards
              pequenos (Próximo, Objetivos, Falta pra meta, Cofre), "Esta semana" e
              "Próximos atendimentos". Stack explícito com `grid`+`gap` (achado
              #131: nada de `space-y-*`, que depende de seletor de irmão). */}
          <div
            // Mockup normativo (Início): coluna com gap de 12px e 18px
            // entre o cabeçalho e a grade (gap 12 + margin-top 6).
            className="grid grid-cols-[minmax(0,1fr)]"
            style={{ gap: "12px", marginTop: "18px" }}
          >
            {/* Grade de 2 colunas do mockup; o card principal ocupa as duas. Com
    quantidade ímpar de cards pequenos (um deles desligado em Ajustes,
    sem meta ou sem PIN), o último ocupa a linha toda em vez de deixar
    um buraco. */}
            <div className="grid grid-cols-2 gap-[10px] [&>:last-child:nth-child(even)]:col-span-2">
              {/* O card principal e o card "Sua Jornada" (J12) ocupam as 2
                  colunas, um embaixo do outro com o gap de 10px da grade, como no
                  protótipo da Jornada (`.grid2 > .span2.jcard` logo depois da
                  receita). Juntos num bloco só, pra não mudar a contagem que
                  decide se o último card pequeno ocupa a linha toda. Sem estado
                  da Jornada o card não aparece (nunca trava o Início). */}
              <div className="col-span-2 flex flex-col gap-[10px]">
                {/* `data-tour` do tour guiado (lib/appTour.ts). */}
                <div data-tour="home-hero">
                  <HeroCard
                    jobs={jobs}
                    metas={metas}
                    onGoToFinanceiro={() => {
                      handleTabChange("financeiro");
                      setFinanceiroFocusTab("visao");
                    }}
                  />
                </div>
                <JornadaCard
                  userId={usuario.id}
                  onAbrir={() => setJornadaAberta(true)}
                />
              </div>
              {homeCards.nextJob && <NextJobCard jobs={jobs} />}
              {(homeCards.objetivos ?? true) && (
                <ObjetivosCard
                  objetivos={objetivos}
                  onGoToMetas={() => {
                    handleTabChange("financeiro");
                    setFinanceiroFocusTab("metas");
                  }}
                />
              )}
              <FaltaMetaCard
                jobs={jobs}
                metas={metas}
                onGoToFinanceiro={() => {
                  handleTabChange("financeiro");
                  setFinanceiroFocusTab("visao");
                }}
              />
              <CofreCard
                protegido={Boolean(pinHash)}
                onOpenCofre={() => handleTabChange("cofre")}
              />
            </div>

            {/* Espelha app/page.tsx: bloco da Agenda removível em
                Ajustes › Tela inicial (#181). */}
            {(homeCards.agenda ?? true) && (
              <>
                <SemanaSection
                  jobs={jobs}
                  onGoToAgenda={() => handleTabChange("jobs")}
                />
                <ProximosAtendimentos jobs={jobs} />
              </>
            )}

            {/* Convite de instalação — dispensável, nunca compete com o
                card principal pela atenção (por isso vem por último). */}
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
            avatar={{
              inicial: usuario.nome.trim().charAt(0).toUpperCase(),
              foto: fotoRede || usuario.avatarUrl,
              onOpenAjustes: () => handleTabChange("ajustes"),
            }}
            objetivos={objetivos}
            onObjetivoAdded={() => setObjetivosRefreshKey((k) => k + 1)}
            onToggleObjetivo={handleToggleObjetivo}
            focusTab={financeiroFocusTab}
            onFocusTabHandled={() => setFinanceiroFocusTab(null)}
          />
        </TabPanel>

        <TabPanel tab="cofre" activeTab={activeTab}>
          <CofreTab
            userId={usuario.id}
            refreshTrigger={cofreRefreshKey}
            pinHash={pinHash}
            active={activeTab === "cofre"}
            onExit={() => handleTabChange(abaAntesDoCofre.current)}
          />
        </TabPanel>

        <TabPanel tab="rede" activeTab={activeTab}>
          {devPreviewSession.kind === "unavailable" && (
            <div
              className="mb-4 p-3 rounded-xl text-xs leading-relaxed"
              style={{
                background: "rgb(255 180 60 / 0.12)",
                border: "1px solid rgb(255 180 60 / 0.3)",
                color: "var(--text-2)",
              }}
            >
              <strong style={{ color: "var(--text)" }}>
                Sessão de teste local indisponível.
              </strong>{" "}
              {devPreviewSession.message} Solicitar beta e resgatar código vão
              mostrar esse mesmo estado até o Supabase local estar de pé — o
              resto do fluxo (abrir o sheet de código, validações de campo
              vazio, foco, 44px) continua testável normalmente.
            </div>
          )}
          <RedeGatedTab
            usuario={usuario}
            reselectSignal={redeReselect}
            onChatFocusChange={setChatComposerFocused}
            postarSignal={redePostar}
            onAcessoChange={setRedeAcesso}
            onFotoPerfilChange={setFotoRede}
          />
        </TabPanel>

        <TabPanel tab="ajustes" activeTab={activeTab}>
          <AjustesTab
            userId={usuario.id}
            jobs={jobs}
            onSignOut={handleSignOut}
            onPinHashChange={(h) => setPinHash(h)}
            onHomeCardsChange={() => {}}
            onCardStylesChange={() => {}}
            onChartPrefsChange={setChartPrefs}
            onClose={() => handleTabChange("home")}
            onOpenTour={() => {
              handleTabChange("home");
              setTourOpen(true);
            }}
          />
        </TabPanel>
      </main>

      {!chatComposerFocused && (
        <>
          <BottomNav
            activeTab={activeTab}
            onChange={handleTabChange}
            holdOpen={fabOpen || tourOpen}
            pilulaDaJornada={jornadaAberta}
            renderFab={
              // A Rede só tem "+" (Postar) com acesso liberado; na vitrine
              // de convite a pílula ocupa a linha toda.
              activeTab === "rede" && redeAcesso !== "liberado"
                ? undefined
                : (compact) => (
                    <FAB
                      activeTab={activeTab}
                      financeiroSubTab={finInnerTab}
                      open={fabOpen}
                      onToggle={() => setFabOpen((v) => !v)}
                      onAction={handleFabAction}
                      compact={compact}
                    />
                  )
            }
          />
        </>
      )}

      {tourOpen && (
        <AppTour
          userId={usuario.id}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onClose={() => setTourOpen(false)}
          redeAcesso={redeAcesso}
        />
      )}

      {dataLoaded && <RecapSheet jobs={jobs} />}

      {jornadaAberta && (
        <JornadaScreen
          userId={usuario.id}
          nome={usuario.nome.trim().split(/\s+/)[0] ?? ""}
          inicial={usuario.nome.trim().charAt(0).toUpperCase()}
          onVoltar={() => setJornadaAberta(false)}
          onIrPara={(aba) => {
            setJornadaAberta(false);
            handleTabChange(aba);
          }}
        />
      )}
      <ComemoracaoHost
        userId={usuario.id}
        inicial={usuario.nome.trim().charAt(0).toUpperCase()}
        onVerJornada={() => setJornadaAberta(true)}
      />

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
