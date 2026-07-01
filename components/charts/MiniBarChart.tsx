interface DataPoint {
  label: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  height?: number;
  showLabels?: boolean;
  id?: string;
}

export function MiniBarChart({
  data,
  height = 110,
  showLabels = true,
  id = "mbc",
}: Props) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 0.01);
  const labelH = showLabels ? 18 : 0;
  const barAreaH = height - labelH;
  const barW = 0.55;
  const gap = (1 - barW) / 2;
  const colW = 100 / data.length;
  const gradId = `mb-grad-${id}`;
  const glowId = `mb-glow-${id}`;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            style={{ stopColor: "var(--accent)", stopOpacity: 0.95 }}
          />
          <stop
            offset="100%"
            style={{ stopColor: "var(--accent)", stopOpacity: 0.45 }}
          />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* subtle grid lines */}
      {[0.25, 0.5, 0.75].map((pct) => (
        <line
          key={pct}
          x1="0"
          y1={barAreaH * (1 - pct)}
          x2="100"
          y2={barAreaH * (1 - pct)}
          stroke="var(--border-color)"
          strokeWidth="0.4"
        />
      ))}

      {data.map((d, i) => {
        const x = colW * i + colW * gap;
        const bw = colW * barW;
        const bh = (d.value / max) * barAreaH;
        const y = barAreaH - bh;

        return (
          <g key={i}>
            {/* background track */}
            <rect
              x={x}
              y={0}
              width={bw}
              height={barAreaH}
              rx={2}
              fill="var(--accent)"
              fillOpacity={0.05}
            />
            {/* bar */}
            {bh > 0 && (
              <rect
                x={x}
                y={y}
                width={bw}
                height={bh}
                rx={2}
                fill={`url(#${gradId})`}
                filter={`url(#${glowId})`}
              />
            )}
            {/* label */}
            {showLabels && (
              <text
                x={x + bw / 2}
                y={height - 3}
                textAnchor="middle"
                fontSize="5.5"
                fill="var(--text-muted)"
                fontFamily="system-ui, sans-serif"
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
