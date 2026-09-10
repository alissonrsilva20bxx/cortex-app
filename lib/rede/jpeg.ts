/**
 * Utilitários de JPEG em JS puro (sem dependência nativa — roda no Node da
 * rota `app/api/rede/foto-upload` e no navegador). Não decodifica a imagem:
 * só anda pelos marcadores do container JPEG.
 *
 * Um JPEG é: SOI (FF D8), uma sequência de segmentos, SOS (FF DA) e daí os
 * dados entrópicos até EOI (FF D9). Segmentos que carregam metadados:
 *   - APP1  (FF E1) = EXIF/XMP — inclui GPS, data/hora, modelo da câmera
 *   - APP13 (FF ED) = IPTC/Photoshop
 *   - COM   (FF FE) = comentário livre
 * Mantemos:
 *   - APP0 (FF E0) = JFIF, estrutural
 *   - APP2 (FF E2) = perfil de cor ICC — não identifica ninguém, e
 *     removê-lo pode alterar sutilmente as cores. O reencode por <canvas>
 *     do navegador já emite só JFIF + ICC, sem EXIF.
 */

const isSofMarker = (m: number): boolean =>
  m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

/** Segmentos de metadado SENSÍVEL / identificante: APP1 (EXIF/XMP/GPS),
 * APP3–APP15, APP13 (IPTC) e COM. APP0 (JFIF) e APP2 (ICC) NÃO entram. */
const isMetadadoSensivel = (m: number): boolean =>
  m === 0xe1 || (m >= 0xe3 && m <= 0xef) || m === 0xfe;

export function ehJpeg(bytes: Uint8Array): boolean {
  return (
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

export type DimensoesJpeg = { largura: number; altura: number };

/**
 * Lê largura/altura do primeiro SOF. Lança se o arquivo não for um JPEG
 * com SOF válido — quem chama trata como "imagem inválida", nunca aceita.
 */
export function lerDimensoesJpeg(bytes: Uint8Array): DimensoesJpeg {
  if (!ehJpeg(bytes)) throw new Error("não é JPEG (SOI ausente)");
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff)
      throw new Error(
        `marcador esperado em ${i}, achou 0x${bytes[i].toString(16)}`
      );
    let marker = bytes[i + 1];
    // pula bytes de preenchimento (FF FF ...)
    while (marker === 0xff && i + 2 < bytes.length) {
      i += 1;
      marker = bytes[i + 1];
    }
    i += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker >= 0xd0 && marker <= 0xd7) continue; // RST
    if (i + 1 >= bytes.length) break;
    const segLen = (bytes[i] << 8) | bytes[i + 1];
    if (segLen < 2) throw new Error("segmento com tamanho inválido");
    if (isSofMarker(marker)) {
      // SOF: len(2) precisão(1) altura(2) largura(2)
      const altura = (bytes[i + 3] << 8) | bytes[i + 4];
      const largura = (bytes[i + 5] << 8) | bytes[i + 6];
      if (!largura || !altura) throw new Error("SOF sem dimensões");
      return { largura, altura };
    }
    if (marker === 0xda) break; // SOS — daqui pra frente é scan
    i += segLen;
  }
  throw new Error("SOF não encontrado");
}

/**
 * Devolve o JPEG sem nenhum segmento de metadado sensível (APP1 EXIF/XMP/
 * GPS, APP13 IPTC, APP3–APP15, COM). Mantém APP0/JFIF e APP2/ICC. Os
 * dados de imagem ficam byte-idênticos. Se o input não for JPEG, lança.
 */
export function removerMetadados(bytes: Uint8Array): Uint8Array {
  if (!ehJpeg(bytes)) throw new Error("não é JPEG");
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) {
      // desalinhou — copia o resto cru e para (não deveria acontecer num
      // JPEG bem-formado antes do SOS)
      for (let k = i; k < bytes.length; k++) out.push(bytes[k]);
      return Uint8Array.from(out);
    }
    let marker = bytes[i + 1];
    while (marker === 0xff && i + 2 < bytes.length) {
      i += 1;
      marker = bytes[i + 1];
    }
    if (marker === 0xda) {
      // SOS + entropia + EOI: copia tudo verbatim
      for (let k = i; k < bytes.length; k++) out.push(bytes[k]);
      return Uint8Array.from(out);
    }
    if (marker === 0xd9) {
      out.push(0xff, 0xd9);
      return Uint8Array.from(out);
    }
    if (i + 3 >= bytes.length) break;
    const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
    const segEnd = i + 2 + segLen;
    if (!isMetadadoSensivel(marker)) {
      for (let k = i; k < segEnd && k < bytes.length; k++) out.push(bytes[k]);
    }
    i = segEnd;
  }
  return Uint8Array.from(out);
}

/**
 * `true` se o JPEG ainda tem algum segmento de metadado SENSÍVEL
 * (APP1 EXIF/XMP/GPS, APP13 IPTC, APP3–APP15, COM). APP0/JFIF e APP2/ICC
 * não contam. Usado como asserção pós-strip.
 */
export function contemMetadados(bytes: Uint8Array): boolean {
  if (!ehJpeg(bytes)) return false;
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return false;
    let marker = bytes[i + 1];
    while (marker === 0xff && i + 2 < bytes.length) {
      i += 1;
      marker = bytes[i + 1];
    }
    i += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (marker === 0xda) return false; // chegou no scan sem achar metadado
    if (i + 1 >= bytes.length) return false;
    const segLen = (bytes[i] << 8) | bytes[i + 1];
    if (isMetadadoSensivel(marker)) return true;
    i += segLen;
  }
  return false;
}
