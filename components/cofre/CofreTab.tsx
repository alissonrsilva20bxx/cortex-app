"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Image,
  File,
  ExternalLink,
  Shield,
  Search,
  Lock,
  Folder,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { FilterChips } from "@/components/ui/FilterChips";
import { GlassCard } from "@/components/ui/GlassCard";
import { PinScreen } from "@/components/pin/PinScreen";

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
  /** Hash do PIN real do app (`app/page.tsx`), ou `null` se a usuária
   * nunca configurou um — mesma fonte que `PinScreen` já usa, nenhum PIN
   * paralelo. Só existe pra alimentar o gate próprio do Cofre abaixo. */
  pinHash: string | null;
  /** Se a aba Cofre é a aba selecionada agora (`activeTab === "cofre"`
   * no componente pai). Sair da aba invalida o desbloqueio do Cofre —
   * ver o efeito logo abaixo. */
  active: boolean;
}

export function CofreTab({ userId, refreshTrigger, pinHash, active }: Props) {
  const [files, setFiles] = useState<CofreFile[]>([]);
  const [filter, setFilter] = useState<Categoria>("todos");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  /**
   * Gate próprio do Cofre — corrige o defeito confirmado manualmente:
   * com o app já destravado (sessão autenticada, ou dentro da janela de
   * 30s de graça da trava do app em `app/page.tsx`), o Cofre sempre
   * renderizou seu conteúdo completo assim que montado, sem nenhuma
   * verificação própria — a autorização da SESSÃO do app nunca deveria
   * ter sido suficiente pra abrir a tela mais sensível do app. `unlocked`
   * é um estado 100% independente do `locked` do app: começa `false`
   * (Cofre sempre entra bloqueado), e só vira `true` via `PinScreen` —
   * o mesmo componente e o mesmo `verifyPin`/`lib/pin` que a trava do
   * app já usa, sem PIN paralelo/mockado/hardcoded.
   *
   * Reseta pra `false` (re-bloqueia) em dois casos, cada um cobrindo um
   * requisito distinto do achado:
   * — a aba deixa de ser a ativa (`!active`): sair do Cofre invalida o
   *   desbloqueio, mesmo sem nenhum backgrounding real ter acontecido.
   * — `visibilitychange`→hidden, `pagehide`, `blur` da janela: perder
   *   foco cobre o conteúdo IMEDIATAMENTE e exige PIN de novo ao
   *   voltar — sem período de graça (mais estrito que os ~30s da trava
   *   do app; deliberado, só pro Cofre). Por isso não há um handler de
   *   "focus"/"visible" que desbloqueie de volta: só o PIN correto
   *   desbloqueia.
   *
   * Enquanto `pinHash` existir e `unlocked` for `false`, a função
   * retorna só `<PinScreen>` — nada de busca, filtro, resumo ou lista é
   * renderizado, e o efeito de busca de arquivos abaixo também fica
   * pausado (não busca metadado sensível pra memória antes da
   * validação). Sem PIN configurado (`pinHash` nulo), o Cofre abre
   * direto — mesmo comportamento que o resto do app já tem hoje.
   */
  const [unlocked, setUnlocked] = useState(false);

  /**
   * Portal pro `<body>` — corrige o salto visual confirmado manualmente.
   * Causa raiz: `TabPanel` (componente compartilhado, fora do escopo
   * deste ticket) envolve TODO conteúdo de aba num `<div
   * className="animate-fade-up">`, que roda a keyframe `fade-up`
   * (`transform: translateY(8px) → translateY(0)`, 0.4s). Por spec CSS,
   * um ancestral com `transform` diferente de `none` — mesmo só durante
   * uma animação — vira o containing block de qualquer descendente
   * `position: fixed`. `PinScreen` é `fixed inset-0`; sem o portal, ele
   * herdava esse containing block por 0.4s (posicionado relativo ao
   * `TabPanel` animando dentro do `main` rolado/com padding, não ao
   * viewport) — daí o salto: primeiro aparecia deslocado, e só
   * "recentralizava" quando a animação terminava e o ancestral perdia o
   * `transform`. Isso nunca afetou a trava de nível de app
   * (`app/page.tsx`) porque aquela substitui a árvore inteira, sem
   * nenhum ancestral `.animate-fade-up` no caminho — é uma regressão
   * nova, específica de renderizar um `fixed` dentro do `TabPanel`.
   *
   * `createPortal` desanexa o `PinScreen` da subárvore do `TabPanel`
   * inteiramente, renderizando direto em `document.body` — sem ancestral
   * animado, sem containing block acidental, centralizado desde o
   * primeiro frame, sem depender de a animação terminar. `mounted` só
   * existe pra evitar chamar `document.body` durante SSR (Next.js
   * renderiza este componente no servidor antes de hidratar) — não é um
   * temporizador nem esconde o problema, é a forma padrão de portal
   * seguro no React/Next.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!active) {
      setUnlocked(false);
      setFiles([]);
    }
  }, [active]);

  useEffect(() => {
    function lock() {
      setUnlocked(false);
      setFiles([]);
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") lock();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("pagehide", lock);
    window.addEventListener("blur", lock);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("pagehide", lock);
      window.removeEventListener("blur", lock);
    };
  }, []);

  /**
   * Biometria (relatório de paridade §7): nada disso usa Face ID/Touch
   * ID — não existe nenhuma API biométrica implementada hoje, nem
   * web/PWA nem nativa. A trava de hoje é só PIN (`PinScreen`/
   * `lib/pin`, real, reaproveitado acima). Face ID/Touch ID de verdade
   * (via `LocalAuthentication` do iOS) só é alcançável com um wrapper
   * nativo publicado na App Store (Capacitor/React Native/Swift) — não
   * implementado; é integração futura do aplicativo iOS, fora do
   * escopo deste ticket. Nenhum ícone ou texto de biometria é mostrado
   * nesta tela até essa integração existir de verdade.
   */

  const authorized = !pinHash || unlocked;

  useEffect(() => {
    if (!authorized) return;
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
  }, [userId, refreshTrigger, authorized]);

  if (pinHash && !unlocked) {
    if (!mounted) return null;
    return createPortal(
      <PinScreen pinHash={pinHash} onUnlock={() => setUnlocked(true)} />,
      document.body
    );
  }

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
          {pinHash
            ? "Só você acessa seus arquivos: guardados na sua conta, PIN pedido toda vez que você entra no Cofre."
            : "Só você acessa seus arquivos: guardados na sua conta, protegidos pela trava do app."}
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
