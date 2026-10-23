import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { svgAbertura } from "@/lib/marcaArcelle";

export const runtime = "edge";

/**
 * Tela de abertura do PWA no iOS (`apple-touch-startup-image`). Sem ela, o
 * iPhone mostra um retângulo BRANCO entre tocar no ícone e o app pintar —
 * o sinal mais óbvio de "site salvo na tela de início". É a abertura da
 * arte-final da Arcelle (símbolo com brilho e o nome, no fundo Noite),
 * montada no tamanho de cada iPhone. Tamanhos vêm das media queries em
 * app/layout.tsx (pixels físicos de cada iPhone, retrato).
 */
export async function GET(request: NextRequest) {
  const clamp = (value: string | null, fallback: number) =>
    Math.min(3000, Math.max(320, parseInt(value ?? "", 10) || fallback));
  const width = clamp(request.nextUrl.searchParams.get("w"), 1179);
  const height = clamp(request.nextUrl.searchParams.get("h"), 2556);

  const svg = svgAbertura(width, height);

  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
      width={width}
      height={height}
      alt=""
    />,
    {
      width,
      height,
      headers: { "Cache-Control": "public, max-age=604800, immutable" },
    }
  );
}
