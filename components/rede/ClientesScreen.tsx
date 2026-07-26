"use client";

import { useMemo, useState } from "react";
import { Search, Plus, ShieldCheck } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { ClienteCard } from "./ClienteCard";
import { FilterChips } from "@/components/ui/FilterChips";
import type { Cliente, ClienteStatus } from "@/lib/mockRede";

type Filtro = "todos" | ClienteStatus;

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "vip", label: "VIP" },
  { id: "ativo", label: "Ativo" },
  { id: "em-negociacao", label: "Em negociação" },
  { id: "pausado", label: "Pausado" },
];

interface Props {
  clientes: Cliente[];
  onBack: () => void;
  onAddNew: () => void;
  onOpenCliente: (cliente: Cliente) => void;
}

export function ClientesScreen({
  clientes,
  onBack,
  onAddNew,
  onOpenCliente,
}: Props) {
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clientes.filter((c) => {
      const matchesQuery = q.length === 0 || c.nome.toLowerCase().includes(q);
      const matchesFiltro = filtro === "todos" || c.status === filtro;
      return matchesQuery && matchesFiltro;
    });
  }, [clientes, query, filtro]);

  return (
    <div className="pb-4">
      <ScreenHeader
        title="Clientes"
        onBack={onBack}
        action={
          <button
            onClick={onAddNew}
            aria-label="Novo cliente"
            className="flex items-center justify-center rounded-full shrink-0 transition-opacity active:opacity-70"
            style={{ width: 40, height: 40, background: "var(--accent)" }}
          >
            <Plus size={18} color="#fff" />
          </button>
        }
      />

      <div className="flex items-start gap-2 mb-4">
        <ShieldCheck
          size={13}
          className="shrink-0 mt-0.5"
          style={{ color: "var(--text-muted)" }}
        />
        <p
          className="text-[11px] leading-snug"
          style={{ color: "var(--text-muted)" }}
        >
          Área privada: seus clientes nunca aparecem no Feed nem são publicados
          automaticamente.
        </p>
      </div>

      <div
        className="flex items-center gap-2.5 px-4 mb-4"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-pill)",
          height: 42,
        }}
      >
        <Search size={15} style={{ color: "var(--text-muted)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente…"
          className="flex-1 text-sm h-full"
          style={{ background: "transparent", color: "var(--text)" }}
        />
      </div>

      <FilterChips
        options={FILTROS}
        value={filtro}
        onChange={setFiltro}
        className="mb-4"
      />

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p
            className="text-sm text-center py-12"
            style={{ color: "var(--text-muted)" }}
          >
            Nenhum cliente encontrado.
          </p>
        ) : (
          filtered.map((c) => (
            <ClienteCard
              key={c.id}
              cliente={c}
              onClick={() => onOpenCliente(c)}
            />
          ))
        )}
      </div>
    </div>
  );
}
