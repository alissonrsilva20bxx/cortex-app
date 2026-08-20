"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { OpeningMotion } from "@/components/entry/OpeningMotion";
import styles from "./entry.module.css";

type Stage = "motion" | "login";

export default function LoginPage() {
  const toast = useToast();
  const [stage, setStage] = useState<Stage>("motion");
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage === "login") emailRef.current?.focus({ preventScroll: true });
  }, [stage]);

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  function notAvailableYet() {
    toast.error("Login por e-mail chega em breve — use o Google por agora.");
  }

  if (stage === "motion") {
    return <OpeningMotion onDone={() => setStage("login")} />;
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.screen} ${styles.loginArrival}`}>
        <header className={styles.brand}>
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
          <strong>JobApp</strong>
        </header>

        <section className={styles.intro}>
          <h1>
            Bom ter você
            <br />
            de volta.
          </h1>
          <p>Entre para continuar de onde parou.</p>
        </section>

        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            notAvailableYet();
          }}
        >
          <label>
            <span>E-mail</span>
            <div>
              <Mail />
              <input
                ref={emailRef}
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="voce@exemplo.com"
              />
            </div>
          </label>
          <label>
            <span>Senha</span>
            <div>
              <LockKeyhole />
              <input
                name="password"
                required
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
              />
              <button
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          <button
            type="button"
            className={`${styles.linkButton} ${styles.rowEnd}`}
            disabled
            aria-disabled
          >
            Esqueci minha senha
          </button>
          <button type="submit" className={styles.primary}>
            Entrar <ArrowRight />
          </button>
          <p className={styles.emailNote}>
            Login por e-mail chega em breve. Por enquanto, entre com o Google
            abaixo.
          </p>
        </form>

        <section
          className={styles.signature}
          aria-label="Rotina e comunidade no JobApp"
        >
          <p>
            Trabalho em ordem. <span>Rede por perto.</span>
          </p>
          <i aria-hidden="true" />
          <small>
            Gerencie jobs, agenda e recebimentos. Na Rede, troque indicações e
            encontre novas oportunidades.
          </small>
        </section>

        <footer className={styles.screenFooter}>
          <div className={styles.providers} aria-label="Outra forma de entrar">
            <button
              aria-label="Continuar com Google"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
            >
              <GoogleMark />
              <span>
                {googleLoading ? "Redirecionando…" : "Continuar com Google"}
              </span>
            </button>
          </div>
          <p>
            Primeira vez aqui?{" "}
            <button
              type="button"
              className={styles.linkButton}
              disabled
              aria-disabled
            >
              Criar conta
            </button>
          </p>
        </footer>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.37l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.31.31-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.63.39 3.17 1.04 4.54l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z"
      />
    </svg>
  );
}
