"use client";

import { Phone, Pencil, Trash2 } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Avatar } from "./Avatar";
import { CLIENTE_STATUS_META } from "./clienteStatus";
import type { Cliente } from "@/lib/mockRede";

const formatDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

interface Props {
  cliente: Cliente | null;
  onClose: () => void;
  onEdit: (cliente: Cliente) => void;
  onDeleteRequest: (cliente: Cliente) => void;
}

export function ClienteDetailSheet({
  cliente,
  onClose,
  onEdit,
  onDeleteRequest,
}: Props) {
  return (
    <BottomSheet
      open={!!cliente}
      onClose={onClose}
      title="Cliente"
      footer={
        cliente ? (
          <div className="space-y-2">
            <button
              onClick={() => onEdit(cliente)}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80"
              style={{ background: "var(--accent)", color: "white" }}
            >
              <Pencil size={15} />
              Editar
            </button>
            <button
              onClick={() => onDeleteRequest(cliente)}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-semibold text-sm transition-opacity active:opacity-80"
              style={{ color: "var(--danger)" }}
            >
              <Trash2 size={15} />
              Excluir cliente
            </button>
          </div>
        ) : undefined
      }
    >
      {cliente && (
        <div className="px-5 py-5 space-y-5">
          <div className="flex items-center gap-3.5">
            <Avatar nome={cliente.nome} size="lg" />
            <div className="min-w-0">
              <p
                className="font-bold truncate"
                style={{ fontSize: "17px", color: "var(--text)" }}
              >
                {cliente.nome}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <Phone size={12} style={{ color: "var(--text-muted)" }} />
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {cliente.telefone}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{
                background: `rgb(${CLIENTE_STATUS_META[cliente.status].rgb} / 0.12)`,
                color: `rgb(${CLIENTE_STATUS_META[cliente.status].rgb})`,
              }}
            >
              {CLIENTE_STATUS_META[cliente.status].label}
            </span>
            {cliente.etiquetas.map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full"
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

          <div>
            <p className="section-label mb-2">Último contato</p>
            <p className="text-sm" style={{ color: "var(--text)" }}>
              {formatDate(cliente.ultimoContato)}
            </p>
          </div>

          <div>
            <p className="section-label mb-2">Observações</p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--text-2)" }}
            >
              {cliente.observacoes || "Sem observações registradas."}
            </p>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
