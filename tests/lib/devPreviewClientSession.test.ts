import { afterEach, describe, expect, it, vi } from "vitest";

import { enableDevPreviewGateSession } from "@/lib/devPreview/clientSession";

/**
 * /dev-preview/app pede a sessão de teste ao montar
 * (app/api/dev-preview/session/route.ts). Sem banco de teste no laboratório
 * a rota responde 503 de propósito (lib/devPreview/testUser.ts). O preview
 * tem que aceitar isso em silêncio: a promessa resolve "unavailable", sem
 * throw, sem promessa rejeitada e sem console.error (a janela de erro do
 * Next em modo dev conta erro lançado e promessa rejeitada).
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function respostaFalsa(status: number, corpo: string) {
  return vi.fn(async () => new Response(corpo, { status }));
}

describe("sessão de teste do preview indisponível (503)", () => {
  it("503 com o motivo em JSON: resolve unavailable com o motivo, sem console.error", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      respostaFalsa(503, JSON.stringify({ error: "Sem banco de teste." }))
    );

    await expect(enableDevPreviewGateSession()).resolves.toEqual({
      kind: "unavailable",
      message: "Sem banco de teste.",
    });
    expect(erro).not.toHaveBeenCalled();
  });

  it("503 sem JSON: resolve unavailable com o texto padrão", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", respostaFalsa(503, "Service Unavailable"));

    const status = await enableDevPreviewGateSession();
    expect(status.kind).toBe("unavailable");
    expect(status.kind === "unavailable" && status.message).toMatch(
      /^Sessão de teste local indisponível/
    );
    expect(erro).not.toHaveBeenCalled();
  });

  it("rede fora do ar (fetch rejeita): resolve unavailable, não rejeita", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Load failed");
      })
    );

    await expect(enableDevPreviewGateSession()).resolves.toMatchObject({
      kind: "unavailable",
    });
    expect(erro).not.toHaveBeenCalled();
  });
});
