import { describe, expect, it } from "vitest";
import {
  VALIDADE_DA_MARCA_MS,
  lerMarca,
  metodosDoUsuario,
  retornoDoGoogleValido,
  type MarcaGoogle,
  type UsuarioReauth,
} from "@/lib/reauthRegras";

const ANTES = "2026-10-08T10:00:00.000Z";
const DEPOIS = "2026-10-08T10:03:00.000Z";
const marca: MarcaGoogle = {
  motivo: "esqueci-pin",
  usuarioId: "u1",
  entradaAnterior: ANTES,
  feitaEm: 1_000_000,
};
const voltou: UsuarioReauth = { id: "u1", last_sign_in_at: DEPOIS };

describe("como a conta pode se confirmar (senha OU Google)", () => {
  it("conta de e-mail: senha", () => {
    expect(
      metodosDoUsuario({
        id: "u",
        email: "a@b.c",
        identities: [{ provider: "email" }],
      })
    ).toEqual(["senha"]);
  });

  it("conta Google: Google", () => {
    expect(
      metodosDoUsuario({
        id: "u",
        email: "a@b.c",
        app_metadata: { providers: ["google"] },
      })
    ).toEqual(["google"]);
  });

  it("as duas ligadas: as duas opções", () => {
    expect(
      metodosDoUsuario({
        id: "u",
        email: "a@b.c",
        identities: [{ provider: "google" }],
        app_metadata: { providers: ["email"] },
      })
    ).toEqual(["senha", "google"]);
  });

  it("sem e-mail não há senha para conferir", () => {
    expect(
      metodosDoUsuario({ id: "u", identities: [{ provider: "email" }] })
    ).toEqual([]);
  });
});

describe("volta do Google: só vale se a MESMA conta entrou de novo", () => {
  it("mesma conta, entrada mais nova que a de antes, dentro do prazo: vale", () => {
    expect(
      retornoDoGoogleValido(marca, "esqueci-pin", voltou, marca.feitaEm + 1000)
    ).toBe(true);
  });

  it("entrada igual à de antes (ninguém entrou de novo): não vale", () => {
    expect(
      retornoDoGoogleValido(
        marca,
        "esqueci-pin",
        { id: "u1", last_sign_in_at: ANTES },
        marca.feitaEm + 1000
      )
    ).toBe(false);
  });

  it("outra conta Google: não vale", () => {
    expect(
      retornoDoGoogleValido(
        marca,
        "esqueci-pin",
        { id: "u2", last_sign_in_at: DEPOIS },
        marca.feitaEm + 1000
      )
    ).toBe(false);
  });

  it("marca de outro motivo (pedida nos Ajustes): não vale para o Esqueci", () => {
    expect(
      retornoDoGoogleValido(
        { ...marca, motivo: "desligar-pin" },
        "esqueci-pin",
        voltou,
        marca.feitaEm + 1000
      )
    ).toBe(false);
  });

  it("marca vencida (mais de 10 min) ou do futuro: não vale", () => {
    expect(
      retornoDoGoogleValido(
        marca,
        "esqueci-pin",
        voltou,
        marca.feitaEm + VALIDADE_DA_MARCA_MS + 1
      )
    ).toBe(false);
    expect(
      retornoDoGoogleValido(marca, "esqueci-pin", voltou, marca.feitaEm - 1)
    ).toBe(false);
  });

  it("sem marca, sem usuário ou sem data de entrada: não vale", () => {
    expect(retornoDoGoogleValido(null, "esqueci-pin", voltou, 0)).toBe(false);
    expect(
      retornoDoGoogleValido(marca, "esqueci-pin", null, marca.feitaEm)
    ).toBe(false);
    expect(
      retornoDoGoogleValido(
        marca,
        "esqueci-pin",
        { id: "u1", last_sign_in_at: null },
        marca.feitaEm
      )
    ).toBe(false);
  });

  it("lerMarca recusa marca estragada ou com motivo desconhecido", () => {
    expect(lerMarca(null)).toBeNull();
    expect(lerMarca("{lixo")).toBeNull();
    expect(
      lerMarca(JSON.stringify({ ...marca, motivo: "apagar-tudo" }))
    ).toBeNull();
    expect(lerMarca(JSON.stringify(marca))).toEqual(marca);
  });
});
