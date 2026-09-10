import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Achado ao testar o upload de foto da Rede contra o deploy de Preview dos
 * amigos (que roda contra o Supabase de produção): o primeiro
 * `POST /api/rede/foto-upload` de uma sessão real virava um 307 pro
 * /login ANTES do route handler rodar -- o `fetch` do `criarPost` seguia
 * o redirect, `resp.json()` estourava no HTML do /login e o rollback do
 * `criarPost` apagava o post recém-criado. Nada persistia em produção.
 *
 * A rota faz a própria autenticação (`resolveGateAuth` -> 401 JSON) e
 * ainda re-checa `rede_is_member` + posse do post antes de qualquer
 * escrita com service_role, então tirá-la do gate de sessão do middleware
 * é seguro -- exatamente como já se fez para `/api/cron/*` (migration
 * 0028, ver cron-routes-middleware.test.ts).
 */

function requestTo(path: string, headers?: Record<string, string>) {
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

function stubPlaceholderSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:9");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "placeholder-anon-key-not-a-real-secret"
  );
}

describe("middleware — /api/rede/foto-upload fica pública (autenticação é da própria rota)", () => {
  beforeEach(() => {
    vi.resetModules();
    stubPlaceholderSupabaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("não redireciona POST /api/rede/foto-upload sem sessão nenhuma", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/api/rede/foto-upload"));
    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("vale igual fora de produção (não é um bypass só-produção)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/api/rede/foto-upload"));
    expect(response.status).not.toBe(307);
  });

  it("é match exato -- não libera um prefixo /api/rede/* qualquer", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { middleware } = await import("../../middleware");
    for (const path of [
      "/api/rede/foto-upload/extra",
      "/api/rede/solicitar-beta",
      "/api/rede/convites",
    ]) {
      const response = await middleware(requestTo(path));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
    }
  });

  it("continua redirecionando uma rota de página comum sem sessão", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/financeiro"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });
});
