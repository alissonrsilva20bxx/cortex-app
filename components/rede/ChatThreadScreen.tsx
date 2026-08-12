"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Send,
  Loader2,
  Check,
  AlertCircle,
  MoreHorizontal,
  ArrowDown,
  WifiOff,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "@/lib/mockRede";
import {
  computeKeyboardInset,
  resolveScrollBehavior,
  shouldAutoScrollOnNewMessage,
} from "@/lib/rede/chatUi";
import type { ConversaResumo, MensagemChat } from "@/lib/rede/mensagens";

/** Mensagem real + estado transitório de envio otimista -- a tabela não
 * tem "enviando"/"falhou", isso só existe enquanto o insert real não
 * confirma (ver `sendMessage`/`retrySend` em RedeTab). */
export type ChatMessage = MensagemChat & { status?: "sending" | "error" };

interface Props {
  conversation: ConversaResumo;
  messages: ChatMessage[];
  loading: boolean;
  /** Falha persistente ao carregar a conversa -- distinta de "sem
   * mensagens ainda", para não sugerir reenviar uma saudação já mandada
   * antes (achado P1 #6 da auditoria de T9). */
  error?: boolean;
  /** `navigator.onLine` -- desabilita o envio (o rascunho fica no campo,
   * não se perde) e explica por que, em vez de deixar o envio falhar
   * silenciosamente como uma falha de rede genérica. */
  offline?: boolean;
  onBack: () => void;
  onOpenAutor: (userId: string) => void;
  onOpenMenu: () => void;
  onSend: (texto: string) => void;
  onRetry: (messageId: string) => void;
  onRetryLoad?: () => void;
  /** Simula o teclado empurrando o compositor pra cima e escondendo a BottomNav. */
  onComposerFocusChange?: (focused: boolean) => void;
}

function getDistanceFromBottomPx(): number {
  if (typeof window === "undefined") return 0;
  return Math.max(
    0,
    document.documentElement.scrollHeight - window.scrollY - window.innerHeight
  );
}

export function ChatThreadScreen({
  conversation,
  messages,
  loading,
  error = false,
  offline = false,
  onBack,
  onOpenAutor,
  onOpenMenu,
  onSend,
  onRetry,
  onRetryLoad,
  onComposerFocusChange,
}: Props) {
  const [texto, setTexto] = useState("");
  const [focused, setFocused] = useState(false);
  const isSending = messages.some((m) => m.deMim && m.status === "sending");

  // ── Keyboard-avoidance real: mede o teclado on-screen de verdade via
  // visualViewport em vez de um offset fixo chutado (achado P1 #1 da
  // auditoria de T9) -- sem visualViewport (navegador sem suporte), cai
  // de volta pro valor calibrado manualmente que já existia. ──
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    function update() {
      setKeyboardInset(
        computeKeyboardInset({
          windowInnerHeight: window.innerHeight,
          visualViewportHeight: vv!.height,
          visualViewportOffsetTop: vv!.offsetTop,
        })
      );
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // ── Scroll-to-bottom: abre a conversa já no fim (achado P1 #2) e rola
  // de novo quando chega mensagem nova, só se for minha ou se quem está
  // lendo já estiver perto do fundo -- do contrário mostra um aviso em
  // vez de interromper a leitura de mensagens antigas. ──
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasJumpedRef = useRef(false);
  const prevMessagesLenRef = useRef(0);
  const distanceFromBottomRef = useRef(0);
  const [showNewMessagePill, setShowNewMessagePill] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    function onScroll() {
      distanceFromBottomRef.current = getDistanceFromBottomPx();
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    hasJumpedRef.current = false;
    prevMessagesLenRef.current = 0;
    setShowNewMessagePill(false);
  }, [conversation.id]);

  useEffect(() => {
    if (loading || error) return;
    if (!hasJumpedRef.current) {
      // Primeira renderização com dados de verdade: pula pro fundo sem
      // animação -- é abrir a conversa, não uma mensagem chegando.
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      hasJumpedRef.current = true;
      prevMessagesLenRef.current = messages.length;
      return;
    }
    if (messages.length > prevMessagesLenRef.current) {
      const ultima = messages[messages.length - 1];
      const deveRolar = shouldAutoScrollOnNewMessage({
        distanceFromBottomPx: distanceFromBottomRef.current,
        isOwnMessage: ultima?.deMim ?? false,
      });
      if (deveRolar) {
        bottomRef.current?.scrollIntoView({
          behavior: resolveScrollBehavior(reducedMotion),
          block: "end",
        });
        setShowNewMessagePill(false);
      } else {
        setShowNewMessagePill(true);
      }
    }
    prevMessagesLenRef.current = messages.length;
  }, [messages, loading, error, reducedMotion]);

  function scrollToBottomNow() {
    bottomRef.current?.scrollIntoView({
      behavior: resolveScrollBehavior(reducedMotion),
      block: "end",
    });
    setShowNewMessagePill(false);
  }

  function handleSend() {
    if (!texto.trim() || isSending || offline) return;
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
          style={{ width: 44, height: 44, background: "var(--surface)" }}
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
          style={{ width: 44, height: 44, background: "var(--surface)" }}
        >
          <MoreHorizontal size={16} style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      {offline && (
        <div
          className="flex items-center gap-2 px-3.5 py-2.5 mb-4 text-xs font-medium"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-lg)",
            color: "var(--text-2)",
          }}
        >
          <WifiOff size={14} style={{ color: "var(--text-muted)" }} />
          Você está offline. Não é possível enviar mensagens agora.
        </div>
      )}

      {/* Bolhas */}
      <div className="space-y-2.5">
        {loading ? (
          <p
            className="text-sm text-center py-12"
            style={{ color: "var(--text-muted)" }}
          >
            Carregando conversa…
          </p>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              Não foi possível carregar esta conversa.
            </p>
            {onRetryLoad && (
              <button
                onClick={onRetryLoad}
                className="text-sm font-semibold mt-2 active:opacity-70"
                style={{ color: "var(--accent)" }}
              >
                Tentar novamente
              </button>
            )}
          </div>
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
        <div ref={bottomRef} />
      </div>

      {showNewMessagePill && (
        <div
          className="fixed left-0 right-0 z-40 flex justify-center"
          style={{
            bottom: focused
              ? "calc(272px + env(safe-area-inset-bottom, 0px))"
              : "calc(150px + env(safe-area-inset-bottom, 0px))",
            transition: "bottom 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          <button
            onClick={scrollToBottomNow}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full active:opacity-80"
            style={{
              background: "var(--accent)",
              color: "#fff",
              boxShadow: "var(--glow-sm)",
            }}
          >
            <ArrowDown size={12} />
            Nova mensagem
          </button>
        </div>
      )}

      {/* Campo de envio fixo — sobe e some da BottomNav quando o teclado abre */}
      <div
        className="fixed left-0 right-0 z-40 flex items-center gap-2 px-4"
        style={{
          bottom: focused
            ? keyboardInset > 0
              ? `calc(${keyboardInset}px + 12px)`
              : "calc(272px + env(safe-area-inset-bottom, 0px))"
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
          disabled={!texto.trim() || isSending || offline}
          aria-label="Enviar"
          className="flex items-center justify-center rounded-full shrink-0 transition-opacity active:opacity-70 disabled:opacity-40"
          style={{
            width: 44,
            height: 44,
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
