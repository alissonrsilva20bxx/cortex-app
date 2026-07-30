"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FilterChips } from "@/components/ui/FilterChips";
import { Avatar } from "./Avatar";
import { CATEGORIA_META, type Categoria } from "@/lib/rede/feed";

interface EditingPost {
  id: string;
  categoria: Categoria;
  texto: string;
}

interface Props {
  open: boolean;
  usuarioNome: string;
  /** Presente = editando essa publicação em vez de criar uma nova. */
  editingPost?: EditingPost | null;
  onClose: () => void;
  onPublish: (data: { texto: string; categoria: Categoria }) => void;
  onSaveEdit: (
    postId: string,
    data: { texto: string; categoria: Categoria }
  ) => void;
}

const CATEGORIA_OPTIONS = (Object.keys(CATEGORIA_META) as Categoria[]).map(
  (id) => ({ id, label: CATEGORIA_META[id].label })
);

export function PostComposer({
  open,
  usuarioNome,
  editingPost,
  onClose,
  onPublish,
  onSaveEdit,
}: Props) {
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("dica");

  useEffect(() => {
    if (!open) return;
    if (editingPost) {
      setTexto(editingPost.texto);
      setCategoria(editingPost.categoria);
    }
  }, [open, editingPost]);

  function reset() {
    setTexto("");
    setCategoria("dica");
  }

  function handlePublish() {
    if (!texto.trim()) return;
    if (editingPost) {
      onSaveEdit(editingPost.id, { texto: texto.trim(), categoria });
    } else {
      onPublish({ texto: texto.trim(), categoria });
    }
    reset();
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={editingPost ? "Editar publicação" : "Nova publicação"}
      footer={
        <button
          onClick={handlePublish}
          disabled={!texto.trim()}
          className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {editingPost ? "Salvar alterações" : "Publicar"}
        </button>
      }
    >
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-start gap-3">
          <Avatar nome={usuarioNome} size="md" />
          <textarea
            autoFocus
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Compartilhe algo…"
            className="flex-1 text-sm resize-none"
            style={{
              background: "transparent",
              color: "var(--text)",
              padding: "8px 0",
            }}
          />
        </div>

        <div>
          <p className="section-label mb-2">Categoria</p>
          <FilterChips
            options={CATEGORIA_OPTIONS}
            value={categoria}
            onChange={setCategoria}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
