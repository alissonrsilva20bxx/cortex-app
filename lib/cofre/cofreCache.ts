/**
 * Cache SWR do Cofre -- mesmo padrão de `lib/rede/redeCache.ts`: memória
 * (módulo) + uma camada persistida em `localStorage`
 * (`jobapp-cofre-cache:<userId>`) que cobre o que a memória não cobre --
 * reload de verdade, o iOS descartar o documento do PWA em 2º plano e
 * abrir o app offline. Antes não havia camada persistida, e toda reabertura
 * do PWA pagava as 4 consultas `storage.list` (~1-1,5s de carregamento)
 * logo depois do PIN; offline, o Cofre aparecia vazio.
 *
 * O que vai pro disco: SÓ metadados da lista (nome, caminho, categoria,
 * tamanho, data, tipo). Nenhum conteúdo de arquivo, nenhuma signed URL
 * (abrir um arquivo continua gerando a URL na hora, online, em
 * `CofreTab.openFile`). A lista só é mostrada depois do PIN do Cofre --
 * este módulo é apresentação, nunca autorização. Logout (`limparTudo`)
 * apaga a camada persistida de todas as contas.
 *
 * Regras que este módulo garante (o resto é responsabilidade do
 * `CofreTab`, que o consome):
 *
 *  - **Isolamento por conta.** Tudo é chaveado por `userId`. `ler` de uma
 *    conta diferente da vinculada devolve `null`. `vincularUsuario` de um
 *    id novo limpa a memória e avança a época.
 *  - **Resposta em voo da conta anterior não repovoa.** Cada `escrever`
 *    aceita a época capturada no início do fetch; se a época mudou (troca
 *    de conta, `limparTudo`), a escrita é ignorada.
 *  - **Nunca guarda signed URL.** `CofreFile` (abaixo) não tem esse campo.
 *  - **Defensivo.** SSR, aba anônima, storage desabilitado, cota estourada
 *    ou JSON corrompido degradam pra "sem cache persistido", nunca lançam.
 */

export interface CofreFile {
  name: string;
  path: string;
  categoria: string;
  size: number;
  createdAt: string;
  mimeType?: string;
}

interface Snapshot {
  files: CofreFile[];
  ts: number;
}

const mem = new Map<string, Snapshot>(); // userId -> snapshot

const PREFIXO = "jobapp-cofre-cache:";
const VERSAO = 1;

// ─────────────────────────── camada persistida ───────────────────────────

function ehCofreFile(x: unknown): x is CofreFile {
  if (!x || typeof x !== "object") return false;
  const f = x as Record<string, unknown>;
  return (
    typeof f.name === "string" &&
    typeof f.path === "string" &&
    typeof f.categoria === "string" &&
    typeof f.size === "number" &&
    typeof f.createdAt === "string"
  );
}

function lerDisco(userId: string): Snapshot | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(PREFIXO + userId);
    if (!raw) return null;
    const p = JSON.parse(raw) as {
      v?: unknown;
      userId?: unknown;
      ts?: unknown;
      files?: unknown;
    };
    if (p.v !== VERSAO || p.userId !== userId || !Array.isArray(p.files)) {
      return null;
    }
    if (!p.files.every(ehCofreFile)) return null;
    return { files: p.files, ts: typeof p.ts === "number" ? p.ts : 0 };
  } catch {
    return null;
  }
}

function gravarDisco(userId: string, snap: Snapshot): void {
  try {
    if (typeof localStorage === "undefined") return;
    const files: CofreFile[] = snap.files.map((f) => ({
      name: f.name,
      path: f.path,
      categoria: f.categoria,
      size: f.size,
      createdAt: f.createdAt,
      mimeType: f.mimeType,
    }));
    localStorage.setItem(
      PREFIXO + userId,
      JSON.stringify({ v: VERSAO, userId, ts: snap.ts, files })
    );
  } catch {
    /* cota/storage indisponível: fica só a memória */
  }
}

function apagarDisco(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const chaves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIXO)) chaves.push(k);
    }
    chaves.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* nada a fazer */
  }
}

let usuarioVinculado: string | null = null;
let epoca = 0;

// ─────────────────────────── conta / época ──────────────────────────────

/** `true` se `userId` é a conta vinculada (vincula na hora se ainda não
 * houver nenhuma -- cobre o 1º render, antes do efeito de vínculo rodar). */
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
}

/** Chamado no mount/semeadura do Cofre. Trocar de conta limpa tudo e avança
 * a época (invalidando qualquer resposta em voo capturada com a época
 * antiga). */
export function vincularUsuario(userId: string): void {
  if (usuarioVinculado === userId) return;
  if (usuarioVinculado !== null) {
    limparInterno();
    epoca += 1;
  }
  usuarioVinculado = userId;
}

/** Época atual -- capture no início de um fetch e repasse pro `escrever`
 * correspondente pra que uma resposta atrasada de outra conta seja
 * descartada. */
export function epocaAtual(): number {
  return epoca;
}

/** Logout: zera memória E disco (todas as contas) e avança a época. */
export function limparTudo(): void {
  limparInterno();
  apagarDisco();
  epoca += 1;
}

// ────────────────────────────── arquivos ────────────────────────────────

/** `null` = cache miss de verdade (nunca buscado neste aparelho, ou conta
 * errada) -- é o único caso em que `CofreTab` deve mostrar o carregamento.
 * Qualquer array (mesmo vazio) é um hit servido na hora. Memória vazia
 * (documento novo) hidrata do disco. */
export function ler(userId: string): CofreFile[] | null {
  if (!contaOk(userId)) return null;
  let s = mem.get(userId);
  if (!s) {
    const disco = lerDisco(userId);
    if (disco) {
      mem.set(userId, disco);
      s = disco;
    }
  }
  return s ? s.files : null;
}

export function escrever(
  userId: string,
  files: CofreFile[],
  atEpoca?: number
): void {
  if (!contaOk(userId) || epocaInvalida(atEpoca)) return;
  const snap = { files, ts: Date.now() };
  mem.set(userId, snap);
  gravarDisco(userId, snap);
}

/** Só pra teste -- reseta o módulo ao estado inicial. */
export function _resetParaTeste(): void {
  limparInterno();
  apagarDisco();
  usuarioVinculado = null;
  epoca = 0;
}
