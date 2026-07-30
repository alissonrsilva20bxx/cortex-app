"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Send,
  Loader2,
  Check,
  AlertCircle,
  MoreHorizontal,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "@/lib/mockRede";
import type { ConversaResumo, MensagemChat } from "@/lib/rede/mensagens";

/** Mensagem real + estado transitório de envio otimista -- a tabela não
 * tem "enviando"/"falhou", isso só existe enquanto o insert real não
 * confirma (ver `sendMessage`/`retrySend` em RedeTab). */
export type ChatMessage = MensagemChat & { status?: "sending" | "error" };

interface Props {
  conversation: ConversaResumo;
  messages: ChatMessage[];
  loading: boolean;
  onBack: () => void;
  onOpenAutor: (userId: string) => void;
  onOpenMenu: () => void;
  onSend: (texto: string) => void;
  onRetry: (messageId: string) => void;
  /** Simula o teclado empurrando o compositor pra cima e escondendo a BottomNav. */
  onComposerFocusChange?: (focused: boolean) => void;
}

export function ChatThreadScreen({
  conversation,
  messages,
  loading,
  onBack,
  onOpenAutor,
  onOpenMenu,
  onSend,
  onRetry,
  onComposerFocusChange,
}: Props) {
  const [texto, setTexto] = useState("");
  const [focused, setFocused] = useState(false);
  const isSending = messages.some((m) => m.deMim && m.status === "sending");

  function handleSend() {
    if (!texto.trim() || isSending) return;
    onSend(texto.trim());
    setTexto("");
  }

  function setComposerFocused(v: boolean) {
    setFocused(v);
    onComposerFocusChange?.(v);
  }

  return (
    <div className="pb-24">
      {/* Header com avatar da pessoa */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          aria-label="Voltar"
          className="flex items-center justify-center rounded-full shrink-0 transition-opacity active:opacity-70"
          style={{ width: 40, height: 40, background: "var(--surface)" }}
        >
          <ArrowLeft size={18} style={{ color: "var(--text)" }} />
        </button>
        <button
          onClick={() => onOpenAutor(conversation.outroUserId)}
          className="flex items-center gap-2.5 min-w-0 flex-1"
        >
          <Avatar
            nome={conversation.outroNome}
            cor={conversation.outroCor}
            size="sm"
          />
          <div className="min-w-0 text-left">
            <p
              className="font-bold truncate"
              style={{
                fontSize: "17px",
                letterSpacing: "-0.01em",
                color: "var(--text)",
              }}
            >
              {conversation.outroNome}
            </p>
          </div>
        </button>
        <button
          onClick={onOpenMenu}
          aria-label="Mais opções"
          className="flex items-center justify-center rounded-full shrink-0 transition-opacity active:opacity-70"
          style={{ width: 36, height: 36, background: "var(--surface)" }}
        >
          <MoreHorizontal size={16} style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      {/* Bolhas */}
      <div className="space-y-2.5">
        {loading ? (
          <p
            className="text-sm text-center py-12"
            style={{ color: "var(--text-muted)" }}
          >
            Carregando conversa…
          </p>
        ) : messages.length === 0 ? (
          <p
            className="text-sm text-center py-12"
            style={{ color: "var(--text-muted)" }}
          >
            Nenhuma mensagem ainda. Diga oi!
          </p>
        ) : (
          messages.map((m) => {
            const failed = m.deMim && m.status === "error";
            const sending = m.deMim && m.status === "sending";
            return (
              <div
                key={m.id}
                className={`flex ${m.deMim ? "justify-end" : "justify-start"}`}
              >
                <button
                  onClick={() => failed && onRetry(m.id)}
                  disabled={!failed}
                  className="max-w-[78%] px-4 py-2.5 text-sm leading-relaxed text-left"
                  style={{
                    background: m.deMim ? "var(--accent)" : "var(--surface)",
                    color: m.deMim ? "#fff" : "var(--text)",
                    border: failed
                      ? "1px solid var(--danger)"
                      : m.deMim
                        ? "none"
                        : "1px solid var(--border-color)",
                    borderRadius: "18px",
                    borderBottomRightRadius: m.deMim ? "4px" : "18px",
                    borderBottomLeftRadius: m.deMim ? "18px" : "4px",
                    opacity: sending ? 0.6 : 1,
                    cursor: failed ? "pointer" : "default",
                  }}
                >
                  {m.texto}
                  <div
                    className="flex items-center gap-1 text-[10px] mt-1"
                    style={{
                      color: failed
                        ? "var(--danger)"
                        : m.deMim
                          ? "rgb(255 255 255 / 0.7)"
                          : "var(--text-2)",
                    }}
                  >
                    {sending && (
                      <>
                        <Loader2 size={10} className="animate-spin" />
                        Enviando…
                      </>
                    )}
                    {failed && (
                      <>
                        <AlertCircle size={10} />
                        Falha ao enviar · toque para tentar novamente
                      </>
                    )}
                    {!sending && !failed && (
                      <>
                        {formatRelativeTime(m.criadoEm)}
                        {m.deMim && <Check size={11} />}
                      </>
                    )}
                  </div>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Campo de envio fixo — sobe e some da BottomNav quando "o teclado abre" */}
      <div
        className="fixed left-0 right-0 z-40 flex items-center gap-2 px-4"
        style={{
          bottom: focused
            ? "calc(272px + env(safe-area-inset-bottom, 0px))"
            : "calc(94px + env(safe-area-inset-bottom, 0px))",
          transition: "bottom 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          onFocus={() => setComposerFocused(true)}
          onBlur={() => setComposerFocused(false)}
          placeholder="Escreva uma mensagem…"
          className="flex-1 text-sm"
          style={{
            background: "var(--surface-2)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-pill)",
            color: "var(--text)",
            padding: "12px 18px",
            boxShadow: "0 8px 24px rgb(0 0 0 / 0.2)",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!texto.trim() || isSending}
          aria-label="Enviar"
          className="flex items-center justify-center rounded-full shrink-0 transition-opacity active:opacity-70 disabled:opacity-40"
          style={{
            width: 42,
            height: 42,
            background: "var(--accent)",
            boxShadow: "var(--glow-sm)",
          }}
        >
          {isSending ? (
            <Loader2 size={16} color="#fff" className="animate-spin" />
          ) : (
            <Send size={16} color="#fff" />
          )}
        </button>
      </div>
    </div>
  );
}
