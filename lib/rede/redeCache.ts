/**
 * Cache SWR em memória da Rede -- vive no escopo do módulo, então
 * SOBREVIVE enquanto o JavaScript da página estiver vivo: o remount da
 * árvore inteira que o destravamento do PIN causa (`app/page.tsx`:
 * `if (locked && pinHash) return <PinScreen>`), troca de aba interna,
 * qualquer remount que NÃO recarregue o documento.
 *
 * NÃO sobrevive quando o documento é descartado: reload de verdade (cold
 * start) OU o iOS matar a aba/documento do PWA em segundo plano pra
 * liberar memória (ao reabrir, o documento recarrega do zero). Nesses
 * casos o módulo nasce limpo e quem cobre é a camada persistida
 * (`redeCachePersist.ts`, localStorage) -- inclusive o carimbo de "acesso
 * confirmado" (`hidratarAcesso`, chamado pelo `RedeGatedTab` no mount): sem
 * isso, um documento novo sempre tratava a conta como "nunca confirmado
 * nesta sessão", mesmo com uma confirmação de segundos atrás, e a aba
 * inteira esperava o round-trip de rede antes de mostrar qualquer coisa. A
 * hidratação só REPÕE o carimbo na memória -- o teto de `acessoConfirmadoValido`
 * continua sendo decidido só por essa função, e não muda.
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

/**
 * Teto de confiança de um acesso CONFIRMADO (`verificarAcessoConvite`
 * devolveu um `200` com convite). Dentro dele o `RedeGatedTab` mostra o Feed
 * cacheado na hora ao destravar o PIN, revalidando em 2º plano -- NUNCA é
 * autorização (RLS decide cada query de verdade), só decide se a interface
 * confia no que já mostrou antes de saber a resposta de novo.
 *
 * Isto NÃO é (mais) o intervalo aceitável entre "travou o PIN" e "destravou
 * de novo" -- essa era a confusão original (T121, retest de 11/09-18/09):
 * tratar tempo decorrido como sinônimo de "perdeu o acesso" fazia qualquer
 * destrava depois de ~90s pagar um round-trip síncrono antes de mostrar
 * qualquer coisa, mesmo com a memória perfeitamente intacta. Ver
 * `RedeGatedTab` pro modelo atual, que separa três coisas que estavam
 * conflacionadas numa constante só:
 *  - validade dos DADOS em cache (feed/perfil) -- é `STALE_MS` acima, SWR de
 *    verdade, nunca bloqueia nada, não muda aqui;
 *  - MOMENTO de revalidar o acesso -- sempre, incondicional, todo mount +
 *    volta de 2º plano + reconexão (não depende deste teto);
 *  - quando OCULTAR o conteúdo privado -- só em resposta negativa decisiva
 *    (`sem_convite`/`sessao`/`negado`), logout ou troca de conta. Este teto
 *    de 24h é só uma rede de segurança de última instância pro caso
 *    degenerado de nunca mais conseguir uma confirmação positiva (sempre
 *    offline, ou o app nunca mais reaberto em primeiro plano) -- não é o
 *    gatilho normal de ocultar, e não deve ser tratado como se fosse.
 *
 * Por isso o valor é generoso (bate com o TTL do cache de dados em
 * `redeCachePersist.ts`) em vez de curto: ele só existe pra não deixar uma
 * confirmação sem NENHUMA corroboração valer pra sempre, não pra apertar o
 * ciclo comum de destravar o PIN. Enquanto a revalidação só devolver
 * resultados INDETERMINADOS (offline/5xx), o acesso lembrado NÃO é
 * estendido -- só uma resposta POSITIVA (`unlocked: true`) recarimba
 * `confirmadoEm`.
 */
const ACESSO_CONFIRMADO_TTL_MS = 24 * 60 * 60 * 1000;

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
// userId -> acesso confirmado + quando (pra aplicar o TTL). Só entra aqui
// resultado CONCLUSIVO de `verificarAcessoConvite` (200); indeterminado
// nunca renova.
const acessoMemoria = new Map<
  string,
  { unlocked: boolean; confirmadoEm: number }
>();
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

/** Último resultado CONCLUSIVO (`200`) de `verificarAcessoConvite` +
 * quando. `undefined` = nunca confirmado nesta sessão de JS. Apresentação
 * só (nunca autorização) -- ver o cabeçalho do arquivo e o `RedeGatedTab`,
 * que aplica o TTL antes de confiar nisto. */
export function acessoLembrado(
  userId: string
): { unlocked: boolean; confirmadoEm: number } | undefined {
  return contaOk(userId) ? acessoMemoria.get(userId) : undefined;
}

/** `true` se há um acesso CONFIRMADO como liberado e ainda dentro do teto de
 * confiança -- a condição pra o `RedeGatedTab` mostrar o Feed cacheado na
 * hora, SEM esperar a revalidação terminar (que roda de qualquer jeito, em
 * 2º plano, incondicional -- isto só decide se a interface confia no que já
 * tem enquanto isso). */
export function acessoConfirmadoValido(userId: string): boolean {
  const a = acessoLembrado(userId);
  return (
    !!a && a.unlocked && Date.now() - a.confirmadoEm < ACESSO_CONFIRMADO_TTL_MS
  );
}

/** Ms restantes até o carimbo atual cruzar o teto de confiança -- `null` se
 * não há carimbo pra esta conta (nunca confirmado, ou conta errada). Pode
 * devolver <= 0 se o teto já foi cruzado -- quem decide "ainda vale" é
 * sempre `acessoConfirmadoValido`, este só serve pra agendar um timer
 * exato em vez de o `RedeGatedTab` fazer polling. */
export function tempoRestanteAteTeto(userId: string): number | null {
  const a = acessoLembrado(userId);
  if (!a) return null;
  return ACESSO_CONFIRMADO_TTL_MS - (Date.now() - a.confirmadoEm);
}

export function lembrarAcesso(
  userId: string,
  unlocked: boolean,
  confirmadoEm: number = Date.now()
): void {
  if (contaOk(userId)) {
    acessoMemoria.set(userId, { unlocked, confirmadoEm });
  }
}

/** Semeia a memória com um carimbo lido de `redeCachePersist` -- só no 1º
 * momento em que esta conta é vista nesta sessão de JS (documento novo:
 * reload de verdade, ou o iOS descartou a aba em 2º plano). Nunca sobrescreve
 * um resultado já obtido NESTA sessão (`acessoMemoria.has`): um carimbo
 * antigo do disco não pode pisar numa confirmação (ou derrubada) mais nova
 * que já rodou. Não aplica o TTL -- quem decide validade continua sendo
 * `acessoConfirmadoValido`, chamada depois desta função com o mesmo
 * `confirmadoEm` agora em memória. */
export function hidratarAcesso(
  userId: string,
  persistido: { unlocked: boolean; confirmadoEm: number } | null
): void {
  if (!persistido || !contaOk(userId) || acessoMemoria.has(userId)) return;
  acessoMemoria.set(userId, persistido);
}

/** Só pra teste -- reseta o módulo ao estado inicial. */
export function _resetParaTeste(): void {
  limparInterno();
  usuarioVinculado = null;
  epoca = 0;
}

export const _internos = {
  STALE_MS,
  SLIDE_CAP,
  TOMBSTONE_CAP,
  ACESSO_CONFIRMADO_TTL_MS,
};
