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
    <div className="glass-card rounded-[22px] p-5">
      <p className="section-label mb-5">Metas</p>

      <div className="flex flex-col gap-5">
        {metas.map((meta) => {
          const current = calcProgress(jobs, meta.periodo);
          const pct = Math.min(100, (current / meta.valorAlvo) * 100);

          return (
            <div key={meta.periodo}>
              <div className="flex items-baseline justify-between mb-2.5">
                <span
                  className="font-semibold"
                  style={{
                    fontSize: "13px",
                    color: "var(--text-2, var(--text))",
                  }}
                >
                  {LABELS[meta.periodo]}
                </span>
                <span
                  className="tabular-nums font-medium"
                  style={{ fontSize: "11.5px", color: "var(--text-muted)" }}
                >
                  {formatBRL(current)}&nbsp;/&nbsp;{formatBRL(meta.valorAlvo)}
                </span>
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
