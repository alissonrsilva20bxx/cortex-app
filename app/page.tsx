"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";

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
import { FaltaMetaCard } from "@/components/home/FaltaMetaCard";
import { CofreCard } from "@/components/home/CofreCard";
import { JornadaCard } from "@/components/home/JornadaCard";
import { destinoDoProximoPasso } from "@/components/jornada/progresso";
import { JornadaScreen } from "@/components/jornada/JornadaScreen";
import { ComemoracaoHost } from "@/components/jornada/celebracao/ComemoracaoHost";
import { SemanaSection } from "@/components/home/SemanaSection";
import { ProximosAtendimentos } from "@/components/home/ProximosAtendimentos";
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
import { AppTour } from "@/components/onboarding/AppTour";
import { RecapSheet } from "@/components/recap/RecapSheet";
import { InstallBanner } from "@/components/install/InstallBanner";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import * as redeCache from "@/lib/rede/redeCache";
import * as redeCachePersist from "@/lib/rede/redeCachePersist";
import * as cofreCache from "@/lib/cofre/cofreCache";
import * as pinHashCache from "@/lib/pinHashCache";
import { useTabSwipe } from "@/lib/useTabSwipe";
import { isFreshAccount } from "@/lib/onboarding";
import { tourDoneKey, type RedeAcessoTour } from "@/lib/appTour";
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
  agenda: true,
};
const DEFAULT_CARD_STYLES: CardStyleConfig = {
  nextJob: "standard",
  financeSummary: "standard",
};
const DEFAULT_CHART_PREFS: ChartPrefConfig = { financeiro: "bar", jobs: "bar" };

/** Falha de rede (offline / servidor inalcançável), não sessão inválida. */
function isNetworkError(error: { name?: string; status?: number }): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  return error.name === "AuthRetryableFetchError" || error.status === 0;
}

export default function Page() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [redeReselect, setRedeReselect] = useState(0);
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
  // Tour guiado do app (lib/appTour.ts): abre sozinho logo depois do
  // onboarding de conta nova; depois, só por Ajustes → "Ver tour do app".
  const [tourOpen, setTourOpen] = useState(false);
  const [redeAcesso, setRedeAcesso] = useState<RedeAcessoTour>("pendente");
  // "+" da Rede (Postar): cada toque abre o compositor da Rede.
  const [redePostar, setRedePostar] = useState(0);
  // Foto do perfil da Rede: o Início mostra a mesma (cai na da conta Google
  // quando a Rede não tem foto ou não está liberada).
  const [fotoRede, setFotoRede] = useState<string | null>(null);
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
  // Pulso de navegação pro Financeiro abrir direto numa sub-aba específica
  // ("metas" pro "Ver todos" de Objetivos, "visao" pro CTA "Ver minha
  // evolução" do HeroCard — issue #134) — ver comentário de `focusTab` em
  // FinanceiroTab.tsx (redesign iOS #122/#125).
  const [financeiroFocusTab, setFinanceiroFocusTab] = useState<
    "metas" | "visao" | "saidas" | null
  >(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  // "Sua Jornada" (J15): a tela abre pelo card do Início.
  const [jornadaAberta, setJornadaAberta] = useState(false);
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
    let cancelado = false;
    async function boot() {
      // Online, getUser() valida a sessão no servidor. Sem rede ele devolve
      // erro em vez do usuário -- aí cai pra sessão guardada no aparelho,
      // pro PWA abrir offline (cada aba mostra o que tem em cache). Uma
      // sessão REJEITADA pelo servidor (resposta sem erro de rede) não cai
      // nesse fallback.
      const { data, error } = await supabase.auth.getUser();
      let authUser = data.user;
      if (!authUser && error && isNetworkError(error)) {
        const { data: s } = await supabase.auth.getSession();
        authUser = s.session?.user ?? null;
      }
      if (!authUser || cancelado) return;
      const u: Usuario = {
        id: authUser.id,
        nome: authUser.user_metadata?.full_name ?? authUser.email ?? "Usuário",
        email: authUser.email ?? "",
        avatarUrl: authUser.user_metadata?.avatar_url,
        telefone:
          authUser.phone ||
          authUser.user_metadata?.phone ||
          authUser.user_metadata?.telefone ||
          null,
      };

      // Só revela o usuário (e libera as buscas de dados sensíveis) depois
      // de saber se há PIN a cumprir — evita a tela de conteúdo desenhar
      // (ou pré-carregar dados) antes da trava, mesmo por um instante (§5.2).
      // Sem rede, usa a última resposta guardada (`lib/pinHashCache.ts`);
      // sem nenhuma guardada, não abre (falha fechada).
      const { data: cfg, error: cfgError } = await supabase
        .from("configuracoes")
        .select("pin_hash")
        .eq("user_id", authUser.id)
        .single();
      let hash: string | null;
      // PGRST116 = conta ainda sem linha em `configuracoes` (sem PIN).
      if (!cfgError || cfgError.code === "PGRST116") {
        hash = cfg?.pin_hash ?? null;
        pinHashCache.gravar(authUser.id, hash);
      } else {
        const guardado = pinHashCache.ler(authUser.id);
        if (guardado === undefined) return;
        hash = guardado;
      }
      if (cancelado) return;
      if (hash) {
        setPinHash(hash);
        setLocked(true);
      }
      setUsuario(u);
    }
    boot();
    return () => {
      cancelado = true;
    };
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
    ]).then(
      ([
        { data: jobsData, error: jobsErr },
        { data: metasData, error: metasErr },
      ]) => {
        // Sem rede: mantém o que já está na tela e não decide "1º uso" com
        // listas vazias que só estão vazias porque a busca falhou.
        if (jobsErr || metasErr) return;
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
              pagoEm: j.pago_em ?? null,
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
      }
    );
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
    // Zera o cache da Rede, do Cofre e do PIN ANTES de sair -- em memória
    // (a próxima conta nesta aba não herda nada) e no localStorage (req
    // 4/6; `cofreCache.limparTudo` apaga as duas camadas do Cofre).
    try {
      redeCache.limparTudo();
      redeCachePersist.limpar();
      cofreCache.limparTudo();
      pinHashCache.limparTudo();
    } catch (_) {}
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function handleTabChange(tab: TabId) {
    setFabOpen(false);
    // A barra fica por cima da Sua Jornada (protótipo): tocar numa aba fecha
    // a Jornada e vai pra aba.
    setJornadaAberta(false);
    if (tab === activeTab) {
      // Tocar de novo na aba ativa = gesto nativo do iOS: na Rede, com
      // uma subtela aberta, volta pra raiz (Feed); em qualquer outro caso
      // rola suave até o topo.
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

  // Última aba fora do Cofre -- pra onde o "Cancelar" do PIN do Cofre
  // volta. (A rolagem de cada aba já é lembrada pela BottomNav, em
  // `lib/useScrollCompact.ts`.)
  const abaAntesDoCofre = useRef<TabId>("home");
  useEffect(() => {
    if (activeTab !== "cofre") abaAntesDoCofre.current = activeTab;
  }, [activeTab]);

  // Arrastar pro lado troca de aba (Início ↔ Agenda ↔ Financeiro ↔ Cofre ↔
  // Rede). Desligado no onboarding, com o FAB aberto, com o teclado do
  // chat aberto e em Ajustes (fora da barra de abas).
  const mainRef = useRef<HTMLElement>(null);
  useTabSwipe({
    containerRef: mainRef,
    activeTab,
    enabled:
      entryDone &&
      Boolean(usuario) &&
      !locked &&
      !(isNewUserSession === true && !onboardingDone) &&
      !fabOpen &&
      !tourOpen &&
      !chatComposerFocused &&
      activeTab !== "ajustes",
    onChange: handleTabChange,
  });

  function closeTour() {
    if (usuario) {
      try {
        localStorage.setItem(tourDoneKey(usuario.id), "1");
      } catch (_) {}
    }
    setTourOpen(false);
  }

  if (!entryDone) {
    return <OpeningMotion onDone={() => setEntryDone(true)} />;
  }

  if (locked && pinHash) {
    return (
      <PinScreen
        pinHash={pinHash}
        onUnlock={() => setLocked(false)}
        onSair={handleSignOut}
      />
    );
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
        className="flex-1 overflow-y-auto no-scrollbar pb-40 px-4"
        ref={mainRef}
        style={{
          paddingTop:
            "calc(var(--space-shell-top) + env(safe-area-inset-top, 0px))",
        }}
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
            onPinSaved={(h) => {
              setPinHash(h);
              pinHashCache.gravar(usuario.id, h);
            }}
            onComplete={() => {
              try {
                localStorage.setItem(onboardingDoneKey(usuario.id), "1");
              } catch (_) {}
              setOnboardingDone(true);
              let tourDone = false;
              try {
                tourDone = Boolean(
                  localStorage.getItem(tourDoneKey(usuario.id))
                );
              } catch (_) {}
              if (!tourDone) setTourOpen(true);
            }}
          />
        )}

        {!isNewUser && usuario && (
          <>
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
                    {usuario && (
                      <JornadaCard
                        userId={usuario.id}
                        onAbrir={() => setJornadaAberta(true)}
                        onProximoPasso={(acao) => {
                          const destino = destinoDoProximoPasso(acao);
                          handleTabChange(destino.aba);
                          if (destino.financeiro)
                            setFinanceiroFocusTab(destino.financeiro);
                        }}
                      />
                    )}
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

                {/* Bloco da Agenda: removível em Ajustes › Tela inicial
                    (#181). `?? true` mantém visível pra quem já tinha
                    preferência salva antes dessa chave existir. */}
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
                profissional={{
                  nome: usuario.nome,
                  telefone: usuario.telefone,
                }}
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
                onAbrirAjustes={() => handleTabChange("ajustes")}
                // Sem este sinal o azulejo "Enviar" nasce desabilitado (meio
                // transparente), e a referência o desenha ativo. O sheet mora na
                // página, FORA da trava do Cofre, de propósito: o seletor de
                // arquivo do sistema tira o foco e o Cofre trava na hora.
                onEnviar={() => setUploadOpen(true)}
              />
            </TabPanel>

            <TabPanel tab="rede" activeTab={activeTab}>
              <RedeGatedTab
                usuario={usuario}
                active={activeTab === "rede"}
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
                onPinHashChange={(h) => {
                  setPinHash(h);
                  pinHashCache.gravar(usuario.id, h);
                }}
                onHomeCardsChange={setHomeCards}
                onCardStylesChange={setCardStyles}
                onChartPrefsChange={setChartPrefs}
                onClose={() => handleTabChange("home")}
                onOpenTour={() => {
                  handleTabChange("home");
                  setTourOpen(true);
                }}
              />
            </TabPanel>
          </>
        )}
      </main>

      {!isNewUser && !chatComposerFocused && (
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
                      cobertoPorTela={jornadaAberta}
                    />
                  )
            }
          />
        </>
      )}

      {tourOpen && !isNewUser && usuario && (
        <AppTour
          userId={usuario.id}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onClose={closeTour}
          redeAcesso={redeAcesso}
        />
      )}

      {!isNewUser && usuario && dataLoaded && <RecapSheet jobs={jobs} />}

      {/* "Sua Jornada" (J15): a tela (J12) e o host de comemoração (J13),
          só no app autenticado. Com o PIN travado esta árvore não monta,
          então nada comemora por cima do PIN. */}
      {usuario && jornadaAberta && (
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
      {usuario && (
        <ComemoracaoHost
          userId={usuario.id}
          inicial={usuario.nome.trim().charAt(0).toUpperCase()}
          onVerJornada={() => setJornadaAberta(true)}
        />
      )}

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
