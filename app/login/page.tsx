"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--body-bg)" }}
    >
      {/* Logo */}
      <div className="mb-14 text-center animate-fade-up">
        <div
          className="w-20 h-20 rounded-[28px] flex items-center justify-center mx-auto mb-6"
          style={{
            background:
              "linear-gradient(135deg, rgb(var(--accent-rgb) / 0.18), rgb(var(--accent-rgb) / 0.05))",
            border: "1px solid rgb(var(--accent-rgb) / 0.22)",
            boxShadow: "var(--glow-sm), inset 0 1px 0 rgb(255 255 255 / 0.08)",
          }}
        >
          {/* Clipboard icon */}
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
              stroke="var(--accent)"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x="9"
              y="3"
              width="6"
              height="4"
              rx="1.5"
              stroke="var(--accent)"
              strokeWidth="1.7"
            />
            <path
              d="M9 12h6M9 16h4"
              stroke="var(--accent)"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1
          className="font-extrabold tracking-tight"
          style={{
            fontSize: "36px",
            letterSpacing: "-0.04em",
            color: "var(--text)",
          }}
        >
          JobApp
        </h1>
        <p
          className="mt-2.5 font-medium"
          style={{ fontSize: "14px", color: "var(--text-muted)" }}
        >
          Seus atendimentos, organizados.
        </p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-3xl p-8 animate-fade-up"
        style={{
          animationDelay: "80ms",
          background: "rgb(var(--bg-rgb) / 0.48)",
          border: "1px solid rgb(var(--accent-rgb) / 0.12)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow:
            "inset 0 1px 0 rgb(255 255 255 / 0.06), 0 8px 40px rgb(0 0 0 / 0.32)",
        }}
      >
        <p
          className="text-center font-medium leading-relaxed mb-6"
          style={{ fontSize: "14px", color: "var(--text-muted)" }}
        >
          Entre com sua conta Google para continuar
        </p>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-sm active:scale-95 disabled:opacity-60"
          style={{
            background: loading
              ? "rgb(var(--accent-rgb) / 0.4)"
              : "var(--accent)",
            color: "#fff",
            boxShadow: loading ? "none" : "var(--glow)",
            transition: "all 0.2s ease",
          }}
        >
          {!loading && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#fff"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#ffffff99"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#ffffff99"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#ffffff99"
              />
            </svg>
          )}
          {loading ? "Redirecionando…" : "Entrar com Google"}
        </button>

        <p
          className="text-center mt-5 leading-relaxed"
          style={{ fontSize: "11.5px", color: "var(--text-muted)" }}
        >
          Ao entrar, você concorda com os termos de uso e política de
          privacidade.
        </p>
      </div>

      <p
        className="mt-8 animate-fade-up"
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          animationDelay: "160ms",
        }}
      >
        v1.0 · Feito para profissionais autônomos
      </p>
    </div>
  );
}
