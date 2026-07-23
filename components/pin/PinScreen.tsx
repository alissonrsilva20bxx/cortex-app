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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-0"
      style={{ background: "var(--body-bg)" }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div
          className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-4"
          style={{
            background:
              "linear-gradient(135deg, rgb(var(--accent-rgb) / 0.25), rgb(var(--accent-rgb) / 0.08))",
            border: "1px solid rgb(var(--accent-rgb) / 0.3)",
            boxShadow: "var(--glow-sm)",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p
          className="text-[26px] font-extrabold tracking-tight"
          style={{
            color: "var(--text)",
            letterSpacing: "-0.03em",
          }}
        >
          Bom te ver de novo.
        </p>
        <p
          className="text-sm mt-1 transition-all duration-200"
          style={{ color: error ? "var(--danger)" : "var(--text-muted)" }}
        >
          {error ? "PIN incorreto. Tente novamente." : "Seu espaço, só seu."}
        </p>
      </div>

      {/* Dots */}
      <div
        className="flex gap-4 mb-10"
        style={{ animation: shake ? "shake 0.4s ease" : "none" }}
      >
        {[0, 1, 2, 3].map((i) => {
          const filled = digits.length > i;
          return (
            <div
              key={i}
              className="rounded-full transition-all duration-200"
              style={{
                width: filled ? "16px" : "13px",
                height: filled ? "16px" : "13px",
                background: filled
                  ? error
                    ? "var(--danger)"
                    : "var(--accent)"
                  : "transparent",
                border: `2px solid ${
                  filled
                    ? error
                      ? "var(--danger)"
                      : "var(--accent)"
                    : "var(--border-color)"
                }`,
                boxShadow:
                  filled && !error
                    ? "0 0 16px rgb(var(--accent-rgb) / 0.7), 0 0 6px var(--accent)"
                    : filled && error
                      ? "0 0 14px rgb(var(--danger-rgb) / 0.6)"
                      : "none",
              }}
            />
          );
        })}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-72">
        {KEYS.map((key, i) => {
          if (!key) return <div key={i} />;
          return (
            <button
              key={key + i}
              onClick={() => press(key)}
              className="flex items-center justify-center rounded-2xl font-semibold transition-all active:scale-95"
              style={{
                height: "72px",
                fontSize: key === "del" ? undefined : "22px",
                background:
                  key === "del" ? "transparent" : "rgb(var(--bg-rgb) / 0.55)",
                border:
                  key === "del"
                    ? "none"
                    : "1px solid rgb(var(--accent-rgb) / 0.14)",
                backdropFilter: key === "del" ? "none" : "blur(10px)",
                color: "var(--text)",
                boxShadow:
                  key === "del"
                    ? "none"
                    : "inset 0 1px 0 rgb(255 255 255 / 0.06), 0 1px 2px rgb(0 0 0 / 0.3)",
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
