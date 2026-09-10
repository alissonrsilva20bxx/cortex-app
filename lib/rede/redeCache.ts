/**
 * Cache SWR em memória da Rede -- vive no escopo do módulo, então
 * SOBREVIVE ao remount da árvore inteira que o destravamento do PIN causa
 * (`app/page.tsx`: `if (locked && pinHash) return <PinScreen>`), ao iOS
 * descartar a aba do PWA e a qualquer outro remount que não recarregue o
 * documento. Num reload de verdade (cold start) o módulo nasce limpo -- aí
 * quem cobre é a camada persistida (`redeCachePersist.ts`).
 *
 * Regras que este módulo garante (o resto é responsabilidade do
 * `RedeTab`/`RedeGatedTab` que o consomem):
 *
 *  - **Isolamento por conta.** Tudo é chaveado por `userId`. `ler*` de uma
 *    conta diferente da vinculada devolve `null` -- nunca vaza conteúdo de
 *    A pra B. `vincularUsuario` de um id novo limpa tudo e avança a época.
 *  - **Resposta em voo da conta anterior não repovoa** (req 4). Cada
 *    `escrever*` aceita a época capturada no início do fetch; se a época
 *    mudou (troca de conta, `limparTudo`), a escrita é ignorada.
 *  - **Apagado não ressuscita** (req 6). `marcarExcluido(postId)` tomba o
 *    id: todo `escreverFeed` filtra tombstones, então um `listarFeed` lento
 *    que já estava em voo quando o post foi apagado não o traz de volta.
 *  - Apresentação só. O resultado cacheado de `verificarAcessoConvite`
 *    (`acessoLembrado`) serve pra decidir se renderiza `<RedeTab>` na hora
 *    enquanto revalida -- NUNCA é autorização (o servidor/RLS é quem
 *    autoriza cada query de fato). Ver `RedeGatedTab`.
 */

import type { FeedPost } from "./feed";

/** Recursos "leves" (sem lógica própria): perfil e agregados de tela. O
 * feed tem funções dedicadas abaixo por causa dos tombstones. */
export type RedeRecurso = "perfil" | "amigas" | "conversas" | "notificacoes";

/** Depois disto o dado ainda é servido na hora (SWR), mas o consumidor
 * dispara uma revalidação em segundo plano. */
const STALE_MS = 60_000;

const SLIDE_CAP = 120;
const TOMBSTONE_CAP = 300;

interface Snapshot {
  data: unknown;
  ts: number;
}

interface FeedSnapshot {
  posts: FeedPost[];
  hasMore: boolean;
  ts: number;
}

const mem = new Map<string, Snapshot>(); // `${userId}::${recurso}` -> snapshot
const feedPorUsuario = new Map<string, FeedSnapshot>(); // userId -> feed
const slideMemoria = new Map<string, number>(); // postId -> slide ativo do carrossel
const acessoMemoria = new Map<string, boolean>(); // userId -> unlocked (apresentação)
const tombstones = new Set<string>(); // ids de posts excluídos nesta sessão
let segmento: "paraVoce" | "amigas" = "paraVoce";
let scrollY = 0;
let scrollValido = false;

let usuarioVinculado: string | null = null;
let epoca = 0;

// ─────────────────────────── conta / época ──────────────────────────────

function chave(userId: string, recurso: RedeRecurso): string {
  return `${userId}::${recurso}`;
}

/** `true` se `userId` é a conta vinculada (vincula na hora se ainda não
 * houver nenhuma -- cobre o 1º render, antes do effect de vínculo rodar). */
function contaOk(userId: string): boolean {
  if (usuarioVinculado === null) {
    usuarioVinculado = userId;
    return true;
  }
  return usuarioVinculado === userId;
}

function epocaInvalida(atEpoca: number | undefined): boolean {
  return atEpoca !== undefined && atEpoca !== epoca;
}

function limparInterno(): void {
  mem.clear();
  feedPorUsuario.clear();
  slideMemoria.clear();
  acessoMemoria.clear();
  tombstones.clear();
  segmento = "paraVoce";
  scrollY = 0;
  scrollValido = false;
}

/** Chamado no mount da Rede. Trocar de conta limpa tudo e avança a época
 * (invalidando qualquer resposta em voo capturada com a época antiga). */
export function vincularUsuario(userId: string): void {
  if (usuarioVinculado === userId) return;
  if (usuarioVinculado !== null) {
    limparInterno();
    epoca += 1;
  }
  usuarioVinculado = userId;
}

/** Época atual -- capture no início de um fetch e repasse pro `escrever*`
 * correspondente pra que uma resposta atrasada de outra conta seja
 * descartada. */
export function epocaAtual(): number {
  return epoca;
}

/** Logout / acesso revogado: zera tudo e avança a época. */
export function limparTudo(): void {
  limparInterno();
  epoca += 1;
}

// ───────────────────────────── recursos leves ───────────────────────────

export function ler<T>(
  userId: string,
  recurso: RedeRecurso
): { data: T; stale: boolean } | null {
  if (!contaOk(userId)) return null;
  const s = mem.get(chave(userId, recurso));
  if (!s) return null;
  return { data: s.data as T, stale: Date.now() - s.ts > STALE_MS };
}

export function escrever<T>(
  userId: string,
  recurso: RedeRecurso,
  data: T,
  atEpoca?: number
): void {
  if (!contaOk(userId) || epocaInvalida(atEpoca)) return;
  mem.set(chave(userId, recurso), { data, ts: Date.now() });
}

/** Marca o recurso como stale sem apagá-lo -- o SWR continua servindo o
 * valor atual enquanto o consumidor revalida. Usado depois de mutações que
 * tornam o cache desatualizado sem invalidá-lo por completo (ex.: editar o
 * perfil também mexe em como os posts do próprio autor aparecem no feed). */
export function invalidar(userId: string, recurso: RedeRecurso): void {
  const s = mem.get(chave(userId, recurso));
  if (s) s.ts = 0;
}

// ──────────────────────────────── feed ──────────────────────────────────

export function lerFeed(
  userId: string
): { posts: FeedPost[]; hasMore: boolean; stale: boolean } | null {
  if (!contaOk(userId)) return null;
  const s = feedPorUsuario.get(userId);
  if (!s) return null;
  return {
    posts: s.posts,
    hasMore: s.hasMore,
    stale: Date.now() - s.ts > STALE_MS,
  };
}

/** Substitui o feed cacheado (todas as páginas já carregadas). Filtra
 * tombstones -- um `listarFeed` em voo desde antes de um post ser apagado
 * não o ressuscita. `atEpoca` descarta respostas de contas anteriores. */
export function escreverFeed(
  userId: string,
  posts: FeedPost[],
  hasMore: boolean,
  atEpoca?: number
): void {
  if (!contaOk(userId) || epocaInvalida(atEpoca)) return;
  feedPorUsuario.set(userId, {
    posts: posts.filter((p) => !tombstones.has(p.id)),
    hasMore,
    ts: Date.now(),
  });
}

/** Espelha uma mutação otimista do `RedeTab` (curtir, publicar, editar,
 * excluir) no feed cacheado. NÃO renova o `ts`: uma mudança local não vale
 * como sincronização com o servidor, então o SWR continua querendo
 * revalidar. */
export function mutarFeed(
  userId: string,
  fn: (posts: FeedPost[]) => FeedPost[]
): void {
  if (!contaOk(userId)) return;
  const s = feedPorUsuario.get(userId);
  if (!s) return;
  s.posts = fn(s.posts).filter((p) => !tombstones.has(p.id));
}

/** Marca o feed como stale (revalida no próximo mount/refresh) sem
 * derrubar o conteúdo cacheado -- sem skeleton. */
export function invalidarFeed(userId: string): void {
  const s = feedPorUsuario.get(userId);
  if (s) s.ts = 0;
}

/** Tomba um post excluído: nenhum `escreverFeed`/`mutarFeed` volta a
 * aceitá-lo nesta sessão. Limpo no logout/troca de conta. */
export function marcarExcluido(postId: string): void {
  tombstones.add(postId);
  while (tombstones.size > TOMBSTONE_CAP) {
    const primeiro = tombstones.values().next().value as string | undefined;
    if (primeiro === undefined) break;
    tombstones.delete(primeiro);
  }
  for (const s of feedPorUsuario.values()) {
    s.posts = s.posts.filter((p) => p.id !== postId);
  }
}

export function estaExcluido(postId: string): boolean {
  return tombstones.has(postId);
}

/**
 * Concilia a página 1 recém-buscada (`frescos`) com o que já está em tela
 * (`anteriores`), preservando:
 *  - páginas mais profundas já carregadas (`loadMorePosts`);
 *  - curtidas otimistas ainda não confirmadas (`likesPend`) — uma resposta
 *    de `listarFeed` que estava em voo não desfaz o like local (req 6);
 *  - posts recém-publicados que a resposta em voo ainda não enxerga.
 * E descartando posts tombstoned nesta sessão.
 */
export function reconciliarFeed(
  anteriores: FeedPost[],
  frescos: FeedPost[],
  likesPend: ReadonlySet<string>,
  usuarioId: string
): FeedPost[] {
  const idsFrescos = new Set(frescos.map((p) => p.id));
  const maisNovo = frescos.length ? frescos[0].criadoEm : null;
  const maisAntigo = frescos.length
    ? frescos[frescos.length - 1].criadoEm
    : null;

  const cabeca = anteriores.filter(
    (p) =>
      !idsFrescos.has(p.id) &&
      p.autorId === usuarioId &&
      (maisNovo === null || p.criadoEm > maisNovo)
  );
  const cauda =
    maisAntigo === null
      ? []
      : anteriores.filter(
          (p) => !idsFrescos.has(p.id) && p.criadoEm < maisAntigo
        );

  const frescosComLikeLocal = frescos.map((p) => {
    if (!likesPend.has(p.id)) return p;
    const local = anteriores.find((x) => x.id === p.id);
    return local
      ? { ...p, curtidoPorMim: local.curtidoPorMim, curtidas: local.curtidas }
      : p;
  });

  return [...cabeca, ...frescosComLikeLocal, ...cauda].filter(
    (p) => !tombstones.has(p.id)
  );
}

// ─────────────────────── slide do carrossel / scroll ────────────────────

export function lembrarSlide(postId: string, indice: number): void {
  slideMemoria.delete(postId);
  slideMemoria.set(postId, indice);
  while (slideMemoria.size > SLIDE_CAP) {
    const k = slideMemoria.keys().next().value as string | undefined;
    if (k === undefined) break;
    slideMemoria.delete(k);
  }
}

export function slideLembrado(postId: string): number {
  return slideMemoria.get(postId) ?? 0;
}

export function lembrarSegmento(valor: "paraVoce" | "amigas"): void {
  segmento = valor;
}

export function segmentoLembrado(): "paraVoce" | "amigas" {
  return segmento;
}

/** Só a rolagem da Rede -- o `RedeTab` só grava enquanto a aba está ativa,
 * então nunca captura a rolagem de outra aba (req 2). */
export function lembrarScroll(y: number): void {
  scrollY = y;
  scrollValido = true;
}

export function scrollLembrado(): number | null {
  return scrollValido ? scrollY : null;
}

// ─────────────────────────── acesso (apresentação) ──────────────────────

/** Último resultado REAL (não erro de rede) de `verificarAcessoConvite`.
 * `undefined` = nunca verificado nesta sessão. Apresentação só -- ver o
 * cabeçalho do arquivo. */
export function acessoLembrado(userId: string): boolean | undefined {
  return contaOk(userId) ? acessoMemoria.get(userId) : undefined;
}

export function lembrarAcesso(userId: string, unlocked: boolean): void {
  if (contaOk(userId)) acessoMemoria.set(userId, unlocked);
}

/** Só pra teste -- reseta o módulo ao estado inicial. */
export function _resetParaTeste(): void {
  limparInterno();
  usuarioVinculado = null;
  epoca = 0;
}

export const _internos = { STALE_MS, SLIDE_CAP, TOMBSTONE_CAP };
