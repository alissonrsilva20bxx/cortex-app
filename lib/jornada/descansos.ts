/**
 * Os dias de descanso que ela marcou na Agenda, guardados no aparelho
 * (`localStorage`, `jobapp-descansos:<userId>`), por conta.
 *
 * O servidor da Jornada só sabe o descanso de HOJE (`feitasHoje.descanso`,
 * 0038) e não guarda lista de dias (spec §8). Marcar outro dia, ou desfazer
 * o de hoje antes da migration 0048, fica só aqui:
 *
 *  - `true`: o dia está marcado como descanso;
 *  - `false`: ela desfez o descanso de hoje (vence o `feitasHoje` antigo
 *    do servidor). Só é guardado para hoje: em outro dia, desfazer apaga.
 *
 * Sem diário: a cada gravação, dia que já passou é apagado. Dia passado não
 * muda na Agenda.
 *
 * Formato `{ v: 1, dias: { "AAAA-MM-DD": boolean } }`. Quem gravou antes
 * disto não tem nada aqui (o descanso de hoje vinha só do servidor) e
 * continua valendo pelo `feitasHoje`. Chave que não é data e valor que não é
 * boolean são ignorados. Usa o mesmo storage de `cache.ts` e é defensivo
 * como ele: sem storage ou com JSON quebrado, fica vazio e nunca lança.
 */

import { diaDoRelogio } from "@/lib/relogio";
import { armazenamento } from "./cache";

export type Descansos = Readonly<Record<string, boolean>>;

const PREFIXO = "jobapp-descansos:";
const VERSAO = 1;

export const SEM_DESCANSOS: Descansos = Object.freeze({});

/** "AAAA-MM-DD" de um dia que existe. */
function ehDia(dia: string): boolean {
  const [ano, mes, d] = dia.split("-").map(Number);
  return diaDoRelogio(new Date(ano, mes - 1, d)) === dia;
}

/** Lê os dias marcados da conta. Nada guardado ou ilegível: vazio. */
export function lerDescansos(userId: string): Descansos {
  try {
    const raw = armazenamento()?.getItem(PREFIXO + userId);
    if (!raw) return SEM_DESCANSOS;
    const p = JSON.parse(raw) as { v?: unknown; dias?: unknown };
    if (p.v !== VERSAO || !p.dias || typeof p.dias !== "object") {
      return SEM_DESCANSOS;
    }
    const dias: Record<string, boolean> = {};
    for (const [dia, valor] of Object.entries(p.dias)) {
      if (ehDia(dia) && typeof valor === "boolean") dias[dia] = valor;
    }
    return dias;
  } catch {
    return SEM_DESCANSOS;
  }
}

/** Marca ou desmarca um dia e devolve como ficou (já gravado). */
export function gravarDescanso(
  userId: string,
  dia: string,
  marcado: boolean,
  hoje: string
): Descansos {
  const dias: Record<string, boolean> = {};
  for (const [d, v] of Object.entries(lerDescansos(userId))) {
    if (d >= hoje) dias[d] = v;
  }
  if (marcado) dias[dia] = true;
  else if (dia === hoje) dias[dia] = false;
  else delete dias[dia];
  try {
    armazenamento()?.setItem(
      PREFIXO + userId,
      JSON.stringify({ v: VERSAO, dias })
    );
  } catch {
    /* cota/storage indisponível: vale só nesta abertura */
  }
  return dias;
}

/** Logout: apaga os descansos de todas as contas. */
export function apagarDescansos(): void {
  try {
    const s = armazenamento();
    if (!s) return;
    const chaves: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIXO)) chaves.push(k);
    }
    chaves.forEach((k) => s.removeItem(k));
  } catch {
    /* nada a fazer */
  }
}
