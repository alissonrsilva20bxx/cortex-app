"use client";

/**
 * Toggle único (trilho + botão deslizante). Substitui as cópias inline
 * do toggle reinventado (Ajustes → Tela Inicial) e o `<input type=checkbox>`
 * decorativo da aba Nuvem. Só o controle; a fileira com rótulo/descrição
 * se compõe com <ListRow> ou markup local.
 */

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Switch({ checked, onChange, disabled, ariaLabel }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative rounded-full transition-all duration-300 shrink-0 disabled:opacity-40"
      style={{
        width: 42,
        height: 24,
        background: checked ? "var(--accent)" : "var(--surface-2)",
        boxShadow: checked ? "var(--glow-sm)" : "none",
        border: "1px solid var(--border-color)",
      }}
    >
      <span
        className="absolute top-0.5 rounded-full bg-white transition-all duration-300"
        style={{ width: 18, height: 18, left: checked ? "20px" : "2px" }}
      />
    </button>
  );
}
