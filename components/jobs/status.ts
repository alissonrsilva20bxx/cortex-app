import type { JobStatus } from "@/lib/types";

/**
 * Fonte única das cores e rótulos de status de atendimento.
 * Antes redeclarado em 3 lugares (JobsTab, JobCard, StatusBadge) com hex
 * hardcoded. Agora consome os tokens semânticos: uma cor por significado,
 * adapta ao modo claro. `rgb` é a tripla para montar fills/glows com alpha.
 */
export const STATUS_META: Record<
  JobStatus,
  { label: string; color: string; rgb: string }
> = {
  agendado: { label: "Agendado", color: "var(--info)", rgb: "var(--info-rgb)" },
  confirmado: {
    label: "Confirmado",
    color: "var(--success)",
    rgb: "var(--success-rgb)",
  },
  concluído: {
    label: "Concluído",
    color: "var(--accent)",
    rgb: "var(--accent-rgb)",
  },
  cancelado: {
    label: "Cancelado",
    color: "var(--danger)",
    rgb: "var(--danger-rgb)",
  },
};
