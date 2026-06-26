import type { Job, Meta, PeriodoMeta } from "@/lib/types";

interface Props {
  jobs: Job[];
  metas: Meta[];
}

function calcProgress(jobs: Job[], periodo: PeriodoMeta): number {
  const now = new Date();
  return jobs
    .filter((j) => {
      if (j.status !== "concluído") return false;
      const d = new Date(j.data + "T00:00:00");
      if (periodo === "dia") return d.toDateString() === now.toDateString();
      if (periodo === "mes")
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      return d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, j) => sum + j.valor, 0);
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

const LABELS: Record<PeriodoMeta, string> = {
  dia: "Hoje",
  mes: "Este mês",
  ano: "Este ano",
};

export function GoalsCard({ jobs, metas }: Props) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-color)",
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        Metas
      </p>

      <div className="flex flex-col gap-4">
        {metas.map((meta) => {
          const current = calcProgress(jobs, meta.periodo);
          const pct = Math.min(100, (current / meta.valorAlvo) * 100);

          return (
            <div key={meta.periodo}>
              <div className="flex items-baseline justify-between mb-2">
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--text)" }}
                >
                  {LABELS[meta.periodo]}
                </span>
                <span
                  className="text-xs tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatBRL(current)}&nbsp;/&nbsp;{formatBRL(meta.valorAlvo)}
                </span>
              </div>

              {/* iOS-style progress bar */}
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: "rgb(var(--accent-rgb) / 0.12)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background:
                      "linear-gradient(90deg, var(--accent), var(--accent-soft))",
                    transition: "width 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
