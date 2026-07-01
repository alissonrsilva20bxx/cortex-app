import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const size = Math.min(
    512,
    Math.max(
      16,
      parseInt(request.nextUrl.searchParams.get("size") ?? "512", 10)
    )
  );

  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.52);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0007",
        borderRadius: `${radius}px`,
      }}
    >
      {/* Neon glow layer */}
      <div
        style={{
          position: "absolute",
          width: `${size * 0.6}px`,
          height: `${size * 0.6}px`,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(255,45,120,0.35) 0%, transparent 70%)",
          display: "flex",
        }}
      />
      {/* Letter */}
      <span
        style={{
          fontSize: `${fontSize}px`,
          fontWeight: 800,
          color: "#ff2d78",
          fontFamily: "sans-serif",
          letterSpacing: "-0.04em",
          lineHeight: 1,
          position: "relative",
        }}
      >
        J
      </span>
    </div>,
    { width: size, height: size }
  );
}
