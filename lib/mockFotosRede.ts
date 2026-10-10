/**
 * Fotos de EXEMPLO dos posts da Rede no laboratório (/dev-preview/app):
 * desenhos em SVG local, nunca Storage, no tamanho nativo de cada foto (o
 * que o feed usa para escolher o formato). O assunto fica sempre num
 * quadrado central -- a área segura -- então nada importante sai quando o
 * feed recorta as bordas. Mesmos temas da proposta (feed-rede.html):
 * unhas, cabelo, estúdio, antes/depois e cores.
 */

export type TemaFoto =
  | "unhas"
  | "antes"
  | "depois"
  | "cabelo"
  | "studio"
  | "cores";

const FUNDOS: Record<TemaFoto, [string, string, string]> = {
  unhas: ["#ffd1e2", "#ff80ab", "#a30c47"],
  antes: ["#e7e2ea", "#b8aec0", "#5d5168"],
  depois: ["#ffd9e8", "#ff4f93", "#7a0f3c"],
  cabelo: ["#ffe3c4", "#e98d5a", "#6b2b16"],
  studio: ["#d9e7ff", "#9fb6f2", "#3b3f8f"],
  cores: ["#fff0c2", "#ffb3cf", "#b38cff"],
};

function sujeito(tema: TemaFoto, cx: number, cy: number, k: number): string {
  if (tema === "unhas" || tema === "antes" || tema === "depois") {
    const cor =
      tema === "antes" ? "#d8ccd6" : tema === "depois" ? "#ff2d78" : "#ffffff";
    const unhas = [
      [-52, -118],
      [8, -150],
      [66, -130],
      [112, -82],
    ]
      .map(
        ([x, y]) =>
          `<rect x="${x - 13}" y="${y - 6}" width="26" height="40" rx="13" fill="${cor}"${tema !== "antes" ? ' stroke="rgba(255,255,255,.6)" stroke-width="3"' : ""}/>`
      )
      .join("");
    const brilhos =
      tema === "antes"
        ? ""
        : `<g fill="#fff" opacity=".9">${[
            [cx - 150 * k, cy - 120 * k],
            [cx + 150 * k, cy - 100 * k],
            [cx + 120 * k, cy + 120 * k],
          ]
            .map(
              ([x, y]) =>
                `<path transform="translate(${x},${y}) scale(${k})" d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4Z"/>`
            )
            .join("")}</g>`;
    return `<g transform="translate(${cx},${cy + 30 * k}) scale(${k})"><path d="M-120 140 Q-130 20 -95 -40 L-70 -120 Q-55 -150 -35 -120 L-20 -40 L-5 -150 Q10 -180 28 -150 L35 -40 L50 -135 Q65 -160 80 -130 L80 -30 L100 -90 Q115 -110 125 -85 L118 40 Q110 120 60 150 Z" fill="#f6d2c0" opacity=".96"/>${unhas}</g>${brilhos}`;
  }
  if (tema === "cabelo") {
    return `<g transform="translate(${cx},${cy + 10 * k}) scale(${k})"><path d="M-120 160 Q-150 -40 -60 -120 Q0 -165 60 -120 Q150 -40 120 160 Z" fill="#6b2b16"/><ellipse cx="0" cy="-20" rx="70" ry="88" fill="#f3c9a8"/><path d="M-78 -40 Q-60 -140 10 -120 Q80 -110 80 -20 Q40 -90 -78 -40Z" fill="#7a3518"/><path d="M-110 160 Q-40 120 0 120 Q40 120 110 160 Z" fill="#ff2d78"/></g>`;
  }
  if (tema === "studio") {
    return `<g transform="translate(${cx},${cy}) scale(${k})"><rect x="-150" y="-110" width="120" height="150" rx="60" fill="#ffffff" opacity=".85"/><rect x="-140" y="-100" width="100" height="130" rx="50" fill="#bcd0ff"/><rect x="10" y="-20" width="130" height="70" rx="20" fill="#ff2d78"/><rect x="20" y="40" width="20" height="70" fill="#3b3f8f"/><rect x="110" y="40" width="20" height="70" fill="#3b3f8f"/><circle cx="-170" cy="70" r="26" fill="#2f8a52"/><rect x="-180" y="85" width="20" height="40" fill="#8a5a3a"/><rect x="-200" y="125" width="400" height="8" rx="4" fill="#3b3f8f" opacity=".5"/></g>`;
  }
  return `<g transform="translate(${cx},${cy}) scale(${k})">${[
    ["#ff2d78", -90],
    ["#b38cff", 0],
    ["#ffb000", 90],
  ]
    .map(
      ([cl, x]) =>
        `<rect x="${Number(x) - 30}" y="-110" width="60" height="150" rx="14" fill="${cl}"/><rect x="${Number(x) - 18}" y="40" width="36" height="70" rx="8" fill="#ffffff" opacity=".9"/>`
    )
    .join("")}</g>`;
}

/** A foto de exemplo `tema` em `largura`×`altura` (o tamanho nativo), como
 * SVG. O desenho cabe num quadrado de 80% do lado menor, no centro. */
export function fotoExemploSvg(
  tema: TemaFoto,
  largura: number,
  altura: number
): string {
  const [a, b, c] = FUNDOS[tema];
  const k = (Math.min(largura, altura) * 0.8) / 400;
  const id = `g-${tema}-${largura}x${altura}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><rect width="${largura}" height="${altura}" fill="url(#${id})"/>${sujeito(tema, largura / 2, altura / 2, k)}</svg>`;
}

/** Data URI da foto de exemplo (vai no `blobUrl` do arquivo do Storage
 * mockado: a "URL assinada" do laboratório). */
export function fotoExemploUri(
  tema: TemaFoto,
  largura: number,
  altura: number
): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fotoExemploSvg(tema, largura, altura))}`;
}
