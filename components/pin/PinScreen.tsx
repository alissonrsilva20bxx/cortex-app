"use client";

import { useState, useEffect } from "react";
import { Delete } from "lucide-react";
import { verifyPin } from "@/lib/pin";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

interface Props {
  pinHash: string;
  onUnlock: () => void;
}

export function PinScreen({ pinHash, onUnlock }: Props) {
  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (digits.length !== 4) return;
    verifyPin(digits.join(""), pinHash).then((ok) => {
      if (ok) {
        onUnlock();
      } else {
        setShake(true);
        setError(true);
        setTimeout(() => {
          setShake(false);
          setError(false);
          setDigits([]);
        }, 700);
      }
    });
  }, [digits, pinHash, onUnlock]);

  function press(key: string) {
    if (key === "del") {
      setDigits((d) => d.slice(0, -1));
    } else if (key && digits.length < 4) {
      setDigits((d) => [...d, key]);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: "var(--body-bg)" }}
    >
      <p className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
        JobApp
      </p>
      <p className="text-sm mb-10" style={{ color: "var(--text-muted)" }}>
        {error ? "PIN incorreto" : "Digite seu PIN"}
      </p>

      {/* Dots */}
      <div
        className={`flex gap-5 mb-12 transition-transform ${shake ? "animate-shake" : ""}`}
        style={{ animation: shake ? "shake 0.4s ease" : "none" }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-full transition-all duration-200"
            style={{
              background:
                digits.length > i
                  ? error
                    ? "#ff5050"
                    : "var(--accent)"
                  : "var(--surface-2)",
              border: "2px solid",
              borderColor:
                digits.length > i
                  ? error
                    ? "#ff5050"
                    : "var(--accent)"
                  : "var(--border-color)",
              boxShadow: digits.length > i && !error ? "var(--glow)" : "none",
            }}
          />
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-4 w-64">
        {KEYS.map((key, i) => {
          if (!key) return <div key={i} />;
          return (
            <button
              key={key + i}
              onClick={() => press(key)}
              className="flex items-center justify-center h-16 rounded-2xl text-xl font-semibold transition-all active:scale-95 active:opacity-70"
              style={{
                background: key === "del" ? "transparent" : "var(--surface)",
                border:
                  key === "del" ? "none" : "1px solid var(--border-color)",
                color: "var(--text)",
              }}
            >
              {key === "del" ? (
                <Delete size={22} style={{ color: "var(--text-muted)" }} />
              ) : (
                key
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
