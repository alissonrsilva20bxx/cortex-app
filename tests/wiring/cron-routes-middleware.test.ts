import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Achado ao testar app/api/cron/rede-midia-limpeza (migration 0028) contra
 * o build de produção local: toda rota `/api/cron/*` é chamada sem sessão
 * de usuário nenhuma (Vercel Cron, ou `curl` com `Authorization: Bearer
 * ${CRON_SECRET}`) -- mas o middleware redirecionava qualquer requisição
 * sem usuário autenticado pro /login (307) ANTES do route handler rodar,
 * então o `CRON_SECRET` do próprio handler nunca chegava a ser checado.
 * Mesmo bug já afetava silenciosamente /api/cron/notificacoes (pré-
 * existente, não introduzido por esta migration).
 */

function requestTo(path: string, headers?: Record<string, string>) {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers,
  });
}

function stubPlaceholderSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:9");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "placeholder-anon-key-not-a-real-secret"
  );
}

describe("middleware — rotas /api/cron/* ficam públicas (autenticação é do próprio handler)", () => {
  beforeEach(() => {
    vi.resetModules();
    stubPlaceholderSupabaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("não redireciona /api/cron/rede-midia-limpeza sem sessão nenhuma", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { middleware } = await import("../../middleware");
    const response = await middleware(
      requestTo("/api/cron/rede-midia-limpeza")
    );
    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("não redireciona /api/cron/notificacoes sem sessão nenhuma", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/api/cron/notificacoes"));
    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("vale igual fora de produção (não é um bypass só-produção)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { middleware } = await import("../../middleware");
    const response = await middleware(
      requestTo("/api/cron/rede-midia-limpeza")
    );
    expect(response.status).not.toBe(307);
  });

  it("continua redirecionando outra rota de API qualquer sem sessão (não é bypass geral de /api)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/api/jobs"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("continua redirecionando uma rota de página comum sem sessão", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/financeiro"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });
});
