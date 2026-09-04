"use client";

import { useState, useEffect, useLayoutEffect } from "react";

// useLayoutEffect emite aviso "does nothing on the server" durante o SSR de
// um componente client — cai pra useEffect nesse lado (nunca roda no
// servidor mesmo, então não muda o resultado) e só usa a versão síncrona
// de verdade no cliente, onde o timing pré-paint importa.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
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
import {
  OpeningMotion,
  SEEN_THIS_TAB_KEY,
} from "@/components/entry/OpeningMotion";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { RecapSheet } from "@/components/recap/RecapSheet";
import { InstallBanner } from "@/components/install/InstallBanner";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { isFreshAccount } from "@/lib/onboarding";
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

// Mesmo aparelho já viu o onboarding terminar (com ou sem PIN, mesmo que
// meta/atendimento tenham sido pulados) — sem isso, uma conta que só pula
// tudo nunca escreve em `jobs`/`metas`, `isFreshAccount` continua `true`
// pra sempre, e o onboarding reaparece em todo reload/nova sessão (achado
// da revisão independente em #99). Escopada por usuario.id — sem isso, a
// 1ª conta a completar o onboarding num aparelho bloqueia o onboarding de
// qualquer conta nova depois no mesmo navegador (comum em QA, achado numa
// 2ª rodada de revisão do mesmo #99). Não resolve entre aparelhos — versão
// robusta fica pra uma issue separada, mesmo padrão de #98.
const onboardingDoneKey = (userId: string) =>
  `jobapp-onboarding-done:${userId}`;

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

  // Sempre nasce `false` (igual no servidor e no 1º render do cliente —
  // `sessionStorage` não existe durante SSR, então um lazy init que já
  // olhasse a flag aqui divergia do HTML do servidor e quebrava a
  // hidratação sempre que a aba já tinha visto o motion, achado 2026-08-25
  // logo após logar). A checagem real acontece no effect abaixo, que roda
  // só no cliente e sincronamente antes do browser pintar o 1º frame —
  // perde o mismatch de SSR sem reintroduzir o flash que o fix original
  // (`0cfbe80`) queria evitar.
  const [entryDone, setEntryDone] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (sessionStorage.getItem(SEEN_THIS_TAB_KEY) === "1") {
      setEntryDone(true);
    }
  }, []);

  // Distingue "ainda não sei se ela tem dados" de "confirmei que não tem" —
  // sem isso, uma usuária antiga com dados reais veria o onboarding piscar
  // na janela entre revelar `usuario` e o fetch de jobs/metas terminar.
  const [dataLoaded, setDataLoaded] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  // Trava a decisão "é 1º uso?" na 1ª leitura confirmada dos dados, em vez
  // de recalcular a cada render: sem isso, o próprio ato de completar uma
  // etapa do onboarding (ex.: salvar a 1ª meta) muda `metas` o bastante
  // pra isFreshAccount virar false NO MEIO do fluxo, ejetando a usuária
  // pra home normal antes das etapas seguintes (T17/#70, critério de
  // aceite #3 — não pode perder o fluxo no meio do caminho).
  const [isNewUserSession, setIsNewUserSession] = useState<boolean | null>(
    null
  );

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
  //
  // Só `visibilitychange` não bastava: no PWA instalado do iOS, trocar de
  // app às vezes não dispara esse evento de forma confiável (achado em QA
  // ao vivo — a trava só pegava depois de uns 4min em vez de ~30s, contra
  // o Cofre, que já usa `blur`/`pagehide` além de `visibilitychange` e
  // sempre reage na hora — ver `components/cofre/CofreTab.tsx`). Replica
  // aqui o mesmo conjunto de sinais do Cofre, mas mantendo o grace period
  // de 30s (deliberadamente diferente do Cofre, que não tem nenhum) —
  // `hiddenAt` só é setado por quem chegar primeiro, e checado só uma vez
  // por retorno, então múltiplos eventos do mesmo evento real de
  // segundo-plano não se pisam.
  useEffect(() => {
    if (!pinHash) return;
    let hiddenAt: number | null = null;
    function markHidden() {
      if (hiddenAt === null) hiddenAt = Date.now();
    }
    function checkElapsedAndReveal() {
      if (hiddenAt !== null && Date.now() - hiddenAt >= 30_000) {
        setLocked(true);
      }
      hiddenAt = null;
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") markHidden();
      else if (document.visibilityState === "visible") checkElapsedAndReveal();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("pagehide", markHidden);
    window.addEventListener("blur", markHidden);
    window.addEventListener("focus", checkElapsedAndReveal);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("pagehide", markHidden);
      window.removeEventListener("blur", markHidden);
      window.removeEventListener("focus", checkElapsedAndReveal);
    };
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
    if (isNewUserSession !== null) return; // já decidido, não reavalia
    if (!usuario) return;
    try {
      if (localStorage.getItem(onboardingDoneKey(usuario.id))) {
        setIsNewUserSession(false);
        return;
      }
    } catch (_) {}
    if (!dataLoaded) return;
    setIsNewUserSession(isFreshAccount(jobs, metas));
  }, [usuario, dataLoaded, jobs, metas, isNewUserSession]);

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

  // 1º uso: decidido uma única vez (isNewUserSession, ver efeito acima) a
  // partir da 1ª leitura confirmada de jobs/metas — preenchimentos feitos
  // DURANTE o próprio onboarding (ex.: salvar a meta) não devem contar
  // como "não é mais nova" e ejetar a usuária pro app normal no meio do
  // fluxo (§6, T17/#70).
  const isNewUser = isNewUserSession === true && !onboardingDone;

  return (
    <div className="relative flex flex-col min-h-screen">
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
            onComplete={() => {
              try {
                localStorage.setItem(onboardingDoneKey(usuario.id), "1");
              } catch (_) {}
              setOnboardingDone(true);
            }}
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
