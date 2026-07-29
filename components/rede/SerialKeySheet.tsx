"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/Toast";

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-color)",
  borderRadius: "12px",
  color: "var(--text)",
  fontSize: "16px",
  fontWeight: 600,
  letterSpacing: "0.04em",
  padding: "14px 16px",
  width: "100%",
  textAlign: "center",
  textTransform: "uppercase",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SerialKeySheet({ open, onClose, onConfirm }: Props) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // BottomSheet mantém o conteúdo montado mesmo fechado (só translada pra
  // fora da tela), então autoFocus no <input> dispararia o teclado assim
  // que a aba Rede carregasse. Focar aqui, atrelado à abertura real.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleClose() {
    setCode("");
    setSubmitting(false);
    onClose();
  }

  async function handleConfirm() {
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/rede/convites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "resgatar", codigo: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível resgatar o convite.");
        return;
      }
      setCode("");
      onConfirm();
    } catch {
      toast.error("Não foi possível resgatar o convite.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title="Código de acesso"
      footer={
        <button
          onClick={handleConfirm}
          disabled={!code.trim() || submitting}
          className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {submitting ? "Validando…" : "Entrar na Rede"}
        </button>
      }
    >
      <div className="px-5 py-5 space-y-4">
        <div className="flex justify-center">
          <div
            className="flex items-center justify-center rounded-2xl"
            style={{
              width: 52,
              height: 52,
              background: "rgb(var(--accent-rgb) / 0.14)",
              boxShadow: "var(--glow-sm)",
            }}
          >
            <KeyRound size={22} style={{ color: "var(--accent)" }} />
          </div>
        </div>
        <p
          className="text-sm text-center leading-relaxed"
          style={{ color: "var(--text-2)" }}
        >
          Recebeu um convite? Digite o código de acesso pra liberar sua entrada
          antecipada na Rede.
        </p>
        <input
          ref={inputRef}
          style={inputStyle}
          placeholder="REDE-BETA-0001"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
          name="codigo-convite-rede"
          autoComplete="one-time-code"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          // Safari trata "Código de acesso" como campo de credencial e
          // oferece o ícone de senha salva do iCloud Chaveiro — que ele
          // posiciona errado dentro de sheets com transform (flutua solto
          // colado na BottomNav). autoComplete="off" não bastou (Safari
          // ignora "off" quando já decidiu que parece senha por conta
          // própria); "one-time-code" é o valor que a própria Apple
          // recomenda pra campo de código recebido, não credencial salva.
        />
      </div>
    </BottomSheet>
  );
}
