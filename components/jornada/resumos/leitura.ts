import type { EstadoJornada, Periodo, TipoPeriodo } from "@/lib/jornada/estado";
import { ACOES_DO_RESUMO } from "@/lib/jornada/textos";

/**
 * Leituras do resumo (J14, #164). Só LÊ `estado.periodos` — os contadores
 * que `jornada_periodos` guarda (spec §8). Nada aqui calcula Glow, estágio,
 * limite ou selo: quem decide é o servidor. E nada aqui pede "o que
 * aconteceu no dia tal": esse dado não existe, de propósito (decisão 16).
 */

/** Um contador do período, 0 quando não houver. */
export function contador(periodo: Periodo | null, chave: string): number {
  return periodo?.contadores[chave] ?? 0;
}

/** O ritmo do período: na semana é `firme` (0/1); no mês e no ano, a contagem. */
export function chaveDoRitmo(tipo: TipoPeriodo): string {
  return tipo === "semana" ? "firme" : "semanas_firmes";
}

/** Dinheiro guardado: na semana é `guardou` (0/1); no mês e no ano, a contagem. */
export function chaveDeGuardou(tipo: TipoPeriodo): string {
  return tipo === "semana" ? "guardou" : "semanas_guardou";
}

/** As ações do período com contagem maior que zero, na ordem do resumo. */
export function acoesFeitas(
  periodo: Periodo | null
): { acao: string; n: number }[] {
  return ACOES_DO_RESUMO.map((acao) => ({
    acao,
    n: contador(periodo, acao),
  })).filter((item) => item.n > 0);
}

/**
 * Período sem nada: nenhum Glow, nenhum dia forte, nenhum ritmo, nenhuma
 * ação. Não é falha — é só vazio (a regra de "sem cobrança" da #164).
 */
export function periodoVazio(
  periodo: Periodo | null,
  tipo: TipoPeriodo
): boolean {
  return (
    contador(periodo, "glow") === 0 &&
    contador(periodo, "dias_fortes") === 0 &&
    contador(periodo, chaveDoRitmo(tipo)) === 0 &&
    contador(periodo, chaveDeGuardou(tipo)) === 0 &&
    acoesFeitas(periodo).length === 0
  );
}

/** "AAAA-MM-DD" → Date local, por partes (nunca `new Date(string)`, que vira UTC). */
function doIso(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

const iguais = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Se o período fechado é mesmo o IMEDIATAMENTE anterior ao corrente.
 *
 * O servidor guarda uma linha fechada por tipo (`primary key (user_id, tipo,
 * fechado)`), e ela é o último período em que ela teve atividade -- não
 * necessariamente o anterior. Quem ficou cinco semanas fora veria "na semana
 * passada" sobre uma semana de mais de um mês atrás. É conferência de
 * calendário, não de Glow: fora isso, a comparação some.
 */
export function ehPeriodoAnterior(
  corrente: Periodo,
  fechado: Periodo | null,
  tipo: TipoPeriodo
): boolean {
  if (!fechado) return false;
  const inicio = doIso(corrente.inicio);
  const antes = doIso(fechado.inicio);
  if (!inicio || !antes) return false;
  if (tipo === "semana") {
    const esperado = new Date(inicio);
    esperado.setDate(esperado.getDate() - 7);
    return iguais(antes, esperado);
  }
  if (tipo === "mes") {
    const esperado = new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1);
    return iguais(antes, esperado);
  }
  return iguais(antes, new Date(inicio.getFullYear() - 1, 0, 1));
}

/**
 * O par (corrente, anterior) de um tipo de período, na forma que o servidor
 * manda (J10). O `fechado` só vem quando é mesmo o período anterior E o
 * corrente tem alguma coisa: comparar com um período vazio vira cobrança.
 */
export function doEstado(
  estado: EstadoJornada,
  tipo: TipoPeriodo
): { atual: Periodo; fechado: Periodo | null } {
  const atual = estado.periodos.corrente[tipo];
  const guardado = estado.periodos.ultimoFechado[tipo] ?? null;
  const comparavel =
    !periodoVazio(atual, tipo) && ehPeriodoAnterior(atual, guardado, tipo);
  return { atual, fechado: comparavel ? guardado : null };
}
