/**
 * Processamento de foto no cliente, ANTES de publicar (chamado do
 * PostComposer ao escolher o arquivo). Post: duas imagens JPEG:
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

/**
 * Formatos de saída. Post é sempre JPEG: o bucket `rede-midia` só aceita
 * `image/jpeg` (migration 0033) e a rota de upload valida isso. A foto de
 * perfil (bucket `avatares`, sem trava de formato) tenta WebP primeiro.
 */
type FormatoSaida = "image/jpeg" | "image/webp";

function criarCanvas(
  largura: number,
  altura: number
): {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  toBlob: (q: number, tipo?: FormatoSaida) => Promise<Blob>;
} {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(largura, altura);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new FotoInvalidaError("canvas 2d indisponível");
    return {
      ctx,
      toBlob: (q, tipo = "image/jpeg") =>
        canvas.convertToBlob({ type: tipo, quality: q }),
    };
  }
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new FotoInvalidaError("canvas 2d indisponível");
  return {
    ctx,
    toBlob: (q, tipo = "image/jpeg") =>
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new FotoInvalidaError("toBlob vazio")),
          tipo,
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

export const AVATAR_LADO = 512;
export const AVATAR_MAX_BYTES = 80 * 1024;

/**
 * Foto de perfil: recorte quadrado central, <= 512 px, <= 80 KB, sem
 * metadados. Antes ia o arquivo original (até 5 MB da câmera) -- upload e
 * download lentos pra um círculo que nunca passa de 88 px na tela.
 *
 * Sai em WebP (mesma qualidade visual em bem menos bytes) quando o
 * navegador sabe codificar; senão em JPEG. Navegador sem encoder WebP
 * (Safari/iPhone, por exemplo) devolve PNG em silêncio em vez de erro --
 * por isso a checagem é pelo `blob.type`, não por try/catch. O tipo final
 * fica em `blob.type` pra quem sobe escolher extensão e contentType.
 */
export async function processarFotoParaAvatar(file: File): Promise<Blob> {
  if (!TIPOS_ACEITOS.includes(file.type)) {
    throw new FotoInvalidaError(
      `tipo não suportado: ${file.type || "desconhecido"}`
    );
  }
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
    const corte = Math.min(bitmap.width, bitmap.height);
    const sx = Math.round((bitmap.width - corte) / 2);
    const sy = Math.round((bitmap.height - corte) / 2);
    let formato: FormatoSaida = "image/webp";
    for (const lado of [AVATAR_LADO, 400, 320]) {
      const final = Math.min(lado, corte);
      const { ctx, toBlob } = criarCanvas(final, final);
      ctx.drawImage(bitmap, sx, sy, corte, corte, 0, 0, final, final);
      for (const q of [0.82, 0.72, 0.62, 0.52]) {
        let blob = await toBlob(q, formato);
        if (blob.type !== formato) {
          // Sem encoder WebP: daqui pra frente, só JPEG.
          formato = "image/jpeg";
          blob = await toBlob(q, formato);
        }
        if (blob.size <= AVATAR_MAX_BYTES) return blob;
      }
    }
    throw new FotoInvalidaError(
      `não foi possível comprimir a foto de perfil para <= ${Math.round(AVATAR_MAX_BYTES / 1024)} KB`
    );
  } finally {
    bitmap.close?.();
  }
}
