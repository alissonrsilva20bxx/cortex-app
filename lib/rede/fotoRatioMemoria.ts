/**
 * Memória local das proporções das fotos LEGADAS do feed (as que não têm
 * dimensão no nome da miniatura). Na 1ª vez que uma dessas fotos aparece, o
 * card reserva 1:1 e ajusta a altura ao medir a miniatura -- um salto único.
 * Guardando a proporção medida aqui, da 2ª visão em diante o card já
 * reserva a altura certa: sem salto.
 *
 * Regras:
 *  - chave = `thumbPath` (estável e único por foto);
 *  - teto de {@link LIMITE} entradas, descarta as mais antigas (a lista é
 *    mantida em ordem de uso, mais recente no fim);
 *  - TODO acesso ao `localStorage` é embrulhado em try/catch -- em SSR,
 *    aba anônima, storage desabilitado ou cota estourada a memória
 *    simplesmente "não existe" (lê `null`, grava nada) e o card volta a
 *    medir a miniatura. Nunca lança.
 */

const CHAVE = "rede:foto-proporcoes";
const LIMITE = 80;

type Entrada = [thumbPath: string, ratio: number];

function entradaValida(x: unknown): x is Entrada {
  return (
    Array.isArray(x) &&
    x.length === 2 &&
    typeof x[0] === "string" &&
    typeof x[1] === "number" &&
    Number.isFinite(x[1]) &&
    x[1] > 0
  );
}

function ler(): Entrada[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return [];
    const parsed: unknown = JSON.parse(cru);
    return Array.isArray(parsed) ? parsed.filter(entradaValida) : [];
  } catch {
    return [];
  }
}

/** Proporção (largura/altura, já clampada quando gravada) lembrada pra esse
 * `thumbPath`, ou `null` se não houver / o storage falhar. */
export function proporcaoLembrada(thumbPath: string): number | null {
  const achada = ler().find(([p]) => p === thumbPath);
  return achada ? achada[1] : null;
}

/** Grava (ou atualiza) a proporção medida, movendo a entrada pro fim e
 * descartando as mais antigas acima do teto. Silencioso em qualquer falha. */
export function lembrarProporcao(thumbPath: string, ratio: number): void {
  if (!Number.isFinite(ratio) || ratio <= 0) return;
  try {
    if (typeof localStorage === "undefined") return;
    const lista = ler().filter(([p]) => p !== thumbPath);
    lista.push([thumbPath, ratio]);
    while (lista.length > LIMITE) lista.shift();
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    /* storage cheio/indisponível: sem memória, o card mede a miniatura */
  }
}

/** Só pra teste. */
export const _internos = { CHAVE, LIMITE };
