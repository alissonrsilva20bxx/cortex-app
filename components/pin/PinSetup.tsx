"use client";

import { useState } from "react";
import { Delete, X } from "lucide-react";
import { hashPin } from "@/lib/pin";
import { supabase } from "@/lib/supabase";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

type Step = "enter" | "confirm";

interface Props {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSaved: (hash: string) => void;
}

export function PinSetup({ open, userId, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>("enter");
  const [first, setFirst] = useState<string[]>([]);
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setStep("enter");
    setFirst([]);
    setDigits([]);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function press(key: string) {
    if (key === "del") {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (!key || digits.length >= 4) return;
    const next = [...digits, key];
    setDigits(next);

    if (next.length === 4) {
      if (step === "enter") {
        setFirst(next);
        setDigits([]);
        setStep("confirm");
      } else {
        if (next.join("") !== first.join("")) {
          setError("PINs não coincidem. Tente novamente.");
          setDigits([]);
          setFirst([]);
          setStep("enter");
        } else {
          savePin(next.join(""));
        }
      }
    }
  }

  async function savePin(pin: string) {
    setSaving(true);
    const h = await hashPin(pin);
    await supabase
      .from("configuracoes")
      .upsert({ user_id: userId, pin_hash: h }, { onConflict: "user_id" });
    setSaving(false);
    onSaved(h);
    handleClose();
  }

  const current = digits;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50"
          style={{
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            background: "rgb(var(--bg-rgb) / 0.6)",
          }}
          onClick={handleClose}
        />
      )}

      <div
        className="fixed left-0 right-0 z-50 rounded-t-3xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          bottom: 0,
          transform: open ? "translateY(0)" : "translateY(105%)",
          background: "var(--surface-2)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid var(--border-color)",
          borderBottom: "none",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div
            className="w-9 h-1 rounded-full absolute left-1/2 -translate-x-1/2 top-3"
            style={{ background: "var(--border-color)" }}
          />
          <p
            className="font-semibold text-base mt-2"
            style={{ color: "var(--text)" }}
          >
            {step === "enter" ? "Definir PIN" : "Confirmar PIN"}
          </p>
          <button onClick={handleClose} className="p-1 mt-2 active:opacity-70">
            <X size={20} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        <div className="flex flex-col items-center py-8 px-5">
          <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
            {error
              ? error
              : step === "enter"
                ? "Digite um PIN de 4 dígitos"
                : "Digite o PIN novamente para confirmar"}
          </p>

          {/* Dots */}
          <div className="flex gap-5 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full transition-all duration-150"
                style={{
                  background:
                    current.length > i ? "var(--accent)" : "var(--surface-2)",
                  border: "2px solid",
                  borderColor:
                    current.length > i
                      ? "var(--accent)"
                      : "var(--border-color)",
                  boxShadow: current.length > i ? "var(--glow)" : "none",
                }}
              />
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 w-56">
            {KEYS.map((key, i) => {
              if (!key) return <div key={i} />;
              return (
                <button
                  key={key + i}
                  onClick={() => press(key)}
                  disabled={saving}
                  className="flex items-center justify-center h-14 rounded-2xl text-lg font-semibold transition-all active:scale-95 active:opacity-70 disabled:opacity-40"
                  style={{
                    background:
                      key === "del" ? "transparent" : "var(--surface)",
                    border:
                      key === "del" ? "none" : "1px solid var(--border-color)",
                    color: "var(--text)",
                  }}
                >
                  {key === "del" ? (
                    <Delete size={20} style={{ color: "var(--text-muted)" }} />
                  ) : (
                    key
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
