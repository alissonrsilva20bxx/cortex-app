"use client";

import { useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Avatar } from "./Avatar";
import { findUser, type Conversation, type RedeMessage } from "@/lib/mockRede";

interface Props {
  conversation: Conversation;
  messages: RedeMessage[];
  onBack: () => void;
  onOpenAutor: (userId: string) => void;
  onSend: (texto: string) => void;
}

export function ChatThreadScreen({
  conversation,
  messages,
  onBack,
  onOpenAutor,
  onSend,
}: Props) {
  const [texto, setTexto] = useState("");
  const user = findUser(conversation.userId);

  function handleSend() {
    if (!texto.trim()) return;
    onSend(texto.trim());
    setTexto("");
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
        {user && (
          <button
            onClick={() => onOpenAutor(user.id)}
            className="flex items-center gap-2.5 min-w-0"
          >
            <Avatar nome={user.nome} cor={user.cor} size="sm" />
            <span
              className="font-bold truncate"
              style={{
                fontSize: "17px",
                letterSpacing: "-0.01em",
                color: "var(--text)",
              }}
            >
              {user.nome}
            </span>
          </button>
        )}
      </div>

      {/* Bolhas */}
      <div className="space-y-2.5">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.deMim ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[78%] px-4 py-2.5 text-sm leading-relaxed"
              style={{
                background: m.deMim ? "var(--accent)" : "var(--surface)",
                color: m.deMim ? "#fff" : "var(--text)",
                border: m.deMim ? "none" : "1px solid var(--border-color)",
                borderRadius: "18px",
                borderBottomRightRadius: m.deMim ? "4px" : "18px",
                borderBottomLeftRadius: m.deMim ? "18px" : "4px",
              }}
            >
              {m.texto}
              <div
                className="text-[10px] mt-1"
                style={{
                  color: m.deMim
                    ? "rgb(255 255 255 / 0.7)"
                    : "var(--text-muted)",
                }}
              >
                {m.hora}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Campo de envio fixo */}
      <div
        className="fixed left-0 right-0 z-40 flex items-center gap-2 px-4"
        style={{
          bottom: "calc(82px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
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
          disabled={!texto.trim()}
          aria-label="Enviar"
          className="flex items-center justify-center rounded-full shrink-0 transition-opacity active:opacity-70 disabled:opacity-40"
          style={{
            width: 42,
            height: 42,
            background: "var(--accent)",
            boxShadow: "var(--glow-sm)",
          }}
        >
          <Send size={16} color="#fff" />
        </button>
      </div>
    </div>
  );
}
