/**
 * Processamento de foto no cliente, ANTES de publicar (chamado do
 * PostComposer ao escolher o arquivo). Produz duas imagens JPEG:
 *
 *   - principal: maior lado <= 1280 px, <= 150 KB
 *   - miniatura: maior lado <=  400 px, <=  30 KB
 *
 * Reencodar via <canvas> remove TODO metadado (EXIF/GPS/XMP/orientação) por
 * construção -- por isso a orientação da câmera precisa ser "assada" no
 * pixel ANTES (createImageBitmap com imageOrientation: "from-image").
 *
 * Se não for possível chegar no orçamento de bytes nem reduzindo dimensão,
 * a função LANÇA -- quem chama rejeita o arquivo e não publica. Nunca cai
 * pro arquivo original.
 *
 * Só roda no navegador (usa createImageBitmap / OffscreenCanvas / canvas).
 */

export const FOTO_PRINCIPAL_MAX_LADO = 1280;
export const FOTO_PRINCIPAL_MAX_BYTES = 150 * 1024;
export const FOTO_MINIATURA_MAX_LADO = 400;
export const FOTO_MINIATURA_MAX_BYTES = 30 * 1024;

export type FotoProcessada = {
  /** JPEG <= 1280 px / <= 150 KB, sem metadados. */
  principal: Blob;
  /** JPEG <= 400 px / <= 30 KB, sem metadados. */
  miniatura: Blob;
  largura: number;
  altura: number;
};

export class FotoInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FotoInvalidaError";
  }
}

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function carregarBitmap(file: File): Promise<ImageBitmap> {
  // "from-image" aplica a orientação EXIF no pixel. Nem todo engine aceita
  // a opção -- no fallback, engines modernos (iOS Safari 15+, Chrome 90+)
  // já aplicam a orientação sozinhos ao decodificar um File.
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

function dimensionar(
  larguraOrig: number,
  alturaOrig: number,
  maxLado: number
): { largura: number; altura: number } {
  const maior = Math.max(larguraOrig, alturaOrig);
  if (maior <= maxLado) {
    return { largura: larguraOrig, altura: alturaOrig };
  }
  const escala = maxLado / maior;
  return {
    largura: Math.max(1, Math.round(larguraOrig * escala)),
    altura: Math.max(1, Math.round(alturaOrig * escala)),
  };
}

function criarCanvas(
  largura: number,
  altura: number
): {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  toBlob: (q: number) => Promise<Blob>;
} {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(largura, altura);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new FotoInvalidaError("canvas 2d indisponível");
    return {
      ctx,
      toBlob: (q) => canvas.convertToBlob({ type: "image/jpeg", quality: q }),
    };
  }
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new FotoInvalidaError("canvas 2d indisponível");
  return {
    ctx,
    toBlob: (q) =>
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new FotoInvalidaError("toBlob vazio")),
          "image/jpeg",
          q
        )
      ),
  };
}

async function renderizar(
  bitmap: ImageBitmap,
  ladosCandidatos: number[],
  qualidades: number[],
  maxBytes: number,
  rotulo: string
): Promise<{ blob: Blob; largura: number; altura: number }> {
  for (const maxLado of ladosCandidatos) {
    const { largura, altura } = dimensionar(
      bitmap.width,
      bitmap.height,
      maxLado
    );
    const { ctx, toBlob } = criarCanvas(largura, altura);
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    for (const q of qualidades) {
      const blob = await toBlob(q);
      if (blob.size <= maxBytes) {
        return { blob, largura, altura };
      }
    }
  }
  throw new FotoInvalidaError(
    `não foi possível comprimir a ${rotulo} para <= ${Math.round(maxBytes / 1024)} KB`
  );
}

export async function processarFotoParaPost(
  file: File
): Promise<FotoProcessada> {
  if (!TIPOS_ACEITOS.includes(file.type)) {
    throw new FotoInvalidaError(
      `tipo não suportado: ${file.type || "desconhecido"}`
    );
  }
  // teto sensato de entrada -- acima disso o decode do navegador pode
  // travar o dispositivo; 30 MB cobre foto de celular sobrando.
  if (file.size > 30 * 1024 * 1024) {
    throw new FotoInvalidaError("arquivo grande demais (acima de 30 MB)");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await carregarBitmap(file);
  } catch {
    throw new FotoInvalidaError("não foi possível ler a imagem");
  }

  try {
    const principal = await renderizar(
      bitmap,
      [FOTO_PRINCIPAL_MAX_LADO, 1080, 920, 800],
      [0.82, 0.74, 0.66, 0.58, 0.5, 0.42],
      FOTO_PRINCIPAL_MAX_BYTES,
      "imagem principal"
    );
    const miniatura = await renderizar(
      bitmap,
      [FOTO_MINIATURA_MAX_LADO, 340, 300, 260],
      [0.72, 0.62, 0.54, 0.46, 0.4],
      FOTO_MINIATURA_MAX_BYTES,
      "miniatura"
    );
    return {
      principal: principal.blob,
      miniatura: miniatura.blob,
      largura: principal.largura,
      altura: principal.altura,
    };
  } finally {
    bitmap.close?.();
  }
}
