"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Clock } from "lucide-react";
import { ScreenHeader } from "./ScreenHeader";
import { Avatar } from "./Avatar";
import { SkeletonList } from "./Skeleton";
import { GlassCard } from "@/components/ui/GlassCard";
import { RECENT_SEARCHES } from "@/lib/mockRede";
import { CATEGORIA_META, type FeedPost } from "@/lib/rede/feed";
import type { PessoaResumo } from "@/lib/rede/perfis";

interface Props {
  posts: FeedPost[];
  onBack: () => void;
  onOpenAutor: (autorId: string) => void;
  onOpenPost: (post: FeedPost) => void;
  onSearchPessoas: (query: string) => Promise<PessoaResumo[]>;
}

export function SearchScreen({
  posts,
  onBack,
  onOpenAutor,
  onOpenPost,
  onSearchPessoas,
}: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [pessoas, setPessoas] = useState<PessoaResumo[]>([]);
  const q = query.trim().toLowerCase();

  useEffect(() => {
    if (q.length === 0) {
      setSearching(false);
      setPessoas([]);
      return;
    }
    let ativo = true;
    setSearching(true);
    const t = setTimeout(() => {
      onSearchPessoas(q)
        .then((data) => {
          if (!ativo) return;
          setPessoas(data);
          setSearching(false);
        })
        .catch(() => {
          if (!ativo) return;
          setPessoas([]);
          setSearching(false);
        });
    }, 380);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const assuntos = useMemo(
    () =>
      q.length === 0
        ? []
        : posts.filter(
            (p) =>
              p.texto.toLowerCase().includes(q) ||
              CATEGORIA_META[p.categoria].label.toLowerCase().includes(q)
          ),
    [q, posts]
  );

  return (
    <div className="pb-4">
      <ScreenHeader title="Buscar" onBack={onBack} />

      <div
        className="flex items-center gap-2.5 px-4 mb-5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-pill)",
          height: 44,
        }}
      >
        <Search size={16} style={{ color: "var(--text-muted)" }} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar pessoas ou assuntos…"
          className="flex-1 text-sm h-full"
          style={{ background: "transparent", color: "var(--text)" }}
        />
      </div>

      {q.length === 0 ? (
        <section>
          <p className="section-label mb-3">Buscas recentes</p>
          <div className="space-y-2">
            {RECENT_SEARCHES.map((term) => (
              <GlassCard
                key={term}
                radius="md"
                onClick={() => setQuery(term)}
                className="flex items-center gap-3 px-3.5 py-3"
              >
                <Clock size={15} style={{ color: "var(--text-muted)" }} />
                <span className="text-sm" style={{ color: "var(--text-2)" }}>
                  {term}
                </span>
              </GlassCard>
            ))}
          </div>
        </section>
      ) : searching ? (
        <SkeletonList rows={4} />
      ) : (
        <div className="space-y-6">
          {pessoas.length > 0 && (
            <section>
              <p className="section-label mb-3">Pessoas</p>
              <div className="space-y-2">
                {pessoas.map((u) => (
                  <GlassCard
                    key={u.id}
                    radius="md"
                    onClick={() => onOpenAutor(u.id)}
                    className="flex items-center gap-3 px-3.5 py-3"
                  >
                    <Avatar nome={u.nome} cor={u.cor} size="sm" />
                    <div className="min-w-0 text-left">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: "var(--text)" }}
                      >
                        {u.nome}
                      </p>
                      {u.bio && (
                        <p
                          className="text-xs truncate"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {u.bio}
                        </p>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </section>
          )}

          {assuntos.length > 0 && (
            <section>
              <p className="section-label mb-3">Assuntos</p>
              <div className="space-y-2">
                {assuntos.map((p) => (
                  <GlassCard
                    key={p.id}
                    radius="md"
                    onClick={() => onOpenPost(p)}
                    className="px-3.5 py-3"
                  >
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: `rgb(${CATEGORIA_META[p.categoria].rgb} / 0.12)`,
                        color: `rgb(${CATEGORIA_META[p.categoria].rgb})`,
                      }}
                    >
                      {CATEGORIA_META[p.categoria].label}
                    </span>
                    <p
                      className="text-sm mt-1.5 line-clamp-2 text-left"
                      style={{ color: "var(--text-2)" }}
                    >
                      {p.texto}
                    </p>
                  </GlassCard>
                ))}
              </div>
            </section>
          )}

          {pessoas.length === 0 && assuntos.length === 0 && (
            <p
              className="text-sm text-center py-12"
              style={{ color: "var(--text-muted)" }}
            >
              Nada encontrado para &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
