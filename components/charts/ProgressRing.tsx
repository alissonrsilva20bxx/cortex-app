interface Props {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  valueLabel?: string;
}

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 7,
  label,
  valueLabel,
}: Props) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(1, progress / 100) * circ;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden
      >
        {/* track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={strokeWidth}
        />
        {/* progress arc */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          style={{
            filter: "drop-shadow(0 0 4px var(--accent))",
            transition: "stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </svg>

      {valueLabel && (
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent)",
            textAlign: "center",
            lineHeight: 1,
            marginTop: -2,
          }}
        >
          {valueLabel}
        </p>
      )}
      {label && (
        <p
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          {label}
        </p>
      )}
    </div>
  );
}
