"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, THEME_LABELS, THEME_ACCENTS } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { PinSetup } from "@/components/pin/PinSetup";
import type { Theme } from "@/lib/theme";
import type {
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

type TabId = "aparencia" | "seguranca" | "nuvem";

interface Props {
  userId: string;
  onSignOut: () => void;
  onPinHashChange: (hash: string | null) => void;
  onHomeCardsChange: (c: HomeCardConfig) => void;
  onCardStylesChange: (c: CardStyleConfig) => void;
  onChartPrefsChange: (c: ChartPrefConfig) => void;
}

export function AjustesTab({
  userId,
  onSignOut,
  onPinHashChange,
  onHomeCardsChange,
  onCardStylesChange,
  onChartPrefsChange,
}: Props) {
  const { theme, setTheme, mode, setMode } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>("aparencia");
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [homeCards, setHomeCardsState] =
    useState<HomeCardConfig>(DEFAULT_HOME_CARDS);
  const [chartPrefs, setChartPrefsState] =
    useState<ChartPrefConfig>(DEFAULT_CHART_PREFS);

  useEffect(() => {
    supabase
      .from("configuracoes")
      .select("tema, pin_hash")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data?.tema) setTheme(data.tema as Theme);
        setPinEnabled(!!data?.pin_hash);
      });
    const hc = localStorage.getItem("jobapp-home-cards");
    if (hc) setHomeCardsState(JSON.parse(hc));
    const cp = localStorage.getItem("jobapp-chart-prefs");
    if (cp) setChartPrefsState(JSON.parse(cp));
  }, [userId, setTheme]);

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
      label: "Próximo Job",
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

      {/* TAB NAVIGATION */}
      <div
        className="flex gap-2 mb-6 border-b"
        style={{ borderColor: "rgb(var(--accent-rgb) / 0.1)" }}
      >
        {(["aparencia", "seguranca", "nuvem"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const labels = {
            aparencia: "Aparência",
            seguranca: "Segurança",
            nuvem: "Nuvem",
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-3 font-bold text-xs uppercase transition-all"
              style={{
                fontSize: "11px",
                letterSpacing: "0.05em",
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                borderBottom: isActive ? "2px solid var(--accent)" : "none",
                paddingBottom: isActive ? "10px" : "12px",
              }}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* TAB: APARÊNCIA */}
      {activeTab === "aparencia" && (
        <div className="space-y-6">
          {/* Tema */}
          <section>
            <p className="section-label mb-3">Tema</p>
            <div className="grid grid-cols-4 gap-2">
              {THEMES.map((t) => {
                const active = theme === t;
                const accent = THEME_ACCENTS[t];
                return (
                  <button
                    key={t}
                    onClick={() => handleThemeChange(t)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-[18px] transition-all duration-200"
                    style={{
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
          </section>

          {/* Modo */}
          <section>
            <p className="section-label mb-3">Modo</p>
            <div className="flex gap-3">
              {(["dark", "light"] as const).map((m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all"
                    style={{
                      background: active
                        ? "rgb(var(--accent-rgb) / 0.15)"
                        : "var(--surface)",
                      border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                      color: active ? "var(--accent)" : "var(--text-muted)",
                      boxShadow: active ? "var(--glow-sm)" : "none",
                    }}
                  >
                    {m === "dark" ? <Moon size={15} /> : <Sun size={15} />}
                    {m === "dark" ? "Escuro" : "Claro"}
                    {active && <Check size={13} />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Tela Inicial */}
          <section>
            <p className="section-label mb-3">Tela Inicial</p>
            <div className="space-y-2">
              {homeCardItems.map(({ key, label, desc }) => {
                const on = homeCards[key] ?? true;
                return (
                  <button
                    key={key}
                    onClick={() =>
                      updateHomeCards({ ...homeCards, [key]: !on })
                    }
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-[18px] transition-all"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border-color)",
                    }}
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
                    <div
                      className="relative rounded-full transition-all duration-300 shrink-0"
                      style={{
                        width: 42,
                        height: 24,
                        background: on ? "var(--accent)" : "var(--surface-2)",
                        boxShadow: on ? "var(--glow-sm)" : "none",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div
                        className="absolute top-0.5 rounded-full bg-white transition-all duration-300"
                        style={{
                          width: 18,
                          height: 18,
                          left: on ? "20px" : "2px",
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Gráficos */}
          <section>
            <p className="section-label mb-3">Gráficos</p>
            <div
              className="rounded-[18px] p-4 space-y-4"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div>
                <p
                  className="text-xs font-semibold mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Financeiro
                </p>
                <div className="flex gap-2">
                  {(["bar", "area"] as const).map((id) => {
                    const active = chartPrefs.financeiro === id;
                    const labels = { bar: "Barras", area: "Área" };
                    const icons = {
                      bar: <BarChart2 size={15} />,
                      area: <TrendingUp size={15} />,
                    };
                    return (
                      <button
                        key={id}
                        onClick={() =>
                          updateChartPrefs({ ...chartPrefs, financeiro: id })
                        }
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-xs transition-all"
                        style={{
                          background: active
                            ? "rgb(var(--accent-rgb) / 0.15)"
                            : "var(--bg)",
                          border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                          color: active ? "var(--accent)" : "var(--text-muted)",
                          boxShadow: active ? "var(--glow-sm)" : "none",
                        }}
                      >
                        {icons[id]}
                        {labels[id]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p
                  className="text-xs font-semibold mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Jobs
                </p>
                <div className="flex gap-2">
                  {(["bar", "donut"] as const).map((id) => {
                    const active = chartPrefs.jobs === id;
                    const labels = { bar: "Barras", donut: "Pizza" };
                    const icons = {
                      bar: <BarChart2 size={15} />,
                      donut: <BarChart2 size={15} />,
                    };
                    return (
                      <button
                        key={id}
                        onClick={() =>
                          updateChartPrefs({ ...chartPrefs, jobs: id })
                        }
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-xs transition-all"
                        style={{
                          background: active
                            ? "rgb(var(--accent-rgb) / 0.15)"
                            : "var(--bg)",
                          border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                          color: active ? "var(--accent)" : "var(--text-muted)",
                          boxShadow: active ? "var(--glow-sm)" : "none",
                        }}
                      >
                        {icons[id]}
                        {labels[id]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB: SEGURANÇA */}
      {activeTab === "seguranca" && (
        <div className="space-y-6">
          {/* PIN */}
          <section>
            <p className="section-label mb-3">PIN (4 dígitos)</p>
            {pinEnabled ? (
              <button
                onClick={handleDisablePin}
                className="flex items-center gap-3.5 w-full px-4 py-4 rounded-[18px] transition-opacity active:opacity-70"
                style={{
                  background: "rgb(var(--accent-rgb) / 0.07)",
                  border: "1px solid rgb(var(--accent-rgb) / 0.2)",
                }}
              >
                <div
                  className="flex items-center justify-center rounded-xl shrink-0"
                  style={{
                    width: 36,
                    height: 36,
                    background: "rgb(var(--accent-rgb) / 0.12)",
                  }}
                >
                  <Lock size={16} style={{ color: "var(--accent)" }} />
                </div>
                <div className="text-left">
                  <p
                    className="font-semibold"
                    style={{ fontSize: "14px", color: "var(--text)" }}
                  >
                    PIN ativo
                  </p>
                  <p
                    className="mt-0.5 font-medium"
                    style={{ fontSize: "12px", color: "var(--text-muted)" }}
                  >
                    Toque para desativar
                  </p>
                </div>
              </button>
            ) : (
              <button
                onClick={() => setPinSetupOpen(true)}
                className="flex items-center gap-3.5 w-full px-4 py-4 rounded-[18px] transition-opacity active:opacity-70"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div
                  className="flex items-center justify-center rounded-xl shrink-0"
                  style={{
                    width: 36,
                    height: 36,
                    background: "var(--surface-2, var(--surface))",
                  }}
                >
                  <LockOpen size={16} style={{ color: "var(--text-muted)" }} />
                </div>
                <div className="text-left">
                  <p
                    className="font-semibold"
                    style={{ fontSize: "14px", color: "var(--text)" }}
                  >
                    Ativar PIN
                  </p>
                  <p
                    className="mt-0.5 font-medium"
                    style={{ fontSize: "12px", color: "var(--text-muted)" }}
                  >
                    Proteger com código 4 dígitos
                  </p>
                </div>
              </button>
            )}
          </section>

          {/* Aviso de privacidade */}
          <section
            style={{
              background: "rgb(var(--accent-rgb) / 0.08)",
              border: "1.5px solid rgb(var(--accent-rgb) / 0.2)",
              borderRadius: "16px",
              padding: "14px",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                lineHeight: "1.5",
                margin: 0,
              }}
            >
              🔒 <strong>Privacidade garantida</strong> — Seus dados estão
              criptografados de ponta a ponta
            </p>
          </section>
        </div>
      )}

      {/* TAB: NUVEM */}
      {activeTab === "nuvem" && (
        <div className="space-y-6">
          {/* Status */}
          <section
            style={{
              background:
                "linear-gradient(135deg, rgba(80,220,120,0.12) 0%, rgba(80,220,120,0.05) 100%)",
              border: "1.5px solid rgba(80,220,120,0.25)",
              borderRadius: "16px",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>✓</span>
              <div>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#50dc78",
                    margin: "0 0 3px 0",
                  }}
                >
                  Sincronizado
                </p>
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    margin: 0,
                  }}
                >
                  Última atualização: agora mesmo
                </p>
              </div>
            </div>
          </section>

          {/* Criptografia */}
          <section>
            <p className="section-label mb-3">🔐 Criptografia</p>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-color)",
                borderRadius: "14px",
                padding: "14px",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--text)",
                  margin: "0 0 8px 0",
                }}
              >
                AES-256 (Ponta a ponta)
              </p>
              <p
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  margin: 0,
                }}
              >
                Nível máximo de criptografia • 100% seguro
              </p>
            </div>
          </section>

          {/* Backup */}
          <section>
            <p className="section-label mb-3">💾 Backup</p>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-color)",
                borderRadius: "14px",
                padding: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--text)",
                    fontWeight: 600,
                  }}
                >
                  Backup automático
                </span>
                <input
                  type="checkbox"
                  checked
                  style={{
                    width: "18px",
                    height: "18px",
                    accentColor: "var(--accent)",
                  }}
                />
              </div>
            </div>
          </section>

          {/* Info */}
          <section
            style={{
              background: "rgb(var(--accent-rgb) / 0.07)",
              border: "1px solid rgb(var(--accent-rgb) / 0.18)",
              borderRadius: "12px",
              padding: "12px",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                color: "var(--accent-soft)",
                margin: 0,
                lineHeight: "1.5",
              }}
            >
              <strong>Conformidade:</strong> Seus dados estão protegidos
              conforme LGPD e normas internacionais de privacidade
            </p>
          </section>
        </div>
      )}

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
          className="flex items-center gap-3.5 w-full px-4 py-4 rounded-[18px] transition-opacity active:opacity-70"
          style={{
            background: "rgba(255,70,70,0.07)",
            border: "1px solid rgba(255,70,70,0.18)",
          }}
        >
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{ width: 36, height: 36, background: "rgba(255,70,70,0.1)" }}
          >
            <LogOut size={16} color="#ff4646" />
          </div>
          <span
            className="font-semibold"
            style={{ fontSize: "14px", color: "#ff4646" }}
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
    </div>
  );
}
