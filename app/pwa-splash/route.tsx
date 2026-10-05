import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Tela de abertura do PWA no iOS (`apple-touch-startup-image`). Sem ela, o
 * iPhone mostra um retângulo BRANCO entre tocar no ícone e o app pintar —
 * o sinal mais óbvio de "site salvo na tela de início". Mesma arte do
 * ícone (/pwa-icon) centrada no fundo escuro do app, então a abertura
 * emenda direto na primeira tela. Tamanhos vêm das media queries em
 * app/layout.tsx (pixels físicos de cada iPhone, retrato).
 */
export async function GET(request: NextRequest) {
  const clamp = (value: string | null, fallback: number) =>
    Math.min(3000, Math.max(320, parseInt(value ?? "", 10) || fallback));
  const width = clamp(request.nextUrl.searchParams.get("w"), 1179);
  const height = clamp(request.nextUrl.searchParams.get("h"), 2556);

  const mark = Math.round(width * 0.26);
  const glow = Math.round(mark * 1.9);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000000",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: `${glow}px`,
          height: `${glow}px`,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(255,45,120,0.30) 0%, transparent 68%)",
          display: "flex",
        }}
      />
      <div
        style={{
          width: `${mark}px`,
          height: `${mark}px`,
          borderRadius: `${Math.round(mark * 0.22)}px`,
          background: "#14000c",
          border: `${Math.max(2, Math.round(mark * 0.012))}px solid rgba(255,45,120,0.28)`,
          boxShadow: "0 0 60px rgba(255,45,120,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <span
          style={{
            fontSize: `${Math.round(mark * 0.52)}px`,
            fontWeight: 800,
            color: "#ff2d78",
            fontFamily: "sans-serif",
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          J
        </span>
      </div>
    </div>,
    {
      width,
      height,
      headers: { "Cache-Control": "public, max-age=604800, immutable" },
    }
  );
}
