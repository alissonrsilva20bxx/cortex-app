/**
 * Memória desta abertura do app para a comemoração (J13), no escopo do
 * módulo -- sobrevive a desmontar e montar de novo (StrictMode, troca de
 * aba, remount do PIN), e some quando o documento recarrega (que é,
 * justamente, a "próxima abertura").
 *
 *  - `vistasAoAbrir`: ids que já estavam na fila na primeira vez que o host
 *    a viu. Adiada que já estava lá veio de uma abertura anterior: toca.
 *  - `adiadas`: adiadas que chegaram DEPOIS (registro de atendimento nesta
 *    abertura): esperam. Voltar o app ao primeiro plano conta como nova
 *    abertura e as libera.
 *  - `somTocado` / `consumidas`: cada comemoração toca som UMA vez e é
 *    consumida UMA vez, mesmo montando duas vezes.
 */

import type { Comemoracao } from "@/lib/jornada/estado";
import { adiadasNovas } from "./decidir";

let vistasAoAbrir: Set<string> | null = null;
let adiadas = new Set<string>();
const somTocado = new Set<string>();
const consumidas = new Set<string>();

/** Observa a fila e devolve as adiadas desta sessão (que ainda esperam). */
export function adiadasDaSessao(fila: readonly Comemoracao[]): Set<string> {
  if (vistasAoAbrir === null) vistasAoAbrir = new Set(fila.map((c) => c.id));
  adiadas = adiadasNovas(fila, vistasAoAbrir, adiadas);
  return adiadas;
}

/** O app voltou ao primeiro plano: as adiadas da sessão podem tocar. */
export function liberarAdiadas(): void {
  for (const id of adiadas) vistasAoAbrir?.add(id);
  adiadas = new Set();
}

/** true só na primeira vez para este id (o som não toca duas vezes). */
export function primeiraVezDoSom(id: string): boolean {
  if (somTocado.has(id)) return false;
  somTocado.add(id);
  return true;
}

/** true só na primeira vez para este id (consumir uma vez só). */
export function primeiraVezDoConsumo(id: string): boolean {
  if (consumidas.has(id)) return false;
  consumidas.add(id);
  return true;
}

/** Só testes. */
export function _resetSessao(): void {
  vistasAoAbrir = null;
  adiadas = new Set();
  somTocado.clear();
  consumidas.clear();
}
