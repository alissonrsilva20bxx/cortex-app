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
): { acao: (typeof ACOES_DO_RESUMO)[number]; n: number }[] {
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

/** O par (corrente, anterior fechado) de um tipo de período. */
export function doEstado(
  estado: EstadoJornada,
  tipo: TipoPeriodo
): { atual: Periodo | null; fechado: Periodo | null } {
  return estado.periodos[tipo];
}
