"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  Sun,
  Moon,
  BarChart2,
  TrendingUp,
  LayoutGrid,
  Lock,
  LockOpen,
  LogOut,
  ShieldCheck,
  Cloud,
  Timer,
  Download,
  Bell,
  Smartphone,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, THEME_LABELS, THEME_ACCENTS } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { PinSetup } from "@/components/pin/PinSetup";
import { GlassCard } from "@/components/ui/GlassCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { NotificacoesSheet } from "@/components/notificacoes/NotificacoesSheet";
import { InstallSheet } from "@/components/install/InstallSheet";
import { computeAssinatura } from "@/lib/assinatura";
import { formatBRL, totalEarnings } from "@/lib/finance";
import { exportarDadosCSV } from "@/lib/exportarDados";
import { isStandalone } from "@/lib/platform";
import {
  isPushSupported,
  isPushSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import type { Theme } from "@/lib/theme";
import type {
  HomeCardConfig,
  CardStyleConfig,
  ChartPrefConfig,
  AssinaturaStatus,
  Job,
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

interface Props {
  userId: string;
  jobs: Job[];
  onSignOut: () => void;
  onPinHashChange: (hash: string | null) => void;
  onHomeCardsChange: (c: HomeCardConfig) => void;
  onCardStylesChange: (c: CardStyleConfig) => void;
  onChartPrefsChange: (c: ChartPrefConfig) => void;
}

/** Um grupo de ajustes (rótulo + card único) -- a aparência do laboratório
 * (`SettingsScreen`/`SettingGroup`, `LaunchScreens.tsx:604-943`) é uma lista
 * única de grupos empilhados, sem abas internas, diferente da estrutura
 * anterior (3 abas via `SegmentedControl`). Helper só deste arquivo -- não é
 * um componente novo fora do whitelist da issue #37, que permite só
 * `AjustesTab.tsx`. */
function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <p className="section-label mb-3">{title}</p>
      {children}
    </section>
  );
}

/** Impede que o clique no `Switch` (que já dispara seu próprio `onChange`)
 * borbulhe até o `onClick` da linha inteira -- ver nota em cada uso abaixo. */
function StopClickPropagation({ children }: { children: ReactNode }) {
  return <span onClick={(e) => e.stopPropagation()}>{children}</span>;
}

export function AjustesTab({
  userId,
  jobs,
  onSignOut,
  onPinHashChange,
  onHomeCardsChange,
  onCardStylesChange,
  onChartPrefsChange,
}: Props) {
  const { theme, setTheme, mode, setMode } = useTheme();
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [homeCards, setHomeCardsState] =
    useState<HomeCardConfig>(DEFAULT_HOME_CARDS);
  const [chartPrefs, setChartPrefsState] =
    useState<ChartPrefConfig>(DEFAULT_CHART_PREFS);
  const [exporting, setExporting] = useState(false);
  const [assinatura, setAssinatura] = useState<{
    trialStartedAt: string;
    status: AssinaturaStatus;
  } | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [notifSheetOpen, setNotifSheetOpen] = useState(false);
  const [installSheetOpen, setInstallSheetOpen] = useState(false);
  const [standalone, setStandalone] = useState(false);

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
    const cp = localStorage.getItem("jobapp-chart-prefs");
    if (cp) setChartPrefsState(JSON.parse(cp));

    if (isPushSupported()) {
      setPushSupported(true);
      isPushSubscribed().then(setPushEnabled);
    }
    setStandalone(isStandalone());
  }, [userId, setTheme]);

  const estadoAssinatura = assinatura
    ? computeAssinatura(assinatura.trialStartedAt, assinatura.status)
    : null;

  async function handleThemeChange(t: Theme) {
    setTheme(t);
    await supabase
      .from("configuracoes")
      .upsert({ user_id: userId, tema: t }, { onConflict: "user_id" });
  }

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
    try {
      await exportarDadosCSV(userId);
    } finally {
      setExporting(false);
    }
  }

  function updateHomeCards(next: HomeCardConfig) {
    setHomeCardsState(next);
    localStorage.setItem("jobapp-home-cards", JSON.stringify(next));
    onHomeCardsChange(next);
  }

  function updateChartPrefs(next: ChartPrefConfig) {
    setChartPrefsState(next);
    localStorage.setItem("jobapp-chart-prefs", JSON.stringify(next));
    onChartPrefsChange(next);
  }

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
      key: "financeSummary",
      label: "Independência Financeira",
      desc: "Visão de receitas e despesas",
    },
    {
      key: "objetivos",
      label: "Objetivos Pessoais",
      desc: "Metas de vida e afazeres",
    },
  ];

  return (
    <div className="pb-6">
      <h2
        className="font-extrabold mb-6"
        style={{
          fontSize: "26px",
          letterSpacing: "-0.03em",
          color: "var(--text)",
        }}
      >
        Ajustes
      </h2>

      {/* Lista única de grupos, sem abas internas -- aparência do
          laboratório (SettingsScreen/SettingGroup); toda a lógica real
          (tema/PIN/push/exportar/personalização) segue idêntica. */}
      <div className="space-y-6">
        <SettingsGroup title="Aparência">
          <GlassCard radius="md" className="p-4 space-y-4">
            <div>
              <p
                className="text-xs font-semibold mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                Tema
              </p>
              <div className="grid grid-cols-4 gap-2">
                {THEMES.map((t) => {
                  const active = theme === t;
                  const accent = THEME_ACCENTS[t];
                  return (
                    <button
                      key={t}
                      onClick={() => handleThemeChange(t)}
                      className="flex flex-col items-center gap-1.5 py-3 transition-all duration-200"
                      style={{
                        borderRadius: "var(--radius-md)",
                        background: active ? `${accent}18` : "var(--surface)",
                        border: `1px solid ${active ? `${accent}55` : "var(--border-color)"}`,
                        boxShadow: active ? `0 0 16px ${accent}22` : "none",
                      }}
                    >
                      <div
                        className="rounded-full"
                        style={{
                          width: 28,
                          height: 28,
                          background: accent,
                          boxShadow: active
                            ? `0 0 14px ${accent}90`
                            : `0 0 6px ${accent}40`,
                        }}
                      />
                      <span
                        className="font-semibold text-[10px]"
                        style={{ color: active ? accent : "var(--text-muted)" }}
                      >
                        {THEME_LABELS[t]}
                      </span>
                      {active && (
                        <div
                          className="flex items-center justify-center rounded-full"
                          style={{
                            width: 16,
                            height: 16,
                            background: accent,
                            boxShadow: `0 0 8px ${accent}70`,
                            marginTop: -2,
                          }}
                        >
                          <Check size={9} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid var(--border-color)",
                paddingTop: 16,
              }}
            >
              <p
                className="text-xs font-semibold mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Modo
              </p>
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
          </GlassCard>
        </SettingsGroup>

        <SettingsGroup title="Segurança">
          <div className="space-y-3">
            <GlassCard
              radius="md"
              onClick={
                pinEnabled ? handleDisablePin : () => setPinSetupOpen(true)
              }
              className="flex items-center gap-3.5 px-4 py-4"
            >
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  background: "rgb(var(--accent-rgb) / 0.12)",
                }}
              >
                {pinEnabled ? (
                  <Lock size={16} style={{ color: "var(--accent)" }} />
                ) : (
                  <LockOpen size={16} style={{ color: "var(--text-muted)" }} />
                )}
              </div>
              <div className="text-left">
                <p
                  className="font-semibold"
                  style={{ fontSize: "14px", color: "var(--text)" }}
                >
                  {pinEnabled ? "PIN ativo" : "Ativar PIN"}
                </p>
                <p
                  className="mt-0.5 font-medium"
                  style={{ fontSize: "12px", color: "var(--text-muted)" }}
                >
                  {pinEnabled
                    ? "Toque para desativar"
                    : "Proteger o acesso com código de 4 dígitos"}
                </p>
              </div>
            </GlassCard>

            {/* O que o PIN faz — honesto, sem prometer o que não faz (§5.3) */}
            <GlassCard radius="md" className="flex items-start gap-3 p-4">
              <ShieldCheck
                size={18}
                className="shrink-0 mt-0.5"
                style={{ color: "var(--accent)" }}
              />
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                O PIN tranca a tela neste aparelho — quem pega o telefone não
                abre seu espaço sem o código. Ele protege o acesso, não
                substitui a senha da sua conta.
              </p>
            </GlassCard>
          </div>
        </SettingsGroup>

        <SettingsGroup title="Tela inicial">
          <div className="space-y-2">
            {homeCardItems.map(({ key, label, desc }) => {
              const on = homeCards[key] ?? true;
              return (
                <GlassCard
                  key={key}
                  radius="md"
                  as="div"
                  // Achado P1 #8 da auditoria de T10: o Switch (42×24px) era
                  // o único alvo de toque da linha -- tocar no card inteiro
                  // (ícone/rótulo/descrição) agora também alterna, não só o
                  // retângulo pequeno do switch. `as="div"` evita HTML
                  // inválido (botão dentro de botão, já que o Switch em si
                  // já é um `<button>`); StopClickPropagation impede que um
                  // toque direto no switch dispare o toggle duas vezes
                  // (uma pelo próprio switch, outra pelo card).
                  onClick={() => updateHomeCards({ ...homeCards, [key]: !on })}
                  className="flex items-center gap-3 pl-4 pr-2 py-2 cursor-pointer"
                >
                  <LayoutGrid
                    size={16}
                    style={{
                      color: on ? "var(--accent)" : "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  />
                  <div className="flex-1 text-left">
                    <p
                      className="font-semibold text-sm"
                      style={{ color: "var(--text)" }}
                    >
                      {label}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {desc}
                    </p>
                  </div>
                  <StopClickPropagation>
                    <Switch
                      checked={on}
                      onChange={(next) =>
                        updateHomeCards({ ...homeCards, [key]: next })
                      }
                      ariaLabel={label}
                    />
                  </StopClickPropagation>
                </GlassCard>
              );
            })}

            <GlassCard radius="md" className="p-4 space-y-4">
              <div>
                <p
                  className="text-xs font-semibold mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Gráfico — Financeiro
                </p>
                <SegmentedControl<"bar" | "area">
                  size="sm"
                  fullWidth
                  value={chartPrefs.financeiro}
                  onChange={(id) =>
                    updateChartPrefs({ ...chartPrefs, financeiro: id })
                  }
                  options={[
                    {
                      id: "bar",
                      label: (
                        <span className="flex items-center justify-center gap-1.5">
                          <BarChart2 size={14} /> Barras
                        </span>
                      ),
                    },
                    {
                      id: "area",
                      label: (
                        <span className="flex items-center justify-center gap-1.5">
                          <TrendingUp size={14} /> Área
                        </span>
                      ),
                    },
                  ]}
                />
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--border-color)",
                  paddingTop: 16,
                }}
              >
                <p
                  className="text-xs font-semibold mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Gráfico — Jobs
                </p>
                <SegmentedControl<"bar" | "donut">
                  size="sm"
                  fullWidth
                  value={chartPrefs.jobs}
                  onChange={(id) =>
                    updateChartPrefs({ ...chartPrefs, jobs: id })
                  }
                  options={[
                    {
                      id: "bar",
                      label: (
                        <span className="flex items-center justify-center gap-1.5">
                          <BarChart2 size={14} /> Barras
                        </span>
                      ),
                    },
                    {
                      id: "donut",
                      label: (
                        <span className="flex items-center justify-center gap-1.5">
                          <BarChart2 size={14} /> Pizza
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
            </GlassCard>
          </div>
        </SettingsGroup>

        {/* Notificações — opt-in, nunca spam (§7.3). Só aparece quando o
            navegador suporta; sem culpa se ela recusar a permissão. */}
        {pushSupported && (
          <SettingsGroup title="Notificações">
            <GlassCard
              radius="md"
              as="div"
              onClick={() => !pushBusy && handleTogglePush(!pushEnabled)}
              className="flex items-center gap-3.5 pl-4 pr-2 py-2 cursor-pointer"
            >
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  background: "rgb(var(--accent-rgb) / 0.12)",
                }}
              >
                <Bell size={16} style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 text-left">
                <p
                  className="font-semibold"
                  style={{ fontSize: "14px", color: "var(--text)" }}
                >
                  Lembretes
                </p>
                <p
                  className="mt-0.5 font-medium"
                  style={{ fontSize: "12px", color: "var(--text-muted)" }}
                >
                  Atendimento chegando perto, cliente que costuma voltar
                </p>
                {pushError && (
                  <p
                    className="mt-1 font-medium"
                    style={{ fontSize: "11px", color: "var(--danger)" }}
                  >
                    {pushError}
                  </p>
                )}
              </div>
              <StopClickPropagation>
                <Switch
                  checked={pushEnabled}
                  onChange={handleTogglePush}
                  disabled={pushBusy}
                  ariaLabel="Notificações"
                />
              </StopClickPropagation>
            </GlassCard>
          </SettingsGroup>
        )}

        {/* Instalar app — abre mais rápido e, no iPhone, é pré-requisito
            real pra notificação funcionar (limite da Apple, não nosso). */}
        {!standalone && (
          <SettingsGroup title="App">
            <GlassCard
              radius="md"
              onClick={() => setInstallSheetOpen(true)}
              className="flex items-center gap-3.5 px-4 py-4"
            >
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  background: "rgb(var(--accent-rgb) / 0.12)",
                }}
              >
                <Smartphone size={16} style={{ color: "var(--accent)" }} />
              </div>
              <div className="text-left">
                <p
                  className="font-semibold"
                  style={{ fontSize: "14px", color: "var(--text)" }}
                >
                  Instalar app
                </p>
                <p
                  className="mt-0.5 font-medium"
                  style={{ fontSize: "12px", color: "var(--text-muted)" }}
                >
                  Abre mais rápido e funciona offline
                </p>
              </div>
            </GlassCard>
          </SettingsGroup>
        )}

        <SettingsGroup title="Nuvem e dados">
          <div className="space-y-3">
            {/* Assinatura — estado do teste, tom sereno, sem culpa nem
                urgência falsa (§7.1). Nada aqui bloqueia o app. */}
            {estadoAssinatura && (
              <GlassCard radius="md" className="flex items-start gap-3 p-4">
                <Timer
                  size={18}
                  className="shrink-0 mt-0.5"
                  style={{ color: "var(--accent)" }}
                />
                <div>
                  {estadoAssinatura.status === "trial" && (
                    <>
                      <p
                        className="font-semibold text-sm"
                        style={{ color: "var(--text)" }}
                      >
                        Teste grátis — {estadoAssinatura.diasRestantes}{" "}
                        {estadoAssinatura.diasRestantes === 1
                          ? "dia restante"
                          : "dias restantes"}
                      </p>
                      <p
                        className="text-xs mt-1 leading-relaxed"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Sem cartão, sem compromisso. Continue no seu ritmo.
                      </p>
                    </>
                  )}
                  {estadoAssinatura.status === "vencida" && (
                    <>
                      <p
                        className="font-semibold text-sm"
                        style={{ color: "var(--text)" }}
                      >
                        Seu teste terminou
                      </p>
                      <p
                        className="text-xs mt-1 leading-relaxed"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Você já construiu {formatBRL(totalEarnings(jobs))} em{" "}
                        {jobs.filter((j) => j.status === "concluído").length}{" "}
                        atendimentos. Nada disso se perde — exporte seus dados
                        sempre que quiser aqui embaixo.
                      </p>
                    </>
                  )}
                  {estadoAssinatura.status === "ativa" && (
                    <p
                      className="font-semibold text-sm"
                      style={{ color: "var(--text)" }}
                    >
                      Assinatura ativa
                    </p>
                  )}
                </div>
              </GlassCard>
            )}

            {/* Onde os dados ficam — honesto */}
            <GlassCard radius="md" className="flex items-start gap-3 p-4">
              <Cloud
                size={18}
                className="shrink-0 mt-0.5"
                style={{ color: "var(--accent)" }}
              />
              <div>
                <p
                  className="font-semibold text-sm"
                  style={{ color: "var(--text)" }}
                >
                  Salvo na sua conta
                </p>
                <p
                  className="text-xs mt-1 leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  Seus dados e arquivos são guardados na nuvem, na sua conta, e
                  sincronizam sozinhos entre seus aparelhos.
                </p>
              </div>
            </GlassCard>

            {/* Proteção real — e o limite dela, com honestidade (§5.3) */}
            <GlassCard radius="md" className="p-4">
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                Cada conta enxerga só os próprios dados, e tudo fica
                criptografado em repouso no servidor. Ainda não há criptografia
                ponta a ponta — preferimos ser honestos sobre isso a prometer
                mais do que entregamos.
              </p>
            </GlassCard>

            {/* Exportar — sempre disponível, mesmo com assinatura vencida
                (§7.4: confiança > lock-in). Não depende do estado acima. */}
            <GlassCard
              radius="md"
              onClick={handleExport}
              className="flex items-center gap-3.5 px-4 py-4"
            >
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  background: "rgb(var(--accent-rgb) / 0.12)",
                }}
              >
                <Download size={16} style={{ color: "var(--accent)" }} />
              </div>
              <div className="text-left">
                <p
                  className="font-semibold"
                  style={{ fontSize: "14px", color: "var(--text)" }}
                >
                  {exporting ? "Exportando…" : "Exportar meus dados"}
                </p>
                <p
                  className="mt-0.5 font-medium"
                  style={{ fontSize: "12px", color: "var(--text-muted)" }}
                >
                  Baixa um CSV com atendimentos, despesas e receitas
                </p>
              </div>
            </GlassCard>
          </div>
        </SettingsGroup>
      </div>

      {/* FOOTER: LOGOUT - Sempre visível */}
      <div
        style={{
          borderTop: "1px solid rgb(var(--accent-rgb) / 0.1)",
          marginTop: "32px",
          paddingTop: "20px",
        }}
      >
        <button
          onClick={onSignOut}
          className="flex items-center gap-3.5 w-full px-4 py-4 transition-opacity active:opacity-70"
          style={{
            borderRadius: "var(--radius-md)",
            background: "rgb(var(--danger-rgb) / 0.07)",
            border: "1px solid rgb(var(--danger-rgb) / 0.18)",
          }}
        >
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{
              width: 36,
              height: 36,
              background: "rgb(var(--danger-rgb) / 0.1)",
            }}
          >
            <LogOut size={16} style={{ color: "var(--danger)" }} />
          </div>
          <span
            className="font-semibold"
            style={{ fontSize: "14px", color: "var(--danger)" }}
          >
            Sair da conta
          </span>
        </button>
      </div>

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
