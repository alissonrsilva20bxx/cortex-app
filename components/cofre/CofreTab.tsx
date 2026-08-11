"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Image,
  File,
  ExternalLink,
  ShieldCheck,
  Shield,
  Search,
  Lock,
  Folder,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { FilterChips } from "@/components/ui/FilterChips";
import { GlassCard } from "@/components/ui/GlassCard";

type Categoria =
  | "todos"
  | "comprovantes"
  | "conversas"
  | "documentos"
  | "pessoal";

const CATS: { id: Categoria; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "comprovantes", label: "Comprovantes" },
  { id: "conversas", label: "Conversas" },
  { id: "documentos", label: "Documentos" },
  { id: "pessoal", label: "Pessoal" },
];

// Cor de identidade por categoria, como tripla RGB para compor rgb(... / a)
// sem hex hard-coded (mata a deriva de cor da auditoria).
const CAT_RGB: Record<string, string> = {
  comprovantes: "var(--success-rgb)",
  conversas: "var(--info-rgb)",
  documentos: "var(--accent-rgb)",
  pessoal: "192 132 252",
};
const catRgb = (cat: string) => CAT_RGB[cat] ?? "var(--accent-rgb)";

/**
 * Superfície sólida (sem blur), mesmo padrão já estabelecido em Início
 * (T2), Agenda (T3) e Financeiro (T4): "conteúdo sólido, vidro só pra
 * navegação/sheets". Repetido aqui (não extraído pra `components/ui/`)
 * porque o escopo deste ticket é só os arquivos de `components/cofre/`.
 */
const SOLID_SURFACE_STYLE = {
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  background: "color-mix(in srgb, var(--surface) 92%, var(--bg))",
  border: "1px solid var(--border-color)",
  boxShadow:
    "inset 0 1px 0 rgb(255 255 255 / 0.035), 0 10px 30px rgb(0 0 0 / 0.18)",
} as const;

/**
 * Título de seção — 13px/semibold/-0.035em, cor plena, mesmo tratamento
 * já usado pros títulos de card de Início/Agenda/Financeiro (não
 * `.section-label`, o eyebrow uppercase cuja causa-raiz foi corrigida em
 * T2). "Arquivos recentes" encabeça seu próprio `GlassCard`, mesma
 * proeminência de "Metas Financeiras"/"Objetivos" no Financeiro/Início.
 */
const sectionTitleStyle = {
  fontSize: "13px",
  letterSpacing: "-0.035em",
  color: "var(--text)",
} as const;

interface CofreFile {
  name: string;
  path: string;
  categoria: string;
  size: number;
  createdAt: string;
  mimeType?: string;
}

function FileIcon({ mime }: { mime?: string }) {
  const style = { color: "var(--accent)" };
  if (mime?.startsWith("image/"))
    return <Image size={18} style={style} aria-hidden="true" />;
  if (mime?.includes("pdf") || mime?.includes("document"))
    return <FileText size={18} style={style} aria-hidden="true" />;
  return <File size={18} style={style} aria-hidden="true" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });

interface Props {
  userId: string;
  refreshTrigger: number;
}

export function CofreTab({ userId, refreshTrigger }: Props) {
  const [files, setFiles] = useState<CofreFile[]>([]);
  const [filter, setFilter] = useState<Categoria>("todos");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const cats = ["comprovantes", "conversas", "documentos", "pessoal"];
    Promise.all(
      cats.map((cat) =>
        supabase.storage
          .from("cofre")
          .list(`${userId}/${cat}`, {
            sortBy: { column: "created_at", order: "desc" },
          })
          .then(({ data }) =>
            (data ?? []).map((f) => ({
              name: f.name,
              path: `${userId}/${cat}/${f.name}`,
              categoria: cat,
              size: f.metadata?.size ?? 0,
              createdAt:
                f.created_at ?? f.updated_at ?? new Date().toISOString(),
              mimeType: f.metadata?.mimetype,
            }))
          )
      )
    ).then((results) => {
      const all = results
        .flat()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      setFiles(all);
      setLoading(false);
    });
  }, [userId, refreshTrigger]);

  /**
   * Privacidade ao perder foco (T5 — relatório de paridade §6/§7): a
   * trava do app já re-trava via PIN ~30s depois de voltar de segundo
   * plano (`app/page.tsx`) — mas o snapshot do app-switcher do sistema
   * operacional é tirado no INSTANTE em que o app sai de foco, antes
   * desse temporizador existir. Este cover local esconde o conteúdo do
   * Cofre imediatamente ao perder foco/ficar oculto
   * (visibilitychange→hidden, pagehide, blur da janela) e some assim
   * que o foco volta (visibilitychange→visible, focus da janela) — sem
   * inventar uma trava mais rígida que a já definida em `app/page.tsx`:
   * se a ausência ultrapassar os ~30s, é a trava do PIN que assume (o
   * `CofreTab` nem chega a remontar até o PIN ser digitado de novo,
   * porque `app/page.tsx` retorna só a `PinScreen` enquanto `locked`).
   * Sem loop: cada evento liga/desliga um único booleano, sem
   * temporizadores encadeados.
   *
   * Biometria (relatório §7): nada disso usa Face ID/Touch ID — não
   * existe nenhuma API biométrica implementada hoje, nem web/PWA nem
   * nativa. A trava de hoje é só PIN (`app/page.tsx`) + este cover de
   * privacidade (CSS/JS puro, sem sensor nenhum). Face ID/Touch ID de
   * verdade (via `LocalAuthentication` do iOS) só é alcançável com um
   * wrapper nativo publicado na App Store (Capacitor/React Native/
   * Swift) — não implementado; é integração futura do aplicativo iOS,
   * fora do escopo deste ticket. Nenhum ícone ou texto de biometria é
   * mostrado nesta tela até essa integração existir de verdade.
   */
  const [privacyCover, setPrivacyCover] = useState(false);

  useEffect(() => {
    function cover() {
      setPrivacyCover(true);
    }
    function uncover() {
      setPrivacyCover(false);
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") cover();
      else uncover();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("pagehide", cover);
    window.addEventListener("blur", cover);
    window.addEventListener("focus", uncover);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("pagehide", cover);
      window.removeEventListener("blur", cover);
      window.removeEventListener("focus", uncover);
    };
  }, []);

  async function openFile(path: string) {
    const { data } = await supabase.storage
      .from("cofre")
      .createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  const filtered = files
    .filter((f) => filter === "todos" || f.categoria === filter)
    .filter((f) =>
      query.trim()
        ? f.name.toLowerCase().includes(query.trim().toLowerCase())
        : true
    );

  const emptyMessage = query.trim()
    ? `Nenhum arquivo encontrado para "${query.trim()}".`
    : filter === "todos"
      ? "Cofre vazio. Toque no + para enviar."
      : `Nenhum arquivo em "${CATS.find((c) => c.id === filter)?.label}".`;

  return (
    <div className="pb-4">
      {/* Cover de privacidade — ver comentário acima do efeito que o
          controla. Cobre a tela inteira (não só a lista) porque o
          objetivo é impedir que o snapshot do app-switcher do sistema
          capture qualquer coisa sensível, inclusive o que estiver atrás
          (FAB, bottom nav, sheet de upload aberto). */}
      {privacyCover && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center gap-3"
          style={{ zIndex: 90, background: "var(--body-bg)" }}
        >
          <ShieldCheck size={28} style={{ color: "var(--accent)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Cofre protegido
          </p>
        </div>
      )}

      {/* Cabeçalho — "Cofre", 22px/semibold/-0.055em + ícone de escudo à
          direita, literal do laboratório (ScreenTitle,
          LaunchScreens.tsx:316-318/677-704). Ícone decorativo (sem
          onClick no laboratório também). */}
      <div className="flex h-10 items-center justify-between mb-1">
        <h1
          className="font-semibold"
          style={{
            fontSize: "22px",
            letterSpacing: "-0.055em",
            color: "var(--text)",
          }}
        >
          Cofre
        </h1>
        <div className="flex items-center gap-3" style={{ color: "var(--text-2)" }}>
          <Shield size={18} />
        </div>
      </div>

      {/* Postura honesta (§5.3): proteção real, sem prometer o que não faz. */}
      <div className="flex items-start gap-2 mb-4">
        <Lock
          size={11}
          className="shrink-0 mt-0.5"
          style={{ color: "var(--text-muted)" }}
        />
        <p
          className="text-[11px] leading-snug"
          style={{ color: "var(--text-muted)" }}
        >
          Só você acessa seus arquivos: guardados na sua conta, protegidos pela
          trava do app.
        </p>
      </div>

      {/* Busca — literal do laboratório (VaultScreen, LaunchScreens.tsx:353-361).
          Filtro client-side sobre o array `files` já buscado, sem
          chamada de rede nova por tecla digitada. */}
      <GlassCard
        radius="md"
        className="flex items-center gap-3 px-3"
        style={{ height: "44px", ...SOLID_SURFACE_STYLE }}
      >
        <Search size={16} style={{ color: "var(--text-muted)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar arquivos"
          className="w-full bg-transparent text-sm outline-none"
          style={{ color: "var(--text)" }}
        />
      </GlassCard>

      {/* Filter chips — 44px de alvo de toque (achado P1-6; ver
          components/ui/FilterChips.tsx). */}
      <FilterChips
        className="mt-3"
        options={CATS}
        value={filter}
        onChange={setFilter}
        minTouchTarget
      />

      {/* Resumo do armazenamento — números 100% reais (contagem e soma
          de bytes de `files`, já buscados). Sem porcentagem/barra de
          progresso: não existe cota real de armazenamento no backend
          (relatório de paridade §4/P0-1/P0-2), então "% de uso" seria
          inventado. Sem o aviso de que o dado é só uma prévia/estimativa
          (o laboratório tinha um, porque os números dele eram
          propositalmente fictícios) — aqui o dado é real, não precisa
          do aviso. Só aparece quando há
          pelo menos 1 arquivo — com o cofre vazio, o card ficaria
          redundante em cima da mensagem de estado vazio abaixo. */}
      {!loading && files.length > 0 && (
        <GlassCard radius="md" className="mt-4 p-4" style={SOLID_SURFACE_STYLE}>
          <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Resumo do armazenamento
          </p>
          <div className="mt-3 flex items-center gap-4">
            <div
              className="grid place-items-center rounded-full shrink-0"
              style={{
                width: "48px",
                height: "48px",
                background: "rgb(var(--accent-rgb) / 0.12)",
              }}
            >
              <Folder size={22} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <strong
                className="font-medium tabular-nums"
                style={{ fontSize: "20px", color: "var(--text)" }}
              >
                {files.length}
              </strong>
              <p style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                {files.length === 1 ? "arquivo" : "arquivos"}
              </p>
            </div>
            <div
              style={{ height: "40px", borderLeft: "1px solid var(--border-color)" }}
            />
            <div>
              <strong
                className="font-medium tabular-nums"
                style={{ fontSize: "18px", color: "var(--text)" }}
              >
                {formatSize(totalBytes)}
              </strong>
              <p style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                no total
              </p>
            </div>
          </div>
          <div
            className="mt-3 flex items-center gap-2 pt-3"
            style={{
              borderTop: "1px solid var(--border-color)",
              fontSize: "10px",
              color: "var(--text-muted)",
            }}
          >
            <Lock size={11} />
            Acesso protegido pela conta e trava do app
          </div>
        </GlassCard>
      )}

      {/* Lista — "Arquivos recentes" literal do laboratório. */}
      <h2 className="font-semibold mt-4" style={sectionTitleStyle}>
        Arquivos recentes
      </h2>
      <GlassCard
        radius="md"
        className="mt-2 overflow-hidden p-0"
        style={SOLID_SURFACE_STYLE}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent)" }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <p
            className="text-sm text-center py-12 px-4"
            style={{ color: "var(--text-muted)" }}
          >
            {emptyMessage}
          </p>
        ) : (
          filtered.map((f, i) => (
            <button
              key={f.path}
              onClick={() => openFile(f.path)}
              className="grid w-full grid-cols-[38px_1fr_16px] items-center gap-3 px-3 text-left transition-all active:opacity-70"
              style={{
                minHeight: "44px",
                paddingTop: "10px",
                paddingBottom: "10px",
                borderTop: i ? "1px solid var(--border-color)" : "none",
              }}
            >
              <div
                className="grid place-items-center rounded-lg shrink-0"
                style={{ width: "36px", height: "36px", background: "var(--surface-2)" }}
              >
                <FileIcon mime={f.mimeType} />
              </div>

              <div className="min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: "var(--text)" }}
                >
                  {f.name}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="text-[10px] font-bold px-1.5 py-px rounded-full"
                    style={{
                      background: `rgb(${catRgb(f.categoria)} / 0.1)`,
                      color: `rgb(${catRgb(f.categoria)})`,
                      border: `1px solid rgb(${catRgb(f.categoria)} / 0.2)`,
                    }}
                  >
                    {CATS.find((c) => c.id === f.categoria)?.label}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatSize(f.size)} · {formatDate(f.createdAt)}
                  </span>
                </div>
              </div>

              <ExternalLink
                size={14}
                className="shrink-0"
                style={{ color: "var(--text-muted)" }}
              />
            </button>
          ))
        )}
      </GlassCard>
    </div>
  );
}
