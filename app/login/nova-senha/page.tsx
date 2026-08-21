"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { updatePassword } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import styles from "../entry.module.css";

export default function NovaSenhaPage() {
  const router = useRouter();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(
      new FormData(event.currentTarget).get("password") ?? ""
    ).trim();
    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Senha atualizada!");
    router.push("/");
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.screen} ${styles.loginArrival}`}>
        <section className={styles.intro}>
          <h1>Nova senha</h1>
          <p>Escolha uma senha nova para sua conta.</p>
        </section>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            <span>Nova senha</span>
            <div>
              <LockKeyhole />
              <input
                name="password"
                required
                minLength={6}
                autoComplete="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="Pelo menos 6 caracteres"
                autoFocus
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
            type="submit"
            className={styles.primary}
            disabled={submitting}
          >
            {submitting ? "Salvando…" : "Salvar senha"} <ArrowRight />
          </button>
        </form>
      </div>
    </div>
  );
}
