"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Sun, Moon, ChevronRight, ChevronLeft } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, THEME_LABELS, THEME_ACCENTS } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { PinSetup } from "@/components/pin/PinSetup";
import { ReauthModal } from "@/components/pin/ReauthModal";
import { limparReauthDaUrl, reauthAtual } from "@/lib/reauth";
import type { MotivoReauth } from "@/lib/reauthRegras";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { NotificacoesSheet } from "@/components/notificacoes/NotificacoesSheet";
import { InstallSheet } from "@/components/install/InstallSheet";
import { computeAssinatura } from "@/lib/assinatura";
import { totalEarnings } from "@/lib/finance";
import { SeletorMoeda } from "@/components/moeda/SeletorMoeda";
import { TEXTOS_MOEDA } from "@/lib/textosMoeda";
import { TEXTOS_PLANOS } from "@/lib/textosPlanos";
import { useFormatMoeda } from "@/lib/useMoeda";
import { exportarDadosCSV } from "@/lib/exportarDados";
import { isIOS, isStandalone } from "@/lib/platform";
import {
  isPushSupported,
  isPushSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import type { Theme } from "@/lib/theme";
import { TEXTOS_DESEJO } from "@/lib/desejo/textos";
import type {
  HomeCardConfig,
  CardStyleConfig,
  AssinaturaStatus,
  Job,
} from "@/lib/types";

const DEFAULT_HOME_CARDS: HomeCardConfig = {
  nextJob: true,
  financeSummary: true,
  objetivos: true,
  agenda: true,
};

interface Props {
  userId: string;
  jobs: Job[];
  onSignOut: () => void;
  onPinHashChange: (hash: string | null) => void;
  onHomeCardsChange: (c: HomeCardConfig) => void;
  onCardStylesChange: (c: CardStyleConfig) => void;
  /** Ajustes abre pelo avatar da Início (não é aba da barra): a seta do
   * topo volta para a Início. */
  onClose: () => void;
  /** Reabre o tour guiado do app (lib/appTour.ts). */
  onOpenTour?: () => void;
  /** Abre a tela de planos (a mesma da Início, AssinaturaNoApp). */
  onVerPlanos?: () => void;
}

/**
 * Ajustes no estilo do iPhone (gabarito: opção "iPhone clássico" de
 * .lavish/config-estilos.html, mapa em AJUSTES-MAPA.md): uma lista só, em
 * grupos, com o rótulo do grupo em cima, texto puro, o valor ou a chave à
 * direita e "Sair da conta" por último. O que é uma chave só fica direto
 * na lista (sem sub-página de um item); só a Aparência, com as 8 cores,
 * abre uma página própria.
 */
function Grupo({
  titulo,
  rodape,
  children,
}: {
  titulo?: string;
  /** Texto miúdo embaixo do grupo (como as notas do Ajustes do iPhone). */
  rodape?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section data-grupo-ajustes={titulo ?? ""}>
      {titulo ? (
        <h3
          className="px-4"
          style={{
            marginBottom: 8,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--accent-deep-2)",
          }}
        >
          {titulo}
        </h3>
      ) : null}
      <div
        className="overflow-hidden"
        style={{
          borderRadius: "var(--radius-md)",
          background: "var(--card-solid)",
          border: "1px solid var(--border-color)",
        }}
      >
        {children}
      </div>
      {rodape ? (
        <div
          className="px-4"
          style={{
            marginTop: 8,
            fontSize: "12.5px",
            lineHeight: 1.5,
            color: "var(--text-muted)",
          }}
        >
          {rodape}
        </div>
      ) : null}
    </section>
  );
}

/** Uma linha da lista: o rótulo à esquerda e, à direita, o valor e a seta
 * (quando abre algo) ou uma chave. A linha inteira é o alvo de toque. */
function Linha({
  title,
  detail,
  valor,
  onClick,
  chave,
  perigo = false,
  destaque = false,
  last = false,
  valorSemHidratacao = false,
}: {
  title: string;
  /** Explicação curta embaixo do rótulo. */
  detail?: string;
  /** Valor atual, à direita (ex.: "Midnight", "Ativo"). */
  valor?: ReactNode;
  onClick?: () => void;
  /** Linha com chave (Switch) à direita: tocar na linha também alterna. */
  chave?: {
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
  };
  perigo?: boolean;
  destaque?: boolean;
  last?: boolean;
  /** O valor depende do localStorage (tema/modo): o HTML do servidor não
   * sabe, então o texto diverge por design no 1º paint. */
  valorSemHidratacao?: boolean;
}) {
  const cor = perigo
    ? "var(--danger)"
    : destaque
      ? "var(--accent-deep-2)"
      : "var(--text)";
  const conteudo = (
    <>
      <span className="min-w-0 flex-1 py-3 text-left">
        <span
          className="block"
          style={{ fontSize: 15, fontWeight: 600, color: cor }}
        >
          {title}
        </span>
        {detail ? (
          <span
            className="mt-0.5 block"
            style={{ fontSize: 12.5, color: "var(--text-muted)" }}
          >
            {detail}
          </span>
        ) : null}
      </span>
      {valor !== undefined ? (
        <span
          className="shrink-0 truncate"
          style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: "45%" }}
          suppressHydrationWarning={valorSemHidratacao}
        >
          {valor}
        </span>
      ) : null}
      {chave ? (
        // O Switch já é um <button>: o toque nele não sobe até a linha,
        // senão alternaria duas vezes.
        <span onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={chave.checked}
            onChange={chave.onChange}
            disabled={chave.disabled}
            ariaLabel={title}
          />
        </span>
      ) : onClick && !perigo ? (
        <ChevronRight
          size={18}
          className="shrink-0"
          style={{ color: "var(--text-muted)" }}
        />
      ) : null}
    </>
  );
  const estilo: React.CSSProperties = {
    minHeight: 52,
    gap: 10,
    paddingLeft: 16,
    paddingRight: 12,
    boxShadow: last ? undefined : "inset 0 -1px 0 var(--border-color)",
  };
  if (chave) {
    return (
      <div
        role="group"
        aria-label={title}
        className="flex w-full cursor-pointer items-center"
        style={estilo}
        onClick={() => !chave.disabled && chave.onChange(!chave.checked)}
      >
        {conteudo}
      </div>
    );
  }
  if (!onClick) {
    return (
      <div className="flex w-full items-center" style={estilo}>
        {conteudo}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center transition-colors active:opacity-70"
      style={estilo}
    >
      {conteudo}
    </button>
  );
}

type SettingsPage = "appearance";

export function AjustesTab({
  userId,
  jobs,
  onSignOut,
  onPinHashChange,
  onHomeCardsChange,
  onClose,
  onOpenTour,
  onVerPlanos,
}: Props) {
  const formatMoeda = useFormatMoeda();
  const { theme, setTheme, mode, setMode } = useTheme();
  // Tema e modo vêm do localStorage: o servidor não os conhece. Até montar,
  // nada que dependa deles é desenhado (sem erro de hidratação).
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [homeCards, setHomeCardsState] =
    useState<HomeCardConfig>(DEFAULT_HOME_CARDS);
  const [exporting, setExporting] = useState(false);
  const [exportAviso, setExportAviso] = useState<{
    ok: boolean;
    texto: string;
  } | null>(null);
  const [assinatura, setAssinatura] = useState<{
    trialStartedAt: string;
    status: AssinaturaStatus;
  } | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  // iPhone numa aba do Safari: não existe PushManager (a Apple só libera
  // push pro app instalado na tela de início). Em vez de sumir com a opção,
  // mostra a linha apontando pra instalação.
  const [pushNeedsInstall, setPushNeedsInstall] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [installSheetOpen, setInstallSheetOpen] = useState(false);
  const [sairAberto, setSairAberto] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [activePage, setActivePage] = useState<SettingsPage | null>(null);
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const lastMenuTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    supabase
      .from("configuracoes")
      .select("tema, pin_hash, trial_started_at, assinatura_status")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data?.tema) setTheme(data.tema as Theme);
        setPinEnabled(!!data?.pin_hash);
        if (data?.trial_started_at && data?.assinatura_status) {
          setAssinatura({
            trialStartedAt: data.trial_started_at,
            status: data.assinatura_status,
          });
        }
      });
    const hc = localStorage.getItem("jobapp-home-cards");
    if (hc) setHomeCardsState(JSON.parse(hc));

    if (isPushSupported()) {
      setPushSupported(true);
      isPushSubscribed().then(setPushEnabled);
    } else if (isIOS() && !isStandalone()) {
      setPushNeedsInstall(true);
    }
    setStandalone(isStandalone());
  }, [userId, setTheme]);

  useEffect(() => {
    // Só fecha se a PRÓPRIA chave saiu do estado -- sem isso, um Voltar
    // que não tinha nada a ver com Ajustes (ex.: fechando o visualizador
    // de foto do perfil da Rede, TabPanel mantém as duas abas montadas)
    // também zerava `activePage` por reagir a QUALQUER popstate global.
    const handleHistoryBack = () => {
      if (!window.history.state?.jobappSettingsPage) setActivePage(null);
    };
    window.addEventListener("popstate", handleHistoryBack);
    return () => window.removeEventListener("popstate", handleHistoryBack);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (activePage) pageHeadingRef.current?.focus();
      else lastMenuTriggerRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePage]);

  const estadoAssinatura = assinatura
    ? computeAssinatura(assinatura.trialStartedAt, assinatura.status)
    : null;

  async function handleThemeChange(t: Theme) {
    setTheme(t);
    await supabase
      .from("configuracoes")
      .upsert({ user_id: userId, tema: t }, { onConflict: "user_id" });
  }

  // Desligar ou trocar o PIN pede a senha da conta ou o Google antes
  // (ReauthModal). Criar o 1º PIN, sem nenhum ativo, não pede.
  const [reauthMotivo, setReauthMotivo] = useState<MotivoReauth | null>(null);

  function pedirDesligarPin() {
    setReauthMotivo("desligar-pin");
  }

  function abrirPinSetup() {
    if (pinEnabled) setReauthMotivo("trocar-pin");
    else setPinSetupOpen(true);
  }

  function contaConfirmada(motivo: MotivoReauth) {
    setReauthMotivo(null);
    if (motivo === "desligar-pin") void handleDisablePin();
    else if (motivo === "trocar-pin") setPinSetupOpen(true);
  }

  // Volta do Google pedida aqui: o grupo Segurança já está na lista e, se
  // a confirmação valer, a ação termina. O ref segura a resposta no
  // remonte do StrictMode.
  const retornoGoogle = useRef<{
    motivo: MotivoReauth;
    ok: Promise<boolean>;
  } | null>(null);
  useEffect(() => {
    const reauth = reauthAtual();
    if (!retornoGoogle.current) {
      const motivo = reauth.motivoPendente();
      if (motivo !== "desligar-pin" && motivo !== "trocar-pin") return;
      retornoGoogle.current = { motivo, ok: reauth.retornoDoGoogle(motivo) };
      setActivePage(null);
    }
    const { motivo, ok } = retornoGoogle.current;
    let vivo = true;
    void ok.then((valeu) => {
      limparReauthDaUrl();
      if (vivo && valeu) contaConfirmada(motivo);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisablePin() {
    await supabase
      .from("configuracoes")
      .update({ pin_hash: null })
      .eq("user_id", userId);
    setPinEnabled(false);
    onPinHashChange(null);
  }

  function handlePinSaved(hash: string) {
    setPinEnabled(true);
    onPinHashChange(hash);
  }

  // Desativar não precisa de fricção — só ativar passa pelo soft-ask
  // (§ boa prática: nunca gastar o prompt nativo sem contexto antes).
  async function handleTogglePush(next: boolean) {
    if (next) {
      setNotifSheetOpen(true);
      return;
    }
    setPushBusy(true);
    setPushError(null);
    try {
      await unsubscribeFromPush(userId);
      setPushEnabled(false);
    } catch (err) {
      setPushError(
        err instanceof Error ? err.message : "Não foi possível desativar."
      );
    } finally {
      setPushBusy(false);
    }
  }

  async function handleConfirmSubscribe() {
    setPushBusy(true);
    setPushError(null);
    try {
      await subscribeToPush(userId);
      setPushEnabled(true);
      setNotifSheetOpen(false);
    } catch (err) {
      setPushError(
        err instanceof Error ? err.message : "Não foi possível ativar."
      );
    } finally {
      setPushBusy(false);
    }
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setExportAviso(null);
    try {
      await exportarDadosCSV(userId);
      setExportAviso({ ok: true, texto: "Pronto: o arquivo foi baixado." });
    } catch (err) {
      console.error("[Ajustes exportar]", err);
      setExportAviso({
        ok: false,
        texto: "Não foi possível exportar agora. Tente de novo.",
      });
    } finally {
      setExporting(false);
    }
  }

  function updateHomeCards(next: HomeCardConfig) {
    setHomeCardsState(next);
    localStorage.setItem("jobapp-home-cards", JSON.stringify(next));
    onHomeCardsChange(next);
  }

  // Os cards da Início que têm chave aqui. "Independência Financeira" saiu:
  // ela gravava `financeSummary`, mas nenhuma tela lia essa preferência (era
  // uma chave que não mudava nada).
  const homeCardItems: {
    key: keyof HomeCardConfig;
    label: string;
    desc: string;
  }[] = [
    {
      key: "nextJob",
      label: "Próximo atendimento",
      desc: "Card com próximo agendamento",
    },
    {
      key: "objetivos",
      label: TEXTOS_DESEJO.ajustesRotulo,
      desc: TEXTOS_DESEJO.ajustesDescricao,
    },
    {
      key: "agenda",
      label: "Agenda",
      desc: "Esta semana e próximos atendimentos",
    },
  ];

  const pageTitles: Record<SettingsPage, string> = {
    appearance: "Aparência",
  };

  function openSettingsPage(page: SettingsPage) {
    lastMenuTriggerRef.current = document.activeElement as HTMLElement | null;
    window.history.pushState(
      { ...window.history.state, jobappSettingsPage: page },
      ""
    );
    setActivePage(page);
  }

  function closeSettingsPage() {
    if (window.history.state?.jobappSettingsPage) window.history.back();
    else setActivePage(null);
  }

  // "Você já construiu € X em N atendimentos" só quando há o que mostrar
  // (como a tela de planos da Início): nunca "€ 0 em 0".
  const concluidos = jobs.filter((j) => j.status === "concluído").length;
  const construido = totalEarnings(jobs);

  const assinaturaValor =
    estadoAssinatura?.status === "trial"
      ? TEXTOS_PLANOS.ajustesValor.teste(estadoAssinatura.diasRestantes)
      : estadoAssinatura?.status === "vencida"
        ? TEXTOS_PLANOS.ajustesValor.terminou
        : estadoAssinatura?.status === "ativa"
          ? TEXTOS_PLANOS.ajustesValor.ativa
          : undefined;

  const linhasApp = [
    onOpenTour ? "tour" : null,
    !standalone ? "instalar" : null,
  ].filter(Boolean);

  return (
    <div className="pb-6" data-ajustes="">
      <div className="mb-6 flex min-h-11 items-center gap-2">
        {activePage ? (
          <button
            type="button"
            onClick={closeSettingsPage}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
            aria-label="Voltar para Ajustes"
            style={{ color: "var(--text)" }}
          >
            <ChevronLeft size={22} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
            aria-label="Voltar para Início"
            style={{ color: "var(--text)" }}
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <h2
          ref={pageHeadingRef}
          tabIndex={activePage ? -1 : undefined}
          className="font-extrabold"
          style={{
            fontSize: activePage ? "22px" : "28px",
            letterSpacing: "-0.03em",
            color: "var(--text)",
          }}
        >
          {activePage ? pageTitles[activePage] : "Ajustes"}
        </h2>
      </div>

      {!activePage ? (
        <div className="space-y-7">
          {assinaturaValor || onVerPlanos ? (
            <Grupo
              titulo="Conta"
              rodape={
                estadoAssinatura?.status === "vencida" && concluidos > 0
                  ? `Você já construiu ${formatMoeda(construido)} em ${concluidos} ${concluidos === 1 ? "atendimento" : "atendimentos"}. Nada disso se perde: exporte seus dados quando quiser.`
                  : estadoAssinatura?.status === "trial"
                    ? "Sem cartão, sem compromisso. Continue no seu ritmo."
                    : undefined
              }
            >
              {assinaturaValor ? (
                <Linha
                  title={TEXTOS_PLANOS.ajustesLinha}
                  valor={assinaturaValor}
                  last={!onVerPlanos || estadoAssinatura?.status === "ativa"}
                />
              ) : null}
              {onVerPlanos && estadoAssinatura?.status !== "ativa" ? (
                <Linha title="Ver planos" destaque onClick={onVerPlanos} last />
              ) : null}
            </Grupo>
          ) : null}

          <Grupo
            titulo="Segurança"
            rodape="O PIN tranca a tela neste aparelho: quem pega o telefone não abre seu espaço sem o código. Ele protege o acesso, não substitui a senha da sua conta."
          >
            {pinEnabled ? (
              <>
                <Linha title="PIN" valor="Ativo" />
                {/* Trocar e desligar pedem a conta antes (ReauthModal). */}
                <Linha title="Trocar PIN" onClick={abrirPinSetup} />
                <Linha
                  title="Desligar PIN"
                  perigo
                  onClick={pedirDesligarPin}
                  last
                />
              </>
            ) : (
              <Linha
                title="Ativar PIN"
                detail="Código de 4 dígitos para abrir o app"
                onClick={abrirPinSetup}
                last
              />
            )}
          </Grupo>

          <Grupo titulo="Aparência">
            <Linha
              title="Tema"
              valor={montado ? THEME_LABELS[theme] : ""}
              valorSemHidratacao
              onClick={() => openSettingsPage("appearance")}
            />
            <Linha
              title="Modo"
              valor={montado ? (mode === "dark" ? "Escuro" : "Claro") : ""}
              valorSemHidratacao
              onClick={() => openSettingsPage("appearance")}
              last
            />
          </Grupo>

          <Grupo titulo={TEXTOS_MOEDA.titulo}>
            <div className="p-3">
              <SeletorMoeda />
            </div>
          </Grupo>

          <Grupo titulo="Tela inicial">
            {homeCardItems.map(({ key, label, desc }) => {
              const on = homeCards[key] ?? true;
              return (
                <Linha
                  key={key}
                  title={label}
                  detail={desc}
                  chave={{
                    checked: on,
                    onChange: (next) =>
                      updateHomeCards({ ...homeCards, [key]: next }),
                  }}
                />
              );
            })}
          </Grupo>

          {/* Notificações — opt-in, nunca spam (§7.3). Só com o navegador
              que suporta; no iPhone fora do app, aponta a instalação. */}
          {pushSupported ? (
            <Grupo
              titulo="Notificações"
              rodape={
                pushError ? (
                  <span style={{ color: "var(--danger)" }}>{pushError}</span>
                ) : undefined
              }
            >
              <Linha
                title="Lembretes de atendimento"
                detail="Atendimento chegando perto, cliente que costuma voltar"
                chave={{
                  checked: pushEnabled,
                  onChange: (v) => {
                    if (!pushBusy) void handleTogglePush(v);
                  },
                  disabled: pushBusy,
                }}
                last
              />
            </Grupo>
          ) : pushNeedsInstall ? (
            <Grupo titulo="Notificações">
              <Linha
                title="Lembretes de atendimento"
                detail="Instale o app para ativar"
                onClick={() => setInstallSheetOpen(true)}
                last
              />
            </Grupo>
          ) : null}

          {/* Exportar — sempre disponível, mesmo com assinatura vencida
              (§7.4: confiança > lock-in). */}
          <Grupo
            titulo="Dados e privacidade"
            rodape={
              <>
                {exportAviso ? (
                  <span
                    role="status"
                    className="block"
                    style={{
                      marginBottom: 6,
                      fontWeight: 700,
                      color: exportAviso.ok
                        ? "var(--success)"
                        : "var(--danger)",
                    }}
                  >
                    {exportAviso.texto}
                  </span>
                ) : null}
                Seus dados ficam guardados na nuvem, na sua conta, e sincronizam
                entre seus aparelhos. Cada conta enxerga só os próprios dados,
                criptografados em repouso no servidor. Ainda não há criptografia
                ponta a ponta: preferimos ser honestos a prometer mais do que
                entregamos.
              </>
            }
          >
            <Linha
              title={exporting ? "Exportando…" : "Exportar meus dados"}
              detail="CSV com atendimentos, despesas e receitas"
              onClick={handleExport}
              last
            />
          </Grupo>

          {linhasApp.length > 0 ? (
            <Grupo titulo="Aplicativo">
              {onOpenTour ? (
                <Linha
                  title="Ver tour do app"
                  detail="Onde fica cada coisa, passo a passo"
                  onClick={onOpenTour}
                  last={standalone}
                />
              ) : null}
              {/* Instalar: abre a folha direto, num toque só. */}
              {!standalone ? (
                <Linha
                  title="Instalar Arcelle"
                  detail={
                    pushNeedsInstall
                      ? "Abre mais rápido, funciona offline e libera as notificações"
                      : "Acesso rápido e funcionamento offline"
                  }
                  onClick={() => setInstallSheetOpen(true)}
                  last
                />
              ) : null}
            </Grupo>
          ) : null}

          <Grupo>
            <Linha
              title="Sair da conta"
              perigo
              onClick={() => setSairAberto(true)}
              last
            />
          </Grupo>
        </div>
      ) : null}

      <div
        className="space-y-6"
        style={{ display: activePage === "appearance" ? undefined : "none" }}
      >
        <Grupo titulo="Tema">
          <div className="grid grid-cols-4 gap-2 p-3">
            {THEMES.map((t) => {
              const active = montado && theme === t;
              const accent = THEME_ACCENTS[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleThemeChange(t)}
                  aria-pressed={active}
                  aria-label={`Tema ${THEME_LABELS[t]}`}
                  className="flex flex-col items-center gap-1.5 transition-all duration-200"
                  style={{
                    minHeight: 76,
                    padding: "10px 4px",
                    borderRadius: 14,
                    background: active ? "var(--accent-tint)" : "transparent",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                  }}
                >
                  <span
                    className="relative grid place-items-center rounded-full"
                    style={{ width: 30, height: 30, background: accent }}
                  >
                    {active ? (
                      <Check size={16} color="#fff" strokeWidth={3} />
                    ) : null}
                  </span>
                  <span
                    className="font-semibold"
                    style={{
                      fontSize: 12,
                      color: active ? "var(--text)" : "var(--text-muted)",
                    }}
                  >
                    {THEME_LABELS[t]}
                  </span>
                </button>
              );
            })}
          </div>
        </Grupo>

        <Grupo titulo="Modo">
          <div className="p-3">
            <SegmentedControl<"dark" | "light">
              value={mode}
              onChange={setMode}
              options={[
                {
                  id: "dark",
                  label: (
                    <span className="flex items-center justify-center gap-1.5">
                      <Moon size={14} /> Escuro
                    </span>
                  ),
                },
                {
                  id: "light",
                  label: (
                    <span className="flex items-center justify-center gap-1.5">
                      <Sun size={14} /> Claro
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </Grupo>
      </div>

      {/* Sair pede confirmação: a linha fica no fim da lista, ao alcance do
          polegar, e antes saía na hora. */}
      <BottomSheet
        open={sairAberto}
        onClose={() => setSairAberto(false)}
        title="Sair da conta?"
      >
        <div className="px-5 py-5">
          <p
            style={{
              fontSize: 14.5,
              lineHeight: 1.5,
              color: "var(--text-2)",
              marginBottom: 16,
            }}
          >
            Para voltar, você vai entrar de novo com seu e-mail e senha. Seus
            dados continuam guardados na sua conta.
          </p>
          <div className="flex flex-col" style={{ gap: 10 }}>
            <button
              type="button"
              onClick={onSignOut}
              className="w-full font-bold active:opacity-80"
              style={{
                minHeight: 50,
                borderRadius: 16,
                background: "var(--danger)",
                color: "#fff",
                fontSize: 15,
              }}
            >
              Sair
            </button>
            <button
              type="button"
              onClick={() => setSairAberto(false)}
              className="w-full font-bold active:opacity-80"
              style={{
                minHeight: 50,
                borderRadius: 16,
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: 15,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </BottomSheet>

      <ReauthModal
        open={reauthMotivo !== null}
        motivo={reauthMotivo ?? "desligar-pin"}
        onClose={() => setReauthMotivo(null)}
        onConfirmado={() => reauthMotivo && contaConfirmada(reauthMotivo)}
        onSair={onSignOut}
      />

      <PinSetup
        open={pinSetupOpen}
        userId={userId}
        onClose={() => setPinSetupOpen(false)}
        onSaved={handlePinSaved}
      />

      <NotificacoesSheet
        open={notifSheetOpen}
        onClose={() => setNotifSheetOpen(false)}
        onConfirm={handleConfirmSubscribe}
        onNeedsInstall={() => {
          setNotifSheetOpen(false);
          setInstallSheetOpen(true);
        }}
        busy={pushBusy}
      />

      <InstallSheet
        open={installSheetOpen}
        onClose={() => setInstallSheetOpen(false)}
      />
    </div>
  );
}
