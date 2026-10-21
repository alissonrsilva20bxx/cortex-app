import { LOCALE } from "@/lib/jornada/textos";

/** Cores dos Desejos novos, em rodízio. */
export const WISHLIST_PALETTE = [
  "#FF7AB6",
  "#7AA7FF",
  "#FFC24B",
  "#6EE7B7",
  "#C4B5FD",
  "#FCA5A5",
];

/**
 * Progresso do Desejo, inteiro de 0 a 100. Única conta usada por Finanças,
 * Rede, Início e texto de compartilhar. Alvo 0 (ou menor) dá 0.
 */
export function progressoDesejo(atual: number, alvo: number): number {
  if (!(alvo > 0) || !(atual > 0)) return 0;
  return Math.min(100, Math.round((atual / alvo) * 100));
}

export type DesejoOrdenavel = {
  id: string;
  valorAlvo: number;
  valorAtual: number;
  criadoEm: string;
};

/**
 * Desejo principal. Mesma regra da "Meta atual" da Jornada (SQL 0036):
 * valor_alvo > 0, valor_atual < valor_alvo, o mais antigo (criado_em, id).
 */
export function desejoPrincipal<T extends DesejoOrdenavel>(
  items: T[]
): T | null {
  const abertos = items.filter(
    (i) => i.valorAlvo > 0 && i.valorAtual < i.valorAlvo
  );
  if (abertos.length === 0) return null;
  return abertos.reduce((a, b) => {
    const ta = Date.parse(a.criadoEm);
    const tb = Date.parse(b.criadoEm);
    if (ta !== tb) return ta < tb ? a : b;
    return a.id <= b.id ? a : b;
  });
}

/** Lê "YYYY-MM-DD" como data local (new Date(str) seria UTC e voltaria 1 dia). */
function lerDataLocal(prazo: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(prazo);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "Até 24 de dez. de 2026", ou null sem prazo. */
export function textoPrazo(prazo: string | null | undefined): string | null {
  if (!prazo) return null;
  const d = lerDataLocal(prazo);
  if (!d) return null;
  const data = new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  return `Até ${data}`;
}

/** Dias de hoje até o prazo (negativo se já passou). null sem prazo. */
export function diasAtePrazo(
  prazo: string | null | undefined,
  hoje: Date = new Date()
): number | null {
  if (!prazo) return null;
  const d = lerDataLocal(prazo);
  if (!d) return null;
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((d.getTime() - h.getTime()) / 86_400_000);
}
