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
  type FotoParaUpload,
} from "@/lib/rede/feed";
import {
  processarFotoParaPost,
  FotoInvalidaError,
} from "@/lib/rede/imagemComposer";

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
    fotos?: FotoParaUpload[];
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
  // Fotos só na criação (o path de Storage exige post_id, que só existe
  // depois do post criado) -- editar uma publicação existente continua
  // texto/categoria apenas, mesmo comportamento de antes.
  // As fotos já viajam PROCESSADAS (principal + miniatura JPEG, sem EXIF)
  // -- ver `processarFotoParaPost`. O preview mostra a principal final.
  const [fotos, setFotos] = useState<FotoParaUpload[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [processandoFoto, setProcessandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
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
    setErroFoto(null);
    setProcessandoFoto(false);
  }

  async function addFotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const espacoLivre = MAX_FOTOS_POR_POST - fotos.length;
    if (espacoLivre <= 0) return;
    const escolhidos = Array.from(files).slice(0, espacoLivre);
    setErroFoto(null);
    setProcessandoFoto(true);
    try {
      for (const file of escolhidos) {
        // processa uma por vez: resize <=1280px, JPEG <=150KB, miniatura
        // <=400px/<=30KB, sem EXIF/GPS. Se não couber, REJEITA (não
        // publica o original).
        const proc = await processarFotoParaPost(file);
        const preview = URL.createObjectURL(proc.principal);
        setFotos((prev) => [
          ...prev,
          {
            principal: proc.principal,
            miniatura: proc.miniatura,
            largura: proc.largura,
            altura: proc.altura,
          },
        ]);
        setPreviews((prev) => [...prev, preview]);
      }
    } catch (e) {
      setErroFoto(
        e instanceof FotoInvalidaError
          ? `Não foi possível usar essa imagem: ${e.message}`
          : "Não foi possível processar essa imagem. Tente outra."
      );
    } finally {
      setProcessandoFoto(false);
    }
  }

  function removeFoto(index: number) {
    URL.revokeObjectURL(previews[index]);
    setFotos((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setErroFoto(null);
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
          disabled={!texto.trim() || processandoFoto}
          className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {editingPost
            ? "Salvar alterações"
            : processandoFoto
              ? "Preparando foto…"
              : "Publicar"}
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
                  disabled={processandoFoto}
                  aria-label="Adicionar foto"
                  className="w-20 h-20 rounded-xl flex items-center justify-center shrink-0 transition-opacity active:opacity-70 disabled:opacity-50"
                  style={{
                    background: "var(--surface)",
                    border: "1px dashed var(--border-color)",
                  }}
                >
                  <ImagePlus size={20} style={{ color: "var(--text-muted)" }} />
                </button>
              )}
            </div>
            {processandoFoto && (
              <p
                className="text-xs mt-2"
                style={{ color: "var(--text-muted)" }}
              >
                Otimizando a imagem…
              </p>
            )}
            {erroFoto && (
              <p className="text-xs mt-2" style={{ color: "var(--danger)" }}>
                {erroFoto}
              </p>
            )}
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
