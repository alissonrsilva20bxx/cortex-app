"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";

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
      <div className="flex items-center gap-2.5 mb-6 animate-fade-up">
        <div
          className="flex items-center justify-center"
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            background: "rgb(var(--accent-rgb) / 0.14)",
            border: "1px solid rgb(var(--accent-rgb) / 0.22)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
              stroke="var(--accent)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span
          className="font-extrabold"
          style={{ fontSize: 17, color: "var(--text)" }}
        >
          JobApp
        </span>
      </div>

      {/* Prévia da projeção — vende o "aha" antes de pedir o login */}
      <GlassCard
        radius="xl"
        className="w-full max-w-sm p-6 animate-fade-up"
        style={{
          animationDelay: "80ms",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ filter: "blur(7px)", opacity: 0.55, userSelect: "none" }}>
          <p className="section-label">Você já construiu</p>
          <p
            style={{
              marginTop: 8,
              fontSize: 36,
              fontWeight: 900,
              color: "var(--accent)",
            }}
          >
            R$ 3.240
          </p>
          <div className="progress-track" style={{ marginTop: 16 }}>
            <div className="progress-fill" style={{ width: "62%" }} />
          </div>
        </div>

        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-center px-5"
          style={{
            background: "rgb(var(--bg-rgb) / 0.4)",
            backdropFilter: "blur(1px)",
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "rgb(var(--bg-rgb) / 0.7)",
              border: "1px solid rgb(var(--accent-rgb) / 0.25)",
            }}
          >
            <Lock size={18} style={{ color: "var(--accent)" }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            Sua projeção te espera
          </p>
          <p
            style={{
              fontSize: 12.5,
              color: "var(--text-muted)",
              lineHeight: 1.5,
              maxWidth: 220,
            }}
          >
            Entre pra ver, no seu ritmo, o quanto você já construiu.
          </p>
        </div>
      </GlassCard>

      {/* CTA */}
      <div
        className="w-full max-w-sm mt-4 animate-fade-up"
        style={{ animationDelay: "160ms" }}
      >
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
          className="text-center mt-4 leading-relaxed"
          style={{ fontSize: "11.5px", color: "var(--text-muted)" }}
        >
          Ao entrar, você concorda com os termos de uso e política de
          privacidade.
        </p>
      </div>
    </div>
  );
}
