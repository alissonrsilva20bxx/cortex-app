/**
 * Data/contagem do "Próximo atendimento" (NextJobCard na Início,
 * JobDetailSheet na Agenda) — extraído pra `lib/` pra ganhar teste real:
 * `vitest.config.ts` não tem RTL nem plugin de JSX (só roda testes de
 * lógica em ambiente `node`), então uma função de data pura só é
 * testável de verdade fora de um `.tsx`.
 *
 * Achado #131 ("em 12131022 dias" no selo de contagem): um `data`
 * malformado — vazio, formato errado, ou um dia/mês fora do calendário
 * que o parser do `Date` corrige silenciosamente pra outra data (ex.
 * "2026-02-30" vira 2 de março) — podia produzir uma contagem de dias
 * absurda em vez de um erro visível. As funções abaixo rejeitam essa
 * entrada explicitamente (retornam `null`) em vez de deixar o parser
 * leniente do `Date` inventar uma data.
 */

const STRICT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** ~10 anos. Além disso, mesmo com formato válido, é bem mais provável
 * que seja dado corrompido do que um agendamento real tão distante —
 * mesmo raciocínio que rejeita "2026-02-30": um valor tecnicamente
 * parseável não é o mesmo que um valor plausível. */
const MAX_PLAUSIBLE_COUNTDOWN_DAYS = 3650;

/**
 * Parseia "YYYY-MM-DD" com validação estrita: formato errado, data
 * inexistente no calendário (rollover silencioso do `Date`) ou qualquer
 * resultado que não seja um `Date` válido viram `null` — nunca um `Date`
 * "tecnicamente válido, mas não o que foi pedido".
 */
function parseStrictDate(data: string): Date | null {
  if (!STRICT_DATE_RE.test(data)) return null;
  const [y, m, d] = data.split("-").map(Number);
  const parsed = new Date(`${data}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    return null;
  }
  return parsed;
}

/**
 * Dias até `data` (negativo = passado), ou `null` se `data` for inválida
 * ou implausivelmente distante (ver nota de topo do arquivo).
 * `referenceDate` existe só pra teste determinístico — produção sempre
 * usa "agora" (valor padrão).
 */
export function getDaysUntil(
  data: string,
  referenceDate: Date = new Date()
): number | null {
  const d = parseStrictDate(data);
  if (!d) return null;

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (!Number.isFinite(days) || Math.abs(days) > MAX_PLAUSIBLE_COUNTDOWN_DAYS) {
    return null;
  }
  return days;
}

/**
 * Rótulo do selo de contagem regressiva. `null` (data inválida ou
 * absurdamente distante) é o fallback honesto: quem chama omite o selo
 * inteiro em vez de mostrar uma contagem inventada.
 */
export function countdownLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0) return "Atrasado";
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return `em ${days} dias`;
}

/**
 * Selo "dia/mês" compacto do card — "21" + "AGO". Mesmo fallback
 * honesto das duas funções acima: data inválida vira um traço, nunca
 * "NaN"/"Invalid Date" renderizado cru na tela.
 */
export function formatDayBadge(data: string): { day: string; month: string } {
  const d = parseStrictDate(data);
  if (!d) return { day: "–", month: "—" };
  return {
    day: String(d.getDate()),
    month: d
      .toLocaleDateString("pt-BR", { month: "short" })
      .replace(".", "")
      .toUpperCase(),
  };
}
