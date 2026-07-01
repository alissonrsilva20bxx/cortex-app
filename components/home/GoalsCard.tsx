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
  if (metas.length === 0) return null;

  return (
    <div className="glass-card rounded-[22px] p-5">
      <p className="section-label mb-5">Metas</p>

      <div className="flex flex-col gap-5">
        {metas.map((meta) => {
          const current = calcProgress(jobs, meta.periodo);
          const pct = Math.min(100, (current / meta.valorAlvo) * 100);
          const done = pct >= 100;

          return (
            <div key={meta.periodo}>
              <div className="flex items-baseline justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="font-semibold"
                    style={{
                      fontSize: "13px",
                      color: "var(--text-2, var(--text))",
                    }}
                  >
                    {LABELS[meta.periodo]}
                  </span>
                  {done && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-px rounded-full"
                      style={{
                        background: "rgb(var(--accent-rgb) / 0.15)",
                        color: "var(--accent)",
                        border: "1px solid rgb(var(--accent-rgb) / 0.3)",
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="tabular-nums font-bold text-[11px]"
                    style={{
                      color: done ? "var(--accent)" : "var(--text-muted)",
                    }}
                  >
                    {Math.round(pct)}%
                  </span>
                  <span
                    className="tabular-nums font-medium"
                    style={{ fontSize: "11px", color: "var(--text-muted)" }}
                  >
                    {formatBRL(current)}&nbsp;/&nbsp;{formatBRL(meta.valorAlvo)}
                  </span>
                </div>
              </div>

              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
