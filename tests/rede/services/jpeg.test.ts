import { describe, expect, it } from "vitest";
import {
  ehJpeg,
  lerDimensoesJpeg,
  removerMetadados,
  contemMetadados,
} from "../../../lib/rede/jpeg";

/**
 * Monta um JPEG mínimo mas estruturalmente válido:
 *   SOI, [APP0 JFIF], [segmentos opcionais], SOF0 (com dimensões), SOS,
 *   1 byte de "scan", EOI.
 * Não precisa decodificar de verdade -- os utilitários só andam pelos
 * marcadores.
 */
function seg(marker: number, payload: number[]): number[] {
  const len = payload.length + 2;
  return [0xff, marker, (len >> 8) & 0xff, len & 0xff, ...payload];
}

function jpegMinimo(opts: {
  largura: number;
  altura: number;
  comExif?: boolean;
  comXmp?: boolean;
  comComentario?: boolean;
}): Uint8Array {
  const bytes: number[] = [0xff, 0xd8]; // SOI
  bytes.push(
    ...seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0])
  ); // APP0 JFIF
  if (opts.comExif) {
    // APP1 "Exif\0\0" + um TIFF header falso + bytes de GPS de mentira
    bytes.push(
      ...seg(
        0xe1,
        [
          0x45, 0x78, 0x69, 0x66, 0, 0, 0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 0x12,
          0x34,
        ]
      )
    );
  }
  if (opts.comXmp) {
    bytes.push(
      ...seg(0xe1, [
        ...Buffer.from("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>"),
      ])
    );
  }
  if (opts.comComentario) {
    bytes.push(...seg(0xfe, [...Buffer.from("gerado por camera XYZ")]));
  }
  // SOF0: precisão(1) altura(2) largura(2) componentes(1)
  bytes.push(
    ...seg(0xc0, [
      8,
      (opts.altura >> 8) & 0xff,
      opts.altura & 0xff,
      (opts.largura >> 8) & 0xff,
      opts.largura & 0xff,
      1,
      1,
      0x11,
      0,
    ])
  );
  bytes.push(...seg(0xda, [1, 1, 0, 0, 0x3f, 0])); // SOS header
  bytes.push(0x00); // 1 byte de dados entrópicos
  bytes.push(0xff, 0xd9); // EOI
  return Uint8Array.from(bytes);
}

describe("lib/rede/jpeg", () => {
  it("ehJpeg reconhece o SOI e rejeita não-JPEG", () => {
    expect(ehJpeg(jpegMinimo({ largura: 100, altura: 80 }))).toBe(true);
    expect(ehJpeg(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(ehJpeg(Uint8Array.from([0xff, 0xd8]))).toBe(false);
  });

  it("lerDimensoesJpeg lê largura/altura do SOF", () => {
    expect(
      lerDimensoesJpeg(jpegMinimo({ largura: 1280, altura: 720 }))
    ).toEqual({
      largura: 1280,
      altura: 720,
    });
    expect(
      lerDimensoesJpeg(
        jpegMinimo({ largura: 4032, altura: 3024, comExif: true })
      )
    ).toEqual({ largura: 4032, altura: 3024 });
  });

  it("lerDimensoesJpeg lança se não achar SOF", () => {
    expect(() =>
      lerDimensoesJpeg(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]))
    ).toThrow();
  });

  it("contemMetadados detecta EXIF, XMP e comentário; ignora APP0/JFIF", () => {
    expect(contemMetadados(jpegMinimo({ largura: 10, altura: 10 }))).toBe(
      false
    );
    expect(
      contemMetadados(jpegMinimo({ largura: 10, altura: 10, comExif: true }))
    ).toBe(true);
    expect(
      contemMetadados(jpegMinimo({ largura: 10, altura: 10, comXmp: true }))
    ).toBe(true);
    expect(
      contemMetadados(
        jpegMinimo({ largura: 10, altura: 10, comComentario: true })
      )
    ).toBe(true);
  });

  it("removerMetadados tira EXIF/XMP/comentário e mantém a imagem legível", () => {
    const sujo = jpegMinimo({
      largura: 800,
      altura: 600,
      comExif: true,
      comXmp: true,
      comComentario: true,
    });
    expect(contemMetadados(sujo)).toBe(true);

    const limpo = removerMetadados(sujo);
    expect(contemMetadados(limpo)).toBe(false);
    // dimensões preservadas
    expect(lerDimensoesJpeg(limpo)).toEqual({ largura: 800, altura: 600 });
    // ficou menor (removeu segmentos)
    expect(limpo.byteLength).toBeLessThan(sujo.byteLength);
    // ainda começa em SOI e termina em EOI
    expect(limpo[0]).toBe(0xff);
    expect(limpo[1]).toBe(0xd8);
    expect(limpo[limpo.length - 2]).toBe(0xff);
    expect(limpo[limpo.length - 1]).toBe(0xd9);
  });

  it("removerMetadados é idempotente num JPEG já limpo", () => {
    const limpo1 = removerMetadados(jpegMinimo({ largura: 320, altura: 240 }));
    const limpo2 = removerMetadados(limpo1);
    expect(Array.from(limpo2)).toEqual(Array.from(limpo1));
  });
});
