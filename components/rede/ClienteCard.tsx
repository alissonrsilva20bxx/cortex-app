"use client";

import { Phone } from "lucide-react";
import { Avatar } from "./Avatar";
import { CLIENTE_STATUS_META } from "./clienteStatus";
import type { Cliente } from "@/lib/mockRede";

const formatDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });

interface Props {
  cliente: Cliente;
  onClick: () => void;
}

export function ClienteCard({ cliente, onClick }: Props) {
  const meta = CLIENTE_STATUS_META[cliente.status];
  return (
    <button
      onClick={onClick}
      className="glass-card w-full text-left rounded-2xl p-3.5 transition-all active:opacity-80 active:scale-[0.99]"
      style={{ borderLeft: `3px solid rgb(${meta.rgb})` }}
    >
      <div className="flex items-center gap-3">
        <Avatar nome={cliente.nome} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "var(--text)" }}
            >
              {cliente.nome}
            </p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: `rgb(${meta.rgb} / 0.12)`,
                color: `rgb(${meta.rgb})`,
              }}
            >
              {meta.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Phone size={11} style={{ color: "var(--text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {cliente.telefone} · último contato{" "}
              {formatDate(cliente.ultimoContato)}
            </span>
          </div>
          {cliente.etiquetas.length > 0 && (
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {cliente.etiquetas.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "var(--surface)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
