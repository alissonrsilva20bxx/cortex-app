import { type NextRequest } from "next/server";

/**
 * Fixture de imagem só pro preview isolado da Rede (`/dev-preview/rede`) --
 * gera um SVG colorido nas dimensões pedidas. Serve pra revisar a
 * apresentação de fotos no feed com REQUISIÇÕES DE REDE de verdade
 * (observáveis no painel Network), ao contrário de `data:` URIs, que o
 * navegador nunca adia com `loading="lazy"`.
 *
 * Não é dado de produção nem escreve nada. Rota sob `/dev-preview`,
 * isenta no middleware.
 */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const w = Math.min(4000, Math.max(1, Number(p.get("w")) || 1080));
  const h = Math.min(4000, Math.max(1, Number(p.get("h")) || 1080));
  const cor = (p.get("c") || "8b5cf6").replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
  const rotulo = (p.get("t") || `${w}x${h}`).replace(/[<>&]/g, "").slice(0, 24);
  const fs = Math.round(Math.min(w, h) / 6);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="100%" height="100%" fill="#${cor || "8b5cf6"}"/>` +
    `<text x="50%" y="50%" fill="#fff" font-family="sans-serif" font-weight="700" font-size="${fs}" text-anchor="middle" dominant-baseline="central">${rotulo}</text>` +
    `</svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      // sem cache: cada carga é uma requisição nova, fácil de observar
      "cache-control": "no-store",
    },
  });
}
