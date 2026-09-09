"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FilterChips } from "@/components/ui/FilterChips";
import { Avatar } from "./Avatar";
import {
  CATEGORIA_META,
  MAX_FOTOS_POR_POST,
  type Categoria,
} from "@/lib/rede/feed";

interface EditingPost {
  id: string;
  categoria: Categoria;
  texto: string;
}

interface Props {
  open: boolean;
  usuarioNome: string;
  usuarioFotoUrl: string | null;
  /** Presente = editando essa publicação em vez de criar uma nova. */
  editingPost?: EditingPost | null;
  onClose: () => void;
  onPublish: (data: {
    texto: string;
    categoria: Categoria;
    fotos?: File[];
  }) => void;
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
  usuarioFotoUrl,
  editingPost,
  onClose,
  onPublish,
  onSaveEdit,
}: Props) {
  const [texto, setTexto] = useState("");
  // "geral" é a opção neutra (migration 0025) -- quem não quer classificar
  // a publicação numa das outras 4 categorias simplesmente não mexe aqui.
  const [categoria, setCategoria] = useState<Categoria>("geral");
  // Fotos só na criação (migration 0028 escopa fotos por post_id, que só
  // existe depois do post criado) -- editar uma publicação existente
  // continua texto/categoria apenas, mesmo comportamento de antes.
  const [fotos, setFotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editingPost) {
      setTexto(editingPost.texto);
      setCategoria(editingPost.categoria);
    }
  }, [open, editingPost]);

  // object URLs de preview só existem no cliente e precisam ser liberadas
  // explicitamente -- sem isso, cada foto trocada vaza memória até a aba
  // fechar.
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  function reset() {
    setTexto("");
    setCategoria("geral");
    previews.forEach((url) => URL.revokeObjectURL(url));
    setFotos([]);
    setPreviews([]);
  }

  function addFotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const espacoLivre = MAX_FOTOS_POR_POST - fotos.length;
    if (espacoLivre <= 0) return;
    const novos = Array.from(files).slice(0, espacoLivre);
    setFotos((prev) => [...prev, ...novos]);
    setPreviews((prev) => [
      ...prev,
      ...novos.map((f) => URL.createObjectURL(f)),
    ]);
  }

  function removeFoto(index: number) {
    URL.revokeObjectURL(previews[index]);
    setFotos((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function handlePublish() {
    if (!texto.trim()) return;
    if (editingPost) {
      onSaveEdit(editingPost.id, { texto: texto.trim(), categoria });
    } else {
      onPublish({
        texto: texto.trim(),
        categoria,
        fotos: fotos.length > 0 ? fotos : undefined,
      });
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
      largeCloseTarget
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
          <Avatar nome={usuarioNome} fotoUrl={usuarioFotoUrl} size="md" />
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
            minTouchTarget
          />
        </div>

        {!editingPost && (
          <div>
            <p className="section-label mb-2">Fotos (opcional)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                addFotos(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="flex gap-2">
              {previews.map((url, i) => (
                <div
                  key={url}
                  className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0"
                  style={{ border: "1px solid var(--border-color)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview de blob local, next/image não aceita object URL */}
                  <img
                    src={url}
                    alt={`Foto ${i + 1} selecionada`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeFoto(i)}
                    aria-label={`Remover foto ${i + 1}`}
                    className="absolute top-1 right-1 flex items-center justify-center rounded-full"
                    style={{
                      width: 22,
                      height: 22,
                      background: "rgba(0,0,0,0.6)",
                      color: "white",
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              {fotos.length < MAX_FOTOS_POR_POST && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Adicionar foto"
                  className="w-20 h-20 rounded-xl flex items-center justify-center shrink-0 transition-opacity active:opacity-70"
                  style={{
                    background: "var(--surface)",
                    border: "1px dashed var(--border-color)",
                  }}
                >
                  <ImagePlus size={20} style={{ color: "var(--text-muted)" }} />
                </button>
              )}
            </div>
          </div>
        )}

        {!editingPost && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            A Rede mantém só as 300 publicações mais recentes da comunidade —
            passado esse número, as mais antigas (texto e fotos) são removidas
            automaticamente.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
