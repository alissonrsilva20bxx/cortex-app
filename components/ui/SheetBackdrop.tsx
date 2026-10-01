"use client";

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Véu escuro dos sheets "artesanais" (JobForm, DespesaForm, ReceitaForm,
 * MetaForm), que não usam o BottomSheet. Antes eles montavam o véu com
 * `{open && <div/>}` — surgia e sumia seco num frame enquanto o painel
 * deslizava em 300ms. Aqui fica sempre montado e faz fade junto com o
 * painel, igual ao véu do BottomSheet; `visibility` só desliga depois do
 * fade de saída, então não intercepta toque fechado.
 */
export function SheetBackdrop({
  open,
  onClose,
  className,
}: {
  open: boolean;
  onClose: () => void;
  /** Classe de z-index do véu (ex.: "z-50", "z-[200]"). */
  className: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 ${className}`}
      style={{
        background: "rgba(0, 0, 0, 0.62)",
        opacity: open ? 1 : 0,
        visibility: open ? "visible" : "hidden",
        pointerEvents: open ? "auto" : "none",
        transition: open
          ? `opacity 300ms ${EASE}, visibility 0s linear 0s`
          : `opacity 300ms ${EASE}, visibility 0s linear 300ms`,
      }}
      onClick={onClose}
    />
  );
}
