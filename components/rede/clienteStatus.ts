import type { ClienteStatus } from "@/lib/mockRede";

/** Mesma lógica de lib/jobs/status.ts — uma cor por significado, com uma
 * tripla própria só onde não existe token semântico (igual ao "pessoal" do
 * Cofre). */
export const CLIENTE_STATUS_META: Record<
  ClienteStatus,
  { label: string; rgb: string }
> = {
  ativo: { label: "Ativo", rgb: "var(--success-rgb)" },
  vip: { label: "VIP", rgb: "var(--accent-rgb)" },
  "em-negociacao": { label: "Em negociação", rgb: "var(--warning-rgb)" },
  pausado: { label: "Pausado", rgb: "160 160 170" },
};
