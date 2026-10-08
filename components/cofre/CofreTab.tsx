"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import {
  IconeEscudo,
  IconeEnviar,
  IconeComprovante,
  IconeConversa,
  IconePasta,
  IconePessoa,
  IconeArquivoImagem,
} from "./cofreIcones";
import { BotaoRedondo, IconeCadeado } from "@/components/ui/cabecalho";
import { IconeBusca } from "@/components/jobs/agendaIcones";
import { supabase } from "@/lib/supabase";
import { FilterChips } from "@/components/ui/FilterChips";
import { GlassCard } from "@/components/ui/GlassCard";
import { PinScreen } from "@/components/pin/PinScreen";
import {
  computeGateState,
  nextUnlockedOnActiveChange,
  nextUnlockedOnLoseFocus,
} from "./lockGate";
import * as cofreCache from "@/lib/cofre/cofreCache";
import type { CofreFile } from "@/lib/cofre/cofreCache";
import {
  formatTamanho,
  recentes,
  totalUsado,
  ultimoEnvio,
} from "./cofreResumo";
import {
  ListaArquivos,
  SecaoCofre,
  TODOS_OS_ARQUIVOS_ID,
} from "./CofreArquivos";

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

/**
 * Cor de identidade por categoria. A referência usa um PAR de tokens por
 * categoria -- o tom cheio no ícone e o tom suave, SÓLIDO, no fundo do
 * quadradinho (`--t-green`/`--t-gsoft`, `--t-blue`/`--t-bsoft`,
 * `--t-purple`/`--t-psoft`). O app compunha o fundo com alfa sobre o tom
 * cheio, o que derivava do valor desenhado. Agora usa os pares semânticos
 * da fundação, que são os mesmos tokens.
 */
const CAT_COR: Record<string, { tinta: string; fundo: string }> = {
  comprovantes: { tinta: "var(--success)", fundo: "var(--success-tint)" },
  conversas: { tinta: "var(--info)", fundo: "var(--info-tint)" },
  documentos: { tinta: "var(--accent-deep)", fundo: "var(--accent-tint)" },
  pessoal: { tinta: "var(--violet)", fundo: "var(--violet-tint)" },
};
const catCor = (cat: string) =>
  CAT_COR[cat] ?? { tinta: "var(--accent-deep)", fundo: "var(--accent-tint)" };

/**
 * Fileira de ações do mockup (layout C): azulejos redondos de 56px com o
 * rótulo de 11px/600 embaixo, numa grade de 4 colunas com 8px de intervalo.
 * Substitui o botão "Enviar" de largura inteira e os chips de categoria.
 * A ordem das 4 primeiras é a do mockup; "Pessoal" e "Todos" existem só no
 * app (há dado real em Pessoal) e caem na segunda linha, com o mesmo
 * desenho -- nada deixa de ser alcançável.
 */
const AZULEJO = {
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  background: "var(--card-solid)",
  color: "var(--accent-deep)",
} as const;
const AZULEJO_ROTULO = { fontSize: "11px", fontWeight: 600 } as const;
const ICONE_CATEGORIA: Record<Categoria, (p: { size?: number }) => ReactNode> =
  {
    comprovantes: IconeComprovante,
    conversas: IconeConversa,
    documentos: IconePasta,
    pessoal: IconePessoa,
    // "Todos" não existe na referência: usa a miniatura de arquivo dela.
    todos: IconeArquivoImagem,
  };
/** A ordem do mockup primeiro; o que só existe no app vem depois. */
const ORDEM_AZULEJOS: Categoria[] = [
  "comprovantes",
  "conversas",
  "documentos",
  "pessoal",
  "todos",
];
const rotuloCategoria = (cat: string) =>
  CATS.find((c) => c.id === cat)?.label ?? cat;

/** Cada número da fileira do card "Protegido": valor grande em cima, rótulo embaixo. */
/**
 * Cada número da fileira do card "Protegido". A estrutura espelha a da
 * referência: uma caixa com padding, e dentro dela um bloco com o valor e
 * outro com o rótulo -- os dois herdando o line-height 1.5 da tela, como no
 * mockup. Antes era um <p> só com line-height 1.2, o que deixava a caixa
 * 8px mais baixa que a desenhada.
 */
const STAT_STYLE = {
  padding: "10px",
  borderRadius: "14px",
  background: "var(--hero-bg-2)",
} as const;
const STAT_VALOR_STYLE = { fontSize: "17px", fontWeight: 800 } as const;
const STAT_LABEL_STYLE = {
  fontSize: "10px",
  color: "var(--hero-text-muted)",
} as const;

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
  /** "Cancelar" no PIN do Cofre: volta pra aba de onde a pessoa veio. O
   * PinScreen cobre a tela inteira (inclusive a barra de abas), então sem
   * isto não havia como sair do Cofre sem digitar o PIN. */
  onExit?: () => void;
  /** Abre o UploadSheet da página (o mesmo do "+"), que fica fora da trava
   * do Cofre. Opcional: sem ele o botão "Enviar" fica desabilitado — ver o
   * comentário do botão. */
  onEnviar?: () => void;
}

export function CofreTab({
  userId,
  refreshTrigger,
  pinHash,
  active,
  onExit,
  onEnviar,
}: Props) {
  /**
   * Semente do cache SWR (`lib/cofre/cofreCache.ts`), síncrona, 1x por
   * conta -- mesmo padrão de `RedeTab` (`sementeRef`). Cobre o remount que
   * a trava de PIN do APP (`app/page.tsx`: `if (locked && pinHash) return
   * <PinScreen>`) causa na árvore inteira, incluindo este componente: sem
   * isso, `files`/`loading` nasceriam vazios/`true` de novo a cada
   * destrava do app, mesmo com os arquivos já vistos segundos antes ainda
   * vivos no cache do módulo. A trava PRÓPRIA do Cofre (`unlocked` abaixo)
   * não remonta este componente -- por isso não precisa desta semente de
   * novo a cada ciclo: `files` simplesmente nunca é apagado só por sair da
   * aba/perder foco (ver os dois efeitos logo abaixo), então o valor já em
   * estado sobrevive sozinho entre entradas.
   */
  const sementeRef = useRef<{
    userId: string;
    files: CofreFile[] | null;
  } | null>(null);
  if (sementeRef.current === null || sementeRef.current.userId !== userId) {
    cofreCache.vincularUsuario(userId);
    sementeRef.current = { userId, files: cofreCache.ler(userId) };
  }
  const semente = sementeRef.current;

  const [files, setFiles] = useState<CofreFile[]>(() => semente.files ?? []);
  const [filter, setFilter] = useState<Categoria>("todos");
  const [query, setQuery] = useState("");
  /** Campo de busca aberto pelo botão do cabeçalho (J05). */
  const [buscaAberta, setBuscaAberta] = useState(false);
  // Só nasce `true` em cache miss de verdade (semente nula) -- com cache,
  // o efeito abaixo vira revalidação em 2º plano, sem spinner.
  const [loading, setLoading] = useState(() => semente.files === null);
  /** Falhou a busca e não há nada em cache pra mostrar (1ª vez offline) --
   * a mensagem diz isso em vez de "Cofre vazio". */
  const [semConexao, setSemConexao] = useState(false);

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
   *
   * BUG confirmado manualmente depois da primeira versão desta correção:
   * o gate checava só `pinHash && !unlocked`, sem checar `active`. Como
   * `CofreTab` nunca desmonta de verdade (`TabPanel`, compartilhado, só
   * alterna `display:none`) e o `PinScreen` renderiza via portal em
   * `document.body` — fora do `display:none` do `TabPanel` —, ele
   * aparecia (ou o conteúdo liberava) em QUALQUER aba, não só no Cofre:
   * ao montar em segundo plano (Início ativo) já mostrava o portal por
   * cima de tudo; entrar nele com PIN já digitado ali (sem perceber que
   * não era a trava do app) deixava `unlocked=true` vazar pra quando o
   * Cofre virasse a aba ativa de verdade; e sair da aba fazia o portal
   * reaparecer "atrasado" sobre a aba nova. A decisão do que renderizar
   * agora vem inteira de `computeGateState` (`./lockGate.ts`, função
   * pura testada em `tests/wiring/cofre-lock-gate.test.ts`): `active`
   * decide primeiro — inativo é sempre `"hidden"` (nem PinScreen nem
   * conteúdo), só quando `active` é verdadeiro é que `pinHash`/
   * `unlocked` decidem entre `"locked"`/`"content"`.
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
    setUnlocked((prev) => nextUnlockedOnActiveChange(active, prev));
    // NÃO zera a lista de arquivos aqui (o bug original chamava o setter
    // de `files` com um array vazio nesta mesma linha) -- sair da aba
    // precisa só bloquear a INTERFACE (o gate acima já esconde tudo via
    // "hidden"), não destruir o conteúdo já carregado. `files` continua em
    // memória de componente (defesa adicional: o cache do módulo
    // `cofreCache` também guarda o mesmo dado) pra reaparecer na hora
    // quando a aba for reativada e o PIN for digitado de novo -- ver cache
    // SWR abaixo.
  }, [active]);

  useEffect(() => {
    function lock() {
      setUnlocked(nextUnlockedOnLoseFocus());
      // Idem acima: perder foco/visibilidade/pagehide precisa bloquear a
      // TELA imediatamente (já garantido pelo gate), sem exceção -- mas não
      // precisa destruir o cache da sessão. A lista de arquivos fica
      // intocada.
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

  const gateState = computeGateState({ active, pinHash, unlocked });

  /**
   * Busca dos arquivos -- cache SWR (`lib/cofre/cofreCache.ts`), mesma
   * experiência já adotada na Rede: com cache, mostra na hora e revalida
   * em silêncio; sem cache, mostra o carregamento como antes.
   *
   * `refreshTrigger` (bump do upload em `app/page.tsx`) cai neste mesmo
   * efeito -- como só liga `setLoading(true)` em cache miss, um upload não
   * joga a lista inteira de volta pro spinner: revalida em 2º plano e o
   * arquivo novo aparece quando a consulta terminar.
   */
  useEffect(() => {
    if (gateState !== "content") return;
    const ep = cofreCache.epocaAtual();
    const temCache = cofreCache.ler(userId) !== null;
    if (!temCache) setLoading(true);

    let ativo = true;
    const cats = ["comprovantes", "conversas", "documentos", "pessoal"];
    Promise.all(
      cats.map((cat) =>
        supabase.storage
          .from("cofre")
          .list(`${userId}/${cat}`, {
            sortBy: { column: "created_at", order: "desc" },
          })
          .then(({ data, error }) => {
            // Sem rede o storage devolve `{ error }` sem lançar -- tratar
            // como lista vazia gravava "Cofre vazio" por cima do cache.
            if (error) throw error;
            return (data ?? []).map((f) => ({
              name: f.name,
              path: `${userId}/${cat}/${f.name}`,
              categoria: cat,
              size: f.metadata?.size ?? 0,
              createdAt:
                f.created_at ?? f.updated_at ?? new Date().toISOString(),
              mimeType: f.metadata?.mimetype,
            }));
          })
      )
    )
      .then((results) => {
        // Resposta atrasada de uma conta anterior (troca de conta no meio
        // do voo) não pode contaminar a conta atual.
        if (!ativo || cofreCache.epocaAtual() !== ep) return;
        const all = results
          .flat()
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        cofreCache.escrever(userId, all, ep);
        setFiles(all);
        setLoading(false);
        setSemConexao(false);
      })
      .catch((e) => {
        if (!ativo || cofreCache.epocaAtual() !== ep) return;
        console.error("[CofreTab]", e);
        // Falha na revalidação NÃO apaga o conteúdo já cacheado em tela --
        // só encerra o carregamento (relevante no cache miss: sem isso o
        // spinner ficaria preso pra sempre numa falha de rede).
        if (cofreCache.ler(userId) === null) setSemConexao(true);
        setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, [userId, refreshTrigger, gateState]);

  if (gateState === "hidden") {
    return null;
  }

  if (gateState === "locked") {
    // `pinHash` is guaranteed truthy here by computeGateState's contract
    // (it only returns "locked" when pinHash is set) — re-checked anyway
    // so a locked gate NEVER falls through to sensitive content below,
    // even if that contract were ever violated.
    if (!pinHash || !mounted) return null;
    return createPortal(
      <PinScreen
        pinHash={pinHash}
        context="vault"
        onUnlock={() => setUnlocked(true)}
        onCancel={onExit}
      />,
      document.body
    );
  }

  async function openFile(path: string) {
    const { data } = await supabase.storage
      .from("cofre")
      .createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const filtered = files
    .filter((f) => filter === "todos" || f.categoria === filter)
    .filter((f) =>
      query.trim()
        ? f.name.toLowerCase().includes(query.trim().toLowerCase())
        : true
    );

  const emptyMessage = semConexao
    ? "Sem conexão. Seus arquivos aparecem aqui quando a internet voltar."
    : query.trim()
      ? `Nenhum arquivo encontrado para "${query.trim()}".`
      : filter === "todos"
        ? "Cofre vazio. Toque no + para enviar."
        : `Nenhum arquivo em "${CATS.find((c) => c.id === filter)?.label}".`;

  const buscaVisivel = buscaAberta || query.trim().length > 0;
  const usado = totalUsado(files);
  const ultimo = ultimoEnvio(files);
  const listaRecentes = recentes(filtered);

  return (
    <div className="pb-4">
      <div className="flex flex-col" style={{ gap: "16px" }}>
        {/* Cabeçalho (J05) — "Cofre" grande e em negrito forte, como o
            mockup (24px/800), com o botão de busca à direita. A busca é a
            mesma de antes (filtro local por nome, sem rede); o botão só
            mostra/esconde o campo. O cadeado do mockup entra desabilitado
            (pixel do mockup): "travar agora" não existe no app (J05: não
            criar ação nova). Botões nas medidas do mockup
            (components/ui/cabecalho). */}
        <div className="flex items-center" style={{ gap: "10px" }}>
          <h1
            className="flex-1"
            style={{
              fontSize: "24px",
              fontWeight: 800,
              // O mockup não declara line-height no h1: ele herda 1.1 do
              // .ph (26,4px). No app a herança vem do body (1.5 = 36px), o
              // que empurrava todo o resto da tela 10px para baixo.
              lineHeight: 1.1,
              letterSpacing: "-0.5px",
              color: "var(--text)",
            }}
          >
            Cofre
          </h1>
          <BotaoRedondo
            rotulo="Buscar arquivos"
            onClick={() => setBuscaAberta((v) => !v)}
            expandido={buscaVisivel}
          >
            <IconeBusca size={20} />
          </BotaoRedondo>
          <BotaoRedondo rotulo="Travar o Cofre">
            <IconeCadeado size={20} />
          </BotaoRedondo>
        </div>

        {/* Busca — o mesmo filtro client-side de antes, sobre o array
            `files` já buscado. Fica aberta enquanto houver texto. */}
        {buscaVisivel && (
          <GlassCard
            radius="md"
            className="flex items-center gap-3 px-3"
            style={{ height: "44px" }}
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
        )}

        {/* Card "Protegido" (J05) — no visual do mockup: fundo e sombra dos
            tokens `--hero-*` da fundação (J01), orbe na cor do tema, título,
            linha de proteção e a fileira de 3 números. A geometria do orbe
            (72px, escudo 34px, título 23px, cadeado 16px) é a aprovada no
            #137 e continua fixada por `cofre-visual.test.ts`; o mockup usa
            um quadrado menor, mas aquele teste não pode ser editado.
            A linha de proteção é a mesma de antes (PIN do Cofre ou trava do
            app), não a frase de "trava ativa" do mockup: sem PIN configurado
            a trava do app não está ativa, e a frase do mockup seria falsa.
            Os 3 números são todos reais: contagem de `files.length`, soma
            dos tamanhos do storage e data do envio mais recente (traço com
            o Cofre vazio). Nenhuma cota ou porcentagem: não existe cota. */}
        {!loading && (
          <>
            {/* Sem GlassCard em volta: na referência o card do Cofre É esta
                caixa escura, com o fundo e a sombra dela. O GlassCard punha
                uma segunda camada de vidro branco e uma segunda sombra em
                volta, que apareciam na borda e na comparação de pixel. */}
            <section
              className="flex flex-col"
              style={{
                padding: "22px",
                gap: "12px",
                background: "var(--hero-bg)",
                borderRadius: "26px",
                boxShadow: "0 14px 30px var(--hero-shadow)",
                color: "#fff",
              }}
            >
              <div className="flex items-center" style={{ gap: "14px" }}>
                <div
                  className="grid place-items-center shrink-0"
                  style={{
                    width: "54px",
                    height: "54px",
                    borderRadius: "16px",
                    background: "rgb(var(--accent-rgb))",
                    color: "var(--text)",
                  }}
                >
                  <IconeEscudo size={26} />
                </div>
                <div className="min-w-0">
                  <h2 style={{ fontSize: "22px", fontWeight: 800 }}>
                    Protegido
                  </h2>
                  <span
                    className="block"
                    style={{
                      // O mockup põe a linha de proteção colada no título,
                      // sem margem e sem ícone -- o `mt-1` mais o cadeado
                      // esticavam o hero e empurravam a tela toda.
                      fontSize: "12px",
                      color: "var(--hero-text-muted)",
                    }}
                  >
                    {pinHash
                      ? "Acesso protegido pelo seu PIN"
                      : "Trava do app ativa"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3" style={{ gap: "8px" }}>
                <div style={STAT_STYLE}>
                  <div style={STAT_VALOR_STYLE}>{files.length}</div>
                  <div style={STAT_LABEL_STYLE}>
                    {files.length === 1 ? "arquivo" : "arquivos"}
                  </div>
                </div>
                <div style={STAT_STYLE}>
                  <div style={STAT_VALOR_STYLE}>{formatTamanho(usado)}</div>
                  <div style={STAT_LABEL_STYLE}>usado</div>
                </div>
                <div style={STAT_STYLE}>
                  <div style={STAT_VALOR_STYLE}>{ultimo ?? "—"}</div>
                  <div style={STAT_LABEL_STYLE}>último</div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Fileira de ações no desenho do mockup (layout C): "Enviar" e as
            categorias viram azulejos redondos de 56px com rótulo de 11px/600,
            numa grade de 4 colunas. O "Enviar" deixou de ser botão rosa de
            largura inteira; o UploadSheet que ele abre continua morando na
            página, FORA da trava do Cofre -- o seletor de arquivo do sistema
            tira o foco da janela e o Cofre trava na hora, então o sheet
            precisa sobreviver a isso. Sem `onEnviar` o azulejo fica
            desabilitado em vez de virar um envio que se perde.
            Alvo de toque: o azulejo inteiro tem 80px de altura (56 do círculo
            + 8 de intervalo + a linha do rótulo), acima dos 44 exigidos. */}
        <div
          className="grid no-scrollbar"
          style={{
            gap: "8px",
            // O mockup desenha 4 colunas iguais. O app tem 6 azulejos (há
            // dado real em "Pessoal" e "Todos" é o estado padrão), então a
            // fileira vira uma linha que desliza: os 4 primeiros caem
            // exatamente onde o mockup os põe e nada deixa de ser
            // alcançável -- uma segunda linha empurraria a tela inteira.
            gridAutoFlow: "column",
            gridAutoColumns: "calc((100% - 24px) / 4)",
            overflowX: "auto",
            scrollSnapType: "x proximity",
          }}
        >
          <button
            type="button"
            onClick={onEnviar}
            disabled={!onEnviar}
            className="flex flex-col items-center active:opacity-70 disabled:opacity-50"
            style={{ gap: "8px", ...AZULEJO_ROTULO }}
          >
            <span className="grid place-items-center" style={AZULEJO}>
              <IconeEnviar size={22} />
            </span>
            Enviar
          </button>
          {ORDEM_AZULEJOS.map((id) => {
            const Icone = ICONE_CATEGORIA[id];
            const ativo = filter === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={ativo}
                onClick={() => setFilter(id)}
                className="flex flex-col items-center active:opacity-70"
                style={{ gap: "8px", ...AZULEJO_ROTULO }}
              >
                <span
                  className="grid place-items-center"
                  style={{
                    ...AZULEJO,
                    // Selecionado: o círculo ganha a tinta do acento. O
                    // desenho (tamanho, raio, rótulo) não muda.
                    background: ativo
                      ? "var(--accent-tint)"
                      : AZULEJO.background,
                  }}
                >
                  <Icone size={22} />
                </span>
                {rotuloCategoria(id)}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent)" }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <SecaoCofre titulo="Recentes">
            <p
              className="text-sm text-center py-10 px-4"
              style={{
                color: "var(--text-muted)",
                background: "var(--card-solid)",
                borderRadius: "20px",
              }}
            >
              {emptyMessage}
            </p>
          </SecaoCofre>
        ) : (
          <>
            <SecaoCofre titulo="Recentes" verTudo>
              <ListaArquivos
                files={listaRecentes}
                onOpen={openFile}
                rotuloCategoria={rotuloCategoria}
                corCategoria={catCor}
              />
            </SecaoCofre>
            <SecaoCofre titulo="Todos os arquivos" id={TODOS_OS_ARQUIVOS_ID}>
              <ListaArquivos
                files={filtered}
                onOpen={openFile}
                rotuloCategoria={rotuloCategoria}
                corCategoria={catCor}
              />
            </SecaoCofre>
          </>
        )}
      </div>
    </div>
  );
}
