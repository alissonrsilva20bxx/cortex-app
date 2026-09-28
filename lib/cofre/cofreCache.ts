/**
 * Cache SWR em memória do Cofre -- mesmo padrão de `lib/rede/redeCache.ts`,
 * reduzido ao necessário aqui: só metadados de arquivo, sem persistência em
 * disco (o Cofre é a área mais sensível do app -- nada dele deveria
 * sobreviver num `localStorage`).
 *
 * Corrige o defeito confirmado manualmente: `CofreTab` zerava `files` com
 * `setFiles([])` ao sair da aba, perder foco (`visibilitychange`/`pagehide`/
 * `blur`) e a cada trava do PIN -- e o efeito que busca os arquivos sempre
 * ligava `setLoading(true)` de novo antes de repetir as 4 consultas
 * `storage.list`. Resultado: toda entrada no Cofre depois do PIN mostrava
 * carregamento de novo, mesmo com os mesmos arquivos já vistos segundos
 * antes.
 *
 * Vive no escopo do módulo -- sobrevive a qualquer remount que NÃO descarte
 * o documento (troca de aba dentro do app, o remount que a trava de PIN do
 * app -- `app/page.tsx`: `if (locked && pinHash) return <PinScreen>` --
 * causa na árvore inteira, incluindo o `CofreTab` montado dentro do
 * `<main>`). NÃO sobrevive a reload de verdade nem ao iOS descartar o
 * documento do PWA em 2º plano -- não há camada persistida aqui (deliberado:
 * ver o comentário de escopo acima). Nesses casos o módulo nasce limpo e a
 * 1ª entrada volta a mostrar o carregamento normalmente.
 *
 * Regras que este módulo garante (o resto é responsabilidade do
 * `CofreTab`, que o consome):
 *
 *  - **Isolamento por conta.** Tudo é chaveado por `userId`. `ler` de uma
 *    conta diferente da vinculada devolve `null`. `vincularUsuario` de um
 *    id novo limpa tudo e avança a época.
 *  - **Resposta em voo da conta anterior não repovoa.** Cada `escrever`
 *    aceita a época capturada no início do fetch; se a época mudou (troca
 *    de conta, `limparTudo`), a escrita é ignorada.
 *  - **Nunca guarda signed URL.** `CofreFile` (abaixo) não tem esse campo --
 *    é gerada sob demanda em `CofreTab.openFile`, nunca cacheada.
 *  - Apresentação só. `ler` serve pra semear o estado do `CofreTab` na hora
 *    (SWR) enquanto revalida em 2º plano -- NUNCA é autorização (o gate de
 *    PIN próprio do Cofre, `lockGate.ts`, continua decidindo sozinho o que
 *    é seguro renderizar; este módulo não sabe nada sobre PIN).
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

/** Logout / troca de conta: zera tudo e avança a época. */
export function limparTudo(): void {
  limparInterno();
  epoca += 1;
}

// ────────────────────────────── arquivos ────────────────────────────────

/** `null` = cache miss de verdade (nunca buscado nesta sessão de JS, ou
 * conta errada) -- é o único caso em que `CofreTab` deve mostrar o
 * carregamento. Qualquer array (mesmo vazio) é um hit servido na hora. */
export function ler(userId: string): CofreFile[] | null {
  if (!contaOk(userId)) return null;
  const s = mem.get(userId);
  return s ? s.files : null;
}

export function escrever(
  userId: string,
  files: CofreFile[],
  atEpoca?: number
): void {
  if (!contaOk(userId) || epocaInvalida(atEpoca)) return;
  mem.set(userId, { files, ts: Date.now() });
}

/** Só pra teste -- reseta o módulo ao estado inicial. */
export function _resetParaTeste(): void {
  limparInterno();
  usuarioVinculado = null;
  epoca = 0;
}
