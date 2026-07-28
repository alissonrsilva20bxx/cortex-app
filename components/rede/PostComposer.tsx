"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Gift, Link2, EyeOff } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FilterChips } from "@/components/ui/FilterChips";
import { useToast } from "@/components/Toast";
import { Avatar } from "./Avatar";
import {
  CATEGORIA_META,
  type PostCategoria,
  type PostTipo,
  type RedePost,
} from "@/lib/mockRede";

interface Props {
  open: boolean;
  usuarioNome: string;
  tipoInicial?: PostTipo;
  /** Presente = editando essa publicação em vez de criar uma nova. */
  editingPost?: RedePost | null;
  onClose: () => void;
  onPublish: (data: {
    texto: string;
    tipo: PostTipo;
    categoria: PostCategoria;
    anonimo: boolean;
  }) => void;
  onSaveEdit: (
    postId: string,
    data: {
      texto: string;
      tipo: PostTipo;
      categoria: PostCategoria;
      anonimo: boolean;
    }
  ) => void;
}

const CATEGORIA_OPTIONS = (Object.keys(CATEGORIA_META) as PostCategoria[]).map(
  (id) => ({ id, label: CATEGORIA_META[id].label })
);

const ATTACH_OPTIONS: {
  id: PostTipo;
  label: string;
  Icon: typeof ImageIcon;
}[] = [
  { id: "foto", label: "Foto", Icon: ImageIcon },
  { id: "desejo", label: "Desejo", Icon: Gift },
  { id: "link", label: "Link", Icon: Link2 },
];

export function PostComposer({
  open,
  usuarioNome,
  tipoInicial,
  editingPost,
  onClose,
  onPublish,
  onSaveEdit,
}: Props) {
  const toast = useToast();
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<PostTipo>("texto");
  const [categoria, setCategoria] = useState<PostCategoria>("dica");
  const [anonimo, setAnonimo] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingPost) {
      setTexto(editingPost.texto);
      setTipo(editingPost.tipo);
      setCategoria(editingPost.categoria);
      setAnonimo(editingPost.anonimo);
    } else {
      setTipo(tipoInicial ?? "texto");
    }
  }, [open, tipoInicial, editingPost]);

  function reset() {
    setTexto("");
    setTipo("texto");
    setCategoria("dica");
    setAnonimo(false);
  }

  function handlePublish() {
    if (!texto.trim()) return;
    if (anonimo && tipo !== "texto") {
      toast.error("Anexos não ficam disponíveis em publicações anônimas.");
      return;
    }
    if (editingPost) {
      onSaveEdit(editingPost.id, {
        texto: texto.trim(),
        tipo,
        categoria,
        anonimo,
      });
    } else {
      onPublish({ texto: texto.trim(), tipo, categoria, anonimo });
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
          <Avatar
            nome={anonimo ? "Anônima" : usuarioNome}
            anonimo={anonimo}
            size="md"
          />
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

        {/* Anexos rápidos */}
        <div className="flex items-center gap-2">
          {ATTACH_OPTIONS.map(({ id, label, Icon }) => {
            const active = tipo === id;
            return (
              <button
                key={id}
                onClick={() => setTipo(active ? "texto" : id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: active
                    ? "rgb(var(--accent-rgb) / 0.16)"
                    : "var(--surface)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                  color: active ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
          <button
            onClick={() => setAnonimo((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ml-auto"
            style={{
              background: anonimo
                ? "rgb(var(--accent-rgb) / 0.16)"
                : "var(--surface)",
              border: `1px solid ${anonimo ? "var(--accent)" : "var(--border-color)"}`,
              color: anonimo ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            <EyeOff size={14} />
            Anônima
          </button>
        </div>

        {/* Categoria */}
        <div>
          <p className="section-label mb-2">Categoria</p>
          <FilterChips
            options={CATEGORIA_OPTIONS}
            value={categoria}
            onChange={setCategoria}
          />
        </div>

        {tipo !== "texto" && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {tipo === "foto" && "Uma foto ilustrativa será anexada (mockup)."}
            {tipo === "desejo" &&
              "Vincula um item da sua Wishlist a esta publicação (mockup)."}
            {tipo === "link" && "Um link de exemplo será anexado (mockup)."}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
