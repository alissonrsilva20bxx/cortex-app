"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--body-bg)" }}
    >
      {/* Logo */}
      <div className="mb-12 text-center">
        <h1
          className="text-4xl font-bold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          JobApp
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          Seus atendimentos, organizados.
        </p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-3xl p-8"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-color)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <p
          className="text-center text-sm mb-6"
          style={{ color: "var(--text-muted)" }}
        >
          Entre com sua conta Google para continuar
        </p>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
          style={{
            background: loading
              ? "rgb(var(--accent-rgb) / 0.5)"
              : "var(--accent)",
            color: "#fff",
            boxShadow: loading ? "none" : "var(--glow)",
          }}
        >
          {!loading && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#ffffff"
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
      </div>
    </div>
  );
}
