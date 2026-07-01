"use client";

import { useEffect, useState } from "react";
import { LogOut, Lock, LockOpen, Check } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, THEME_LABELS, THEME_ACCENTS } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { PinSetup } from "@/components/pin/PinSetup";
import type { Theme } from "@/lib/theme";

interface Props {
  userId: string;
  onSignOut: () => void;
  onPinHashChange: (hash: string | null) => void;
}

export function AjustesTab({ userId, onSignOut, onPinHashChange }: Props) {
  const { theme, setTheme } = useTheme();
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);

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

  return (
    <div className="pb-6">
      <h2
        className="font-extrabold mb-8"
        style={{
          fontSize: "26px",
          letterSpacing: "-0.03em",
          color: "var(--text)",
        }}
      >
        Ajustes
      </h2>

      {/* Tema */}
      <section className="mb-8">
        <p className="section-label mb-4">Tema</p>

        <div className="flex flex-col gap-2.5">
          {THEMES.map((t) => {
            const active = theme === t;
            const accent = THEME_ACCENTS[t];
            return (
              <button
                key={t}
                onClick={() => handleThemeChange(t)}
                className="flex items-center gap-4 w-full px-4 py-3.5 rounded-[18px] transition-all duration-200 active:opacity-75"
                style={{
                  background: active ? `${accent}18` : "var(--surface)",
                  border: `1px solid ${active ? `${accent}55` : "var(--border-color)"}`,
                  boxShadow: active ? `0 0 18px ${accent}22` : "none",
                }}
              >
                {/* Color swatch */}
                <div
                  className="rounded-full shrink-0"
                  style={{
                    width: "30px",
                    height: "30px",
                    background: accent,
                    boxShadow: active
                      ? `0 0 14px ${accent}90`
                      : `0 0 6px ${accent}40`,
                  }}
                />

                <span
                  className="font-semibold flex-1 text-left"
                  style={{
                    fontSize: "14px",
                    color: active ? accent : "var(--text)",
                  }}
                >
                  {THEME_LABELS[t]}
                </span>

                {/* Active checkmark */}
                {active && (
                  <div
                    className="flex items-center justify-center rounded-full shrink-0"
                    style={{
                      width: "22px",
                      height: "22px",
                      background: accent,
                      boxShadow: `0 0 10px ${accent}70`,
                    }}
                  >
                    <Check size={12} color="white" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Segurança */}
      <section className="mb-8">
        <p className="section-label mb-4">Segurança</p>

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
                width: "36px",
                height: "36px",
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
                width: "36px",
                height: "36px",
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
                Proteger app com código de 4 dígitos
              </p>
            </div>
          </button>
        )}
      </section>

      {/* Conta */}
      <section>
        <p className="section-label mb-4">Conta</p>

        <button
          onClick={onSignOut}
          className="flex items-center gap-3.5 w-full px-4 py-4 rounded-[18px] transition-opacity active:opacity-70"
          style={{
            background: "rgba(255, 70, 70, 0.07)",
            border: "1px solid rgba(255, 70, 70, 0.18)",
          }}
        >
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{
              width: "36px",
              height: "36px",
              background: "rgba(255, 70, 70, 0.1)",
            }}
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
      </section>

      <PinSetup
        open={pinSetupOpen}
        userId={userId}
        onClose={() => setPinSetupOpen(false)}
        onSaved={handlePinSaved}
      />
    </div>
  );
}
