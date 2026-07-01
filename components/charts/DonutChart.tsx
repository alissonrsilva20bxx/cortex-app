interface Segment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: Segment[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({
  segments,
  size = 140,
  centerLabel,
  centerValue,
}: Props) {
  const total = segments.reduce((s, g) => s + g.value, 0);
  if (total === 0) return null;

  const r = 40;
  const cx = 50;
  const cy = 50;
  const circ = 2 * Math.PI * r;
  const strokeW = 10;

  let offset = 0;
  const slices = segments.map((seg) => {
    const frac = seg.value / total;
    const dash = frac * circ;
    const gap = circ - dash;
    const rotation = offset * 360 - 90;
    offset += frac;
    return { ...seg, dash, gap, rotation, frac };
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {/* track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={strokeW}
        />
        {/* slices */}
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeW}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-(s.rotation / 360) * circ}
            strokeLinecap="butt"
            style={{
              filter: `drop-shadow(0 0 3px ${s.color}88)`,
              transformOrigin: "50% 50%",
            }}
          />
        ))}
        {/* center text */}
        {centerValue && (
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="var(--text)"
            fontFamily="system-ui, sans-serif"
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x={cx}
            y={cy + 9}
            textAnchor="middle"
            fontSize="6"
            fill="var(--text-muted)"
            fontFamily="system-ui, sans-serif"
          >
            {centerLabel}
          </text>
        )}
      </svg>

      {/* legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 12px",
          justifyContent: "center",
          maxWidth: size * 1.6,
        }}
      >
        {slices
          .filter((s) => s.value > 0)
          .map((s, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: s.color,
                  boxShadow: `0 0 5px ${s.color}88`,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {s.label} ({s.value})
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
