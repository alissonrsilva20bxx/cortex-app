import type { JobStatus } from "@/lib/types";

const CONFIG: Record<JobStatus, { label: string; bg: string; color: string }> =
  {
    agendado: {
      label: "Agendado",
      bg: "rgba(100,180,255,0.12)",
      color: "#64b4ff",
    },
    confirmado: {
      label: "Confirmado",
      bg: "rgba(80,220,120,0.12)",
      color: "#50dc78",
    },
    concluído: {
      label: "Concluído",
      bg: "rgb(var(--accent-rgb) / 0.13)",
      color: "var(--accent)",
    },
    cancelado: {
      label: "Cancelado",
      bg: "rgba(255,80,80,0.12)",
      color: "#ff5050",
    },
  };

export function StatusBadge({ status }: { status: JobStatus }) {
  const { label, bg, color } = CONFIG[status];
  return (
    <span
      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}
