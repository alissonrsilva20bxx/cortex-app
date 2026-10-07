"use client";

import type { ReactNode } from "react";
import { File, FileText } from "lucide-react";
import { IconeArquivoImagem, IconeSeta } from "./cofreIcones";
import type { CofreFile } from "@/lib/cofre/cofreCache";
import { formatDataArquivo, formatTamanho } from "./cofreResumo";

/** Âncora da seção "Todos os arquivos", alvo do "Ver tudo ›" de "Recentes". */
export const TODOS_OS_ARQUIVOS_ID = "cofre-todos-os-arquivos";

const SECTION_TITLE_STYLE = {
  fontSize: "15px",
  fontWeight: 800,
  color: "var(--text)",
} as const;

const LIST_STYLE = {
  background: "var(--card-solid)",
  borderRadius: "20px",
  padding: "4px 16px",
} as const;

function FileIcon({ mime }: { mime?: string }) {
  if (mime?.startsWith("image/")) return <IconeArquivoImagem size={20} />;
  if (mime?.includes("pdf") || mime?.includes("document"))
    return <FileText size={18} aria-hidden="true" />;
  return <File size={18} aria-hidden="true" />;
}

interface ListaProps {
  files: CofreFile[];
  /** Abre o arquivo pela URL assinada de 120s (`openFile` do CofreTab). */
  onOpen: (path: string) => void;
  /** Rótulo real da categoria, vindo de `CATS` no CofreTab. */
  rotuloCategoria: (categoria: string) => string;
  /** Tripla RGB da cor de identidade da categoria (`catRgb` do CofreTab). */
  corCategoria: (categoria: string) => { tinta: string; fundo: string };
}

/**
 * Linhas de arquivo (J05): ícone na cor da categoria, nome, e embaixo
 * `<categoria> · <tamanho> · <data>`, seta à direita, como o mockup.
 * Tocar abre o arquivo pelo mesmo `openFile` de antes (URL assinada
 * gerada na hora, nunca do cache).
 */
export function ListaArquivos({
  files,
  onOpen,
  rotuloCategoria,
  corCategoria,
}: ListaProps) {
  return (
    <div style={LIST_STYLE}>
      {files.map((f, i) => {
        const cor = corCategoria(f.categoria);
        return (
          <button
            key={f.path}
            type="button"
            onClick={() => onOpen(f.path)}
            className="flex w-full items-center text-left active:opacity-70"
            style={{
              gap: "12px",
              padding: "12px 0",
              minHeight: "44px",
              borderBottom:
                i === files.length - 1 ? "none" : "1px solid var(--divider)",
            }}
          >
            <span
              className="flex shrink-0 items-center justify-center"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: cor.fundo,
                color: cor.tinta,
              }}
            >
              <FileIcon mime={f.mimeType} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block truncate"
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--text)",
                }}
              >
                {f.name}
              </span>
              <span
                className="block truncate"
                style={{ fontSize: "11px", color: "var(--text-muted)" }}
              >
                {rotuloCategoria(f.categoria)} · {formatTamanho(f.size)} ·{" "}
                {formatDataArquivo(f.createdAt)}
              </span>
            </span>
            <IconeSeta
              size={16}
              className="shrink-0"
              style={{ color: "var(--text-muted)" }}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Seção com título (J05). "Recentes" leva o atalho "Ver tudo ›", que é um
 * link de âncora pra seção "Todos os arquivos" logo abaixo, na mesma tela:
 * não abre nada novo, só leva até a lista completa que já está ali.
 */
export function SecaoCofre({
  titulo,
  id,
  verTudo = false,
  children,
}: {
  titulo: "Recentes" | "Todos os arquivos";
  id?: string;
  verTudo?: boolean;
  children: ReactNode;
}) {
  return (
    // 16px entre o título e a lista: na referência os dois são irmãos da
    // coluna da tela, que tem `gap: 16px`.
    <section id={id} className="flex flex-col" style={{ gap: "16px" }}>
      <div className="flex items-center justify-between">
        <h2 style={SECTION_TITLE_STYLE}>{titulo}</h2>
        {verTudo && (
          <a
            href={`#${TODOS_OS_ARQUIVOS_ID}`}
            className="flex items-center active:opacity-70"
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--accent-deep)",
              // Alvo de toque de 44px sem crescer a linha: a margem negativa
              // devolve a altura de 18px que a referência desenha. Com os 44
              // ocupando espaço de verdade, o `items-center` empurrava o
              // título "Recentes" 10,8px para baixo e a lista inteira 17,5px
              // junto. Mesma receita do #198/#204.
              minHeight: "44px",
              margin: "-13px 0",
            }}
          >
            Ver tudo ›
          </a>
        )}
      </div>
      {children}
    </section>
  );
}
