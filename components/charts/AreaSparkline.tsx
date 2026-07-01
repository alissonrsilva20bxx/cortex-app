interface Props {
  data: number[];
  height?: number;
  id?: string;
}

export function AreaSparkline({ data, height = 48, id = "spark" }: Props) {
  if (data.length < 2) return null;

  const w = 100;
  const h = height;
  const max = Math.max(...data, 0.01);
  const padT = 4;
  const padB = 2;
  const usableH = h - padT - padB;

  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: padT + usableH - (v / max) * usableH,
  }));

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  const gradId = `sg-${id}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            style={{ stopColor: "var(--accent)", stopOpacity: 0.4 }}
          />
          <stop
            offset="100%"
            style={{ stopColor: "var(--accent)", stopOpacity: 0.02 }}
          />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* last point dot */}
      <circle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        r="2.5"
        fill="var(--accent)"
        style={{ filter: "drop-shadow(0 0 4px var(--accent))" }}
      />
    </svg>
  );
}
