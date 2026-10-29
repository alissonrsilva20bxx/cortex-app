import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * O portão de código da Rede saiu (a Rede entra pelo teste grátis). Com
 * ele saíram as duas liberações que o middleware tinha para o laboratório:
 * as rotas solicitar-beta e convites com o cabeçalho de sessão de teste, e
 * o endpoint /api/dev-preview/session que criava essa sessão. Sem sessão,
 * tudo isso cai no /login como qualquer rota, também fora de produção.
 */

function requestTo(path: string, headers?: Record<string, string>) {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers,
  });
}

// middleware.ts always constructs a real Supabase client, even on paths
// this test doesn't expect to authenticate — same placeholder values
// documented for this worktree (never real Supabase, no network reachable
// at this host:port).
function stubPlaceholderSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:9");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "placeholder-anon-key-not-a-real-secret"
  );
}

describe("middleware — sem liberações do antigo portão de código", () => {
  beforeEach(() => {
    vi.resetModules();
    stubPlaceholderSupabaseEnv();
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("as rotas antigas do portão caem no /login mesmo com o cabeçalho do laboratório", async () => {
    const { middleware } = await import("../../middleware");
    const { DEV_PREVIEW_SESSION_HEADER } =
      await import("../../lib/devPreview/session");

    for (const path of ["/api/rede/solicitar-beta", "/api/rede/convites"]) {
      const response = await middleware(
        requestTo(path, { [DEV_PREVIEW_SESSION_HEADER]: "some-jwt-value" })
      );
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
    }
  });

  it("o endpoint que criava a sessão de teste não é mais público", async () => {
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/api/dev-preview/session"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("outra rota com o cabeçalho continua caindo no /login", async () => {
    const { middleware } = await import("../../middleware");
    const { DEV_PREVIEW_SESSION_HEADER } =
      await import("../../lib/devPreview/session");

    const response = await middleware(
      requestTo("/api/jobs", { [DEV_PREVIEW_SESSION_HEADER]: "some-jwt-value" })
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("/dev-preview/app continua aberto fora de produção", async () => {
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/dev-preview/app"));
    expect(response.status).not.toBe(307);
  });
});
