"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { WishlistCard } from "./WishlistCard";
import { SkeletonGrid } from "./Skeleton";
import { FilterChips } from "@/components/ui/FilterChips";
import type { WishlistEstado, WishlistItem } from "@/lib/mockRede";

type FiltroEstado = "todos" | WishlistEstado;

const FILTROS: { id: FiltroEstado; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "quero", label: "Quero" },
  { id: "planejando", label: "Planejando" },
  { id: "conquistado", label: "Conquistado" },
];

interface Props {
  items: WishlistItem[];
  onBack: () => void;
  onAddNew: () => void;
  onOpenItem: (item: WishlistItem) => void;
}

export function WishlistScreen({ items, onBack, onAddNew, onOpenItem }: Props) {
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 420);
    return () => clearTimeout(t);
  }, []);

  const filtered =
    filtro === "todos" ? items : items.filter((i) => i.estado === filtro);

  return (
    <div className="pb-4">
      <ScreenHeader
        title="Desejos"
        onBack={onBack}
        action={
          <button
            onClick={onAddNew}
            aria-label="Novo desejo"
            className="flex items-center justify-center rounded-full shrink-0 transition-opacity active:opacity-70"
            style={{ width: 40, height: 40, background: "var(--accent)" }}
          >
            <Plus size={18} color="#fff" />
          </button>
        }
      />

      <FilterChips
        options={FILTROS}
        value={filtro}
        onChange={setFiltro}
        className="mb-4"
      />

      {loading ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <p
          className="text-sm text-center py-12"
          style={{ color: "var(--text-muted)" }}
        >
          Nenhum desejo aqui ainda. Toque no + para adicionar.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              onClick={() => onOpenItem(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
