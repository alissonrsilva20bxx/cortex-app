import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * T12 rodada corretiva (PR #63) — `/dev-preview/rede` e `/dev-preview/app`
 * ficavam publicamente acessíveis sem login **também em produção**:
 * `middleware.ts` marcava essas rotas como públicas incondicionalmente, sem
 * checar `NODE_ENV` (só o endpoint de bootstrap de sessão já era bloqueado
 * em produção, não a página em si). Servem uma versão inteira do app
 * (incluindo a Rede) com Supabase inteiramente mockado e perfis fictícios
 * hardcoded. Corrige reaproveitando o mesmo sinal `isDevPreviewEnvironment()`
 * já usado pelo endpoint de bootstrap, sem prejudicar dev local.
 */

function requestTo(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

function stubPlaceholderSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:9");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "placeholder-anon-key-not-a-real-secret"
  );
}

describe("middleware — /dev-preview/** gateado por ambiente", () => {
  beforeEach(() => {
    vi.resetModules();
    stubPlaceholderSupabaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("continua acessível fora de produção (dev local, previews) -- não regride", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { middleware } = await import("../../middleware");

    const redeResponse = await middleware(requestTo("/dev-preview/rede"));
    const appResponse = await middleware(requestTo("/dev-preview/app"));

    expect(redeResponse.status).not.toBe(404);
    expect(redeResponse.status).not.toBe(307);
    expect(appResponse.status).not.toBe(404);
    expect(appResponse.status).not.toBe(307);
  });

  it("fica bloqueado (404) em produção, mesmo sem qualquer sessão", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { middleware } = await import("../../middleware");

    const redeResponse = await middleware(requestTo("/dev-preview/rede"));
    const appResponse = await middleware(requestTo("/dev-preview/app"));

    expect(redeResponse.status).toBe(404);
    expect(appResponse.status).toBe(404);
  });

  it("o bloqueio de produção não vaza para rotas reais fora de /dev-preview", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { middleware } = await import("../../middleware");

    const response = await middleware(requestTo("/financeiro"));

    expect(response.status).not.toBe(404);
  });
});
