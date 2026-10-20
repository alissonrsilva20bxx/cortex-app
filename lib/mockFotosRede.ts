/**
 * Fotos de EXEMPLO dos posts da Rede no laboratório (/dev-preview/app):
 * desenhos em SVG local, nunca Storage, no tamanho nativo de cada foto (o
 * que o feed usa para escolher o formato). O assunto fica sempre num
 * quadrado central -- a área segura -- então nada importante sai quando o
 * feed recorta as bordas. Cenas neutras e sem pessoas (o público da Rede
 * pede discrição): viagem, praia, cidade à noite, jantar, hotel e café.
 */

export type TemaFoto =
  | "viagem"
  | "praia"
  | "cidade"
  | "jantar"
  | "hotel"
  | "cafe";

const FUNDOS: Record<TemaFoto, [string, string, string]> = {
  viagem: ["#9fd3ff", "#cfe3ff", "#ffd9b0"],
  praia: ["#7cc8f2", "#2f8fc9", "#f3d9a4"],
  cidade: ["#120f2e", "#2a2160", "#3b2a6b"],
  jantar: ["#5a2a3c", "#3a1a28", "#24101a"],
  hotel: ["#bfe3ff", "#d8eeff", "#e8f4ff"],
  cafe: ["#f6e3cf", "#e6c6a3", "#d8b48f"],
};

function sujeito(tema: TemaFoto, cx: number, cy: number, k: number): string {
  const g = (conteudo: string) =>
    `<g transform="translate(${cx},${cy}) scale(${k})">${conteudo}</g>`;
  if (tema === "viagem") {
    return g(
      '<circle cx="110" cy="-110" r="46" fill="#ffe9a8"/><path d="M-200 160 L-70 -40 L20 90 L90 0 L200 160 Z" fill="#5b7fb8"/><path d="M-200 200 V140 Q-60 90 60 150 T200 130 V200 Z" fill="#3d5f8f"/>'
    );
  }
  if (tema === "praia") {
    const ondas = [0, 1, 2, 3]
      .map(
        (i) =>
          `<path d="M-200 ${20 + i * 34} Q-100 ${2 + i * 34} 0 ${20 + i * 34} T200 ${20 + i * 34}" stroke="#fff" stroke-width="9" fill="none" opacity="${0.7 - i * 0.12}" stroke-linecap="round"/>`
      )
      .join("");
    return g(
      `<circle cx="0" cy="-90" r="60" fill="#fff3c4"/>${ondas}<path d="M-200 200 V150 Q0 110 200 155 V200 Z" fill="#f3d9a4"/>`
    );
  }
  if (tema === "cidade") {
    const predios = [
      [-190, -40, 70],
      [-110, -120, 80],
      [-20, -10, 64],
      [50, -150, 80],
      [140, -60, 60],
    ]
      .map(([x, y, w]) => {
        let janelas = "";
        for (let yy = y + 18; yy < 180; yy += 34)
          for (let xx = x + 14; xx < x + w - 12; xx += 22)
            if ((xx * yy) % 5 !== 0)
              janelas += `<rect x="${xx}" y="${yy}" width="10" height="14" rx="2" fill="#ffd57a" opacity=".85"/>`;
        return `<rect x="${x}" y="${y}" width="${w}" height="${200 - y}" rx="6" fill="#1d1b3a"/>${janelas}`;
      })
      .join("");
    return g(`<circle cx="130" cy="-170" r="22" fill="#fff6d6"/>${predios}`);
  }
  if (tema === "jantar") {
    const taca = (x: number) =>
      `<path d="M${x - 26} -80h52l-8 64a18 18 0 0 1-36 0z" fill="#f7d6e0" opacity=".9"/><path d="M${x} 2v70M${x - 22} 74h44" stroke="#f7d6e0" stroke-width="8" stroke-linecap="round"/>`;
    return g(
      `<rect x="-200" y="80" width="400" height="120" fill="#3b1f2b"/>${taca(-70)}${taca(70)}<rect x="-10" y="20" width="20" height="60" rx="6" fill="#fff4dc"/><path d="M0 -10q-12 16 0 26q12-10 0-26z" fill="#ffc35a"/><circle cx="0" cy="6" r="40" fill="#ffc35a" opacity=".16"/>`
    );
  }
  if (tema === "hotel") {
    let janelas = "";
    for (let y = -110; y < 100; y += 44)
      for (let x = -70; x < 70; x += 44)
        janelas += `<rect x="${x}" y="${y}" width="26" height="26" rx="5" fill="#7fb2d9"/>`;
    return g(
      `<rect x="-95" y="-160" width="190" height="360" rx="10" fill="#f4efe6"/><rect x="-95" y="-160" width="190" height="28" fill="#d9cdb8"/>${janelas}<rect x="-26" y="120" width="52" height="80" rx="6" fill="#8a6a4a"/><path d="M150 200V60M150 60q-36-8-50 22M150 60q36-14 50 14M150 60q-14-36-44-36M150 60q22-32 48-28" stroke="#2f6b4a" stroke-width="12" fill="none" stroke-linecap="round"/>`
    );
  }
  return g(
    '<ellipse cx="0" cy="140" rx="150" ry="30" fill="#e9d8c4"/><path d="M-90 0h170v70a75 75 0 0 1-75 75h-20a75 75 0 0 1-75-75z" fill="#fff"/><path d="M80 24h20a32 32 0 0 1 0 64h-24" stroke="#fff" stroke-width="16" fill="none"/><ellipse cx="-5" cy="0" rx="85" ry="16" fill="#7a4a2a"/><path d="M-40 -40q-20-30 0-56M0 -34q-20-30 0-62M40 -40q-20-30 0-56" stroke="#fff" stroke-width="9" fill="none" opacity=".6" stroke-linecap="round"/>'
  );
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
