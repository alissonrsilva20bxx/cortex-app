import type { JobStatus } from "@/lib/types";

const CONFIG: Record<
  JobStatus,
  { label: string; bg: string; color: string; glow: string; border: string }
> = {
  agendado: {
    label: "Agendado",
    bg: "rgba(100,180,255,0.1)",
    color: "#64b4ff",
    glow: "0 0 8px rgba(100,180,255,0.35)",
    border: "1px solid rgba(100,180,255,0.25)",
  },
  confirmado: {
    label: "Confirmado",
    bg: "rgba(80,220,120,0.1)",
    color: "#50dc78",
    glow: "0 0 8px rgba(80,220,120,0.35)",
    border: "1px solid rgba(80,220,120,0.25)",
  },
  concluído: {
    label: "Concluído",
    bg: "rgb(var(--accent-rgb) / 0.1)",
    color: "var(--accent)",
    glow: "0 0 8px rgb(var(--accent-rgb) / 0.35)",
    border: "1px solid rgb(var(--accent-rgb) / 0.25)",
  },
  cancelado: {
    label: "Cancelado",
    bg: "rgba(255,80,80,0.1)",
    color: "#ff5050",
    glow: "0 0 8px rgba(255,80,80,0.3)",
    border: "1px solid rgba(255,80,80,0.22)",
  },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const { label, bg, color, glow, border } = CONFIG[status];
  return (
    <span
      className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
      style={{ background: bg, color, boxShadow: glow, border }}
    >
      {label}
    </span>
  );
}
