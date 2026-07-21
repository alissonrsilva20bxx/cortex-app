import type { JobStatus } from "@/lib/types";
import { STATUS_META } from "./status";

export function StatusBadge({ status }: { status: JobStatus }) {
  const { label, color, rgb } = STATUS_META[status];
  return (
    <span
      className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
      style={{
        background: `rgb(${rgb} / 0.1)`,
        color,
        boxShadow: `0 0 8px rgb(${rgb} / 0.35)`,
        border: `1px solid rgb(${rgb} / 0.25)`,
      }}
    >
      {label}
    </span>
  );
}
