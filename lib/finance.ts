import type {
  Job,
  Meta,
  Despesa,
  ReceitaAvulsa,
  PeriodoMeta,
} from "@/lib/types";

/**
 * Fonte única da lógica financeira da Home / Financeiro.
 * Antes: monthEarnings/prevMonth/sparkline estavam copiados em 4 componentes,
 * cada cópia derivando (2 verdes, raios diferentes, cards gêmeos). Aqui é o
 * lugar canônico — telas consomem, não recalculam.
 */

export const formatBRL = (v: number, fractionDigits = 0) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: fractionDigits,
  }).format(v);

/** "12 jul" — data curta no fuso local. */
export const formatShortDate = (data: string) =>
  new Date(data + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });

/** YYYY-MM-DD no fuso local (evita o off-by-one do toISOString em UTC). */
function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Data local a partir de uma string YYYY-MM-DD (sem virada de fuso). */
function parseLocal(data: string): Date {
  return new Date(data + "T00:00:00");
}

const isConcluido = (j: Job) => j.status === "concluído";

/** Ganho (jobs concluídos) num mês/ano específico. */
function earningsInMonth(jobs: Job[], year: number, month: number): number {
  return jobs
    .filter((j) => {
      if (!isConcluido(j)) return false;
      const d = parseLocal(j.data);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .reduce((s, j) => s + j.valor, 0);
}

/** Quanto ela já construiu este mês (jobs concluídos). */
export function monthEarnings(jobs: Job[], ref = new Date()): number {
  return earningsInMonth(jobs, ref.getFullYear(), ref.getMonth());
}

/** Ganho do mês anterior — para comparação de tendência. */
export function prevMonthEarnings(jobs: Job[], ref = new Date()): number {
  const prev = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  return earningsInMonth(jobs, prev.getFullYear(), prev.getMonth());
}

/** Despesas do mês corrente. */
export function monthExpenses(despesas: Despesa[], ref = new Date()): number {
  return despesas
    .filter((d) => {
      const date = parseLocal(d.data);
      return (
        date.getFullYear() === ref.getFullYear() &&
        date.getMonth() === ref.getMonth()
      );
    })
    .reduce((s, d) => s + d.valor, 0);
}

/** Série dos últimos 7 dias (ganho concluído por dia) para sparkline. */
export function last7DaysSparkline(jobs: Job[], ref = new Date()): number[] {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ref);
    d.setDate(d.getDate() - (6 - i));
    return localKey(d);
  });
  return days.map((ds) =>
    jobs
      .filter((j) => isConcluido(j) && j.data === ds)
      .reduce((s, j) => s + j.valor, 0)
  );
}

export function monthMeta(metas: Meta[]): number | null {
  return metas.find((m) => m.periodo === "mes")?.valorAlvo ?? null;
}

function inPeriod(dateStr: string, periodo: PeriodoMeta, ref: Date): boolean {
  const d = parseLocal(dateStr);
  if (periodo === "dia") return d.toDateString() === ref.toDateString();
  if (periodo === "mes")
    return (
      d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear()
    );
  return d.getFullYear() === ref.getFullYear();
}

/**
 * Entradas totais (jobs concluídos + receitas avulsas) num período.
 * Diferente de monthEarnings (só jobs) usado no herói da Home: aqui é a
 * visão completa do Financeiro. Ambos vivem aqui — telas consomem, não
 * recalculam.
 */
export function calcEarnings(
  jobs: Job[],
  receitas: ReceitaAvulsa[],
  periodo: PeriodoMeta,
  ref = new Date()
): number {
  const jobTotal = jobs
    .filter((j) => isConcluido(j) && inPeriod(j.data, periodo, ref))
    .reduce((s, j) => s + j.valor, 0);
  const receitaTotal = receitas
    .filter((r) => inPeriod(r.data, periodo, ref))
    .reduce((s, r) => s + r.valor, 0);
  return jobTotal + receitaTotal;
}

export type ChartPeriod = "sem" | "mes" | "ano";

/** Série do gráfico de receitas por semana / mês / ano. */
export function buildChartData(
  jobs: Job[],
  receitas: ReceitaAvulsa[],
  period: ChartPeriod,
  ref = new Date()
): { label: string; value: number }[] {
  const sumBetween = (start: Date, end: Date) => {
    const jobV = jobs
      .filter((j) => {
        if (!isConcluido(j)) return false;
        const d = parseLocal(j.data);
        return d >= start && d <= end;
      })
      .reduce((s, j) => s + j.valor, 0);
    const recV = receitas
      .filter((r) => {
        const d = parseLocal(r.data);
        return d >= start && d <= end;
      })
      .reduce((s, r) => s + r.valor, 0);
    return jobV + recV;
  };

  if (period === "sem") {
    return Array.from({ length: 8 }, (_, i) => {
      const end = new Date(ref);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { label: `S${8 - i}`, value: sumBetween(start, end) };
    }).reverse();
  }

  if (period === "mes") {
    return Array.from({ length: 12 }, (_, i) => {
      const m = (ref.getMonth() - 11 + i + 12) % 12;
      const y = ref.getFullYear() - (ref.getMonth() - 11 + i < 0 ? 1 : 0);
      const label = new Date(y, m, 1).toLocaleDateString("pt-BR", {
        month: "short",
      });
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return { label, value: sumBetween(start, end) };
    });
  }

  // ano
  const nowY = ref.getFullYear();
  return Array.from({ length: 5 }, (_, i) => {
    const y = nowY - 4 + i;
    return {
      label: String(y),
      value: sumBetween(new Date(y, 0, 1), new Date(y, 11, 31)),
    };
  });
}

/** Sparkline dos últimos 30 dias (jobs concluídos + receitas). */
export function last30DaysSpark(
  jobs: Job[],
  receitas: ReceitaAvulsa[],
  ref = new Date()
): number[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(ref);
    d.setDate(d.getDate() - (29 - i));
    const ds = localKey(d);
    const jobV = jobs
      .filter((j) => isConcluido(j) && j.data === ds)
      .reduce((s, j) => s + j.valor, 0);
    const recV = receitas
      .filter((r) => r.data === ds)
      .reduce((s, r) => s + r.valor, 0);
    return jobV + recV;
  });
}

export interface Projection {
  /** Já construído este mês (jobs concluídos). */
  earned: number;
  /** Meta mensal, se definida. */
  meta: number | null;
  /** Falta para a meta (>= 0), se houver meta. */
  remaining: number | null;
  /** % da meta alcançada (0–100), se houver meta. */
  pct: number | null;
  /** Ritmo diário observado no mês (earned / dias decorridos). */
  dailyPace: number;
  /** Projeção de fechamento do mês mantido o ritmo. */
  projectedMonthEnd: number;
  /** Fração do preenchimento da barra (0–1): rumo à meta, ou ao projetado. */
  barFraction: number;
  /** Dia estimado em que atinge a meta no ritmo atual (ou null). */
  metaEta: Date | null;
  /** Nome do mês corrente ("julho"). */
  monthLabel: string;
  /** Ainda não há dado real este mês (empty state que ensina). */
  isEmpty: boolean;
}

/**
 * Motor de projeção viva — o coração da Home. Converte o que ela já registrou
 * numa leitura empoderadora: "no seu ritmo você chega em X" e/ou "faltam X".
 * Usa apenas dados existentes (jobs concluídos + meta mensal).
 */
export function monthProjection(
  jobs: Job[],
  metas: Meta[],
  ref = new Date()
): Projection {
  const earned = monthEarnings(jobs, ref);
  const meta = monthMeta(metas);

  const daysInMonth = new Date(
    ref.getFullYear(),
    ref.getMonth() + 1,
    0
  ).getDate();
  const dayOfMonth = ref.getDate();
  const dailyPace = earned / dayOfMonth;
  const projectedMonthEnd = Math.round(dailyPace * daysInMonth);

  const remaining = meta !== null ? Math.max(0, meta - earned) : null;
  const pct =
    meta !== null && meta > 0 ? Math.min(100, (earned / meta) * 100) : null;

  // ETA: em quantos dias, no ritmo atual, ela alcança a meta.
  let metaEta: Date | null = null;
  if (meta !== null && remaining !== null && remaining > 0 && dailyPace > 0) {
    const daysNeeded = Math.ceil(remaining / dailyPace);
    const eta = new Date(ref);
    eta.setDate(eta.getDate() + daysNeeded);
    metaEta = eta;
  }

  // Barra: rumo à meta se houver; senão, preenchimento do mês projetado.
  let barFraction: number;
  if (meta !== null && meta > 0) {
    barFraction = Math.min(1, earned / meta);
  } else if (projectedMonthEnd > 0) {
    barFraction = Math.min(1, earned / projectedMonthEnd);
  } else {
    barFraction = 0;
  }

  return {
    earned,
    meta,
    remaining,
    pct,
    dailyPace,
    projectedMonthEnd,
    barFraction,
    metaEta,
    monthLabel: ref.toLocaleDateString("pt-BR", { month: "long" }),
    isEmpty: earned === 0,
  };
}
