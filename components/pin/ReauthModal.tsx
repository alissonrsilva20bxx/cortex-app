"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { reauthAtual } from "@/lib/reauth";
import { TEXTOS_SEM_REDE, textoDaConfirmacao } from "@/lib/reauthRegras";
import type {
  MetodoReauth,
  MotivoReauth,
  ReauthAdapter,
} from "@/lib/reauthRegras";

/**
 * "Confirme que é você": senha da conta OU Google, antes de mexer no PIN.
 * Usado no "Esqueci o PIN" da tela de bloqueio (dentro da própria folha do
 * teclado, `inline`: um portal ficaria atrás da trava) e para desligar ou
 * trocar o PIN nos Ajustes (folha de baixo).
 *
 * Só mostra o que a conta tem: senha para conta de e-mail, Google para
 * conta Google, os dois para quem tem os dois. O Google sai do app e volta
 * pelo /auth/callback; quem pediu confere a volta (`retornoDoGoogle`).
 */

interface Props {
  open: boolean;
  motivo: MotivoReauth;
  onClose: () => void;
  /** A conta foi confirmada (senha). O Google confirma na volta. */
  onConfirmado: () => void;
  /** Dentro de outra tela (tela de bloqueio), sem folha própria. */
  inline?: boolean;
  /** Sem nenhum método (conta sem senha nem Google): sair e entrar de novo. */
  onSair?: () => void;
  adapter?: ReauthAdapter;
}

export function ReauthModal({
  open,
  motivo,
  onClose,
  onConfirmado,
  inline = false,
  onSair,
  adapter,
}: Props) {
  const reauth = adapter ?? reauthAtual();
  const [metodos, setMetodos] = useState<MetodoReauth[] | null>(null);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [semRede, setSemRede] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setSenha("");
    setErro(null);
    setMetodos(null);
    setSemRede(false);
    reauth
      .metodos()
      .then((m) => vivo && setMetodos(m))
      // Falhou ao consultar (sem internet): não afirma nada sobre a conta.
      .catch(() => vivo && setSemRede(true));
    return () => {
      vivo = false;
    };
  }, [open, reauth, tentativa]);

  async function confirmarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (!senha || enviando) return;
    setEnviando(true);
    setErro(null);
    const r = await reauth.comSenha(senha);
    setEnviando(false);
    setSenha("");
    if (r.ok) onConfirmado();
    else setErro(r.erro);
  }

  async function irParaGoogle() {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    const r = await reauth.comGoogle(motivo);
    // Deu certo: a página já está indo para o Google.
    if (r && !r.ok) {
      setErro(r.erro);
      setEnviando(false);
    }
  }

  const corpo = (
    <div
      className="flex flex-col"
      style={{ gap: 12 }}
      data-reauth={motivo}
      role={inline ? "region" : undefined}
      aria-label={inline ? "Confirme que é você" : undefined}
    >
      {inline && (
        <strong style={{ fontSize: 17, fontWeight: 800 }}>
          Confirme que é você
        </strong>
      )}
      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.5,
          color: "var(--t-mut)",
        }}
      >
        {textoDaConfirmacao(motivo, metodos)}
      </p>

      {metodos === null && !semRede && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--t-mut)" }}>
          Carregando…
        </p>
      )}

      {metodos?.includes("senha") && (
        <form
          onSubmit={confirmarSenha}
          className="flex flex-col"
          style={{ gap: 8 }}
        >
          <label
            htmlFor={`reauth-senha-${motivo}`}
            style={{ fontSize: 12, fontWeight: 700, color: "var(--t-mut)" }}
          >
            Senha da conta
          </label>
          <input
            id={`reauth-senha-${motivo}`}
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            data-reauth-senha
            style={{
              minHeight: 48,
              borderRadius: 14,
              padding: "0 14px",
              fontSize: 16,
              background: "var(--t-sub)",
              color: "var(--t-ink)",
              border: "1px solid var(--t-line)",
            }}
          />
          <button
            type="submit"
            disabled={!senha || enviando}
            data-reauth-confirmar
            style={{
              minHeight: 52,
              borderRadius: 16,
              background: "var(--t-acc)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 800,
              opacity: !senha || enviando ? 0.55 : 1,
            }}
          >
            {enviando ? "Confirmando…" : "Confirmar"}
          </button>
        </form>
      )}

      {metodos?.includes("google") && (
        <button
          type="button"
          onClick={() => void irParaGoogle()}
          disabled={enviando}
          data-reauth-google
          style={{
            minHeight: 52,
            borderRadius: 16,
            background: "var(--t-sub)",
            color: "var(--t-ink)",
            border: "1px solid var(--t-line)",
            fontSize: 15,
            fontWeight: 800,
          }}
        >
          Continuar com o Google
        </button>
      )}

      {semRede && (
        <>
          <p
            role="alert"
            data-reauth-sem-rede
            style={{ margin: 0, fontSize: 13.5, color: "var(--t-mut)" }}
          >
            {TEXTOS_SEM_REDE.conta}
          </p>
          <button
            type="button"
            onClick={() => setTentativa((n) => n + 1)}
            data-reauth-tentar-de-novo
            style={{
              minHeight: 52,
              borderRadius: 16,
              background: "var(--t-acc)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            {TEXTOS_SEM_REDE.tentarDeNovo}
          </button>
        </>
      )}

      {metodos !== null && metodos.length === 0 && (
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--t-mut)" }}>
          Esta conta não tem senha nem Google ligados a ela. Saia da conta e
          entre de novo para continuar.
        </p>
      )}
      {metodos !== null && metodos.length === 0 && onSair && (
        <button
          type="button"
          onClick={onSair}
          style={{
            minHeight: 52,
            borderRadius: 16,
            background: "var(--t-acc)",
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
          }}
        >
          Sair da conta
        </button>
      )}

      {erro && (
        <p
          role="alert"
          data-reauth-erro
          style={{
            margin: 0,
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--t-red)",
          }}
        >
          {erro}
        </p>
      )}

      {inline && (
        <button
          type="button"
          onClick={onClose}
          data-reauth-cancelar
          style={{
            display: "block",
            margin: "0 auto",
            minHeight: 44,
            padding: "0 16px",
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--t-mut)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Voltar ao teclado
        </button>
      )}
    </div>
  );

  if (inline) return open ? corpo : null;
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Confirme que é você"
      largeCloseTarget
    >
      <div style={{ padding: "4px 20px 20px" }}>{corpo}</div>
    </BottomSheet>
  );
}
