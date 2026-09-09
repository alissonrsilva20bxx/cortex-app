import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// `server-only` só é um no-op dentro do build da Next (que troca o pacote
// por um arquivo vazio via webpack alias) -- fora dele, o próprio pacote
// lança um erro sempre. Mockado aqui só pra permitir importar o route.ts
// direto neste teste; não afeta o build real da Next.
vi.mock("server-only", () => ({}));
// getSupabaseAdmin() só é chamada DEPOIS do guard de auth -- este teste só
// prova o guard, então um stub que nunca deveria ser invocado é
// suficiente (e intencional: se algum dia for chamado antes do 401, isso
// já seria o próprio bug voltando).
vi.mock("@/lib/supabaseAdmin", () => ({
  getSupabaseAdmin: () => {
    throw new Error(
      "getSupabaseAdmin() não deveria ser chamada antes do guard de CRON_SECRET"
    );
  },
}));

/**
 * Migration 0028 review: liberar /api/cron/* do gate de sessão do
 * middleware (ver tests/wiring/cron-routes-middleware.test.ts) só é seguro
 * porque cada handler continua validando CRON_SECRET sozinho. Este teste
 * prova a validação em si, incluindo o caso em que a env var não está
 * configurada -- sem o guard `!cronSecret ||`, um ambiente sem
 * CRON_SECRET aceitaria literalmente o header "Authorization: Bearer
 * undefined" (o template literal interpola `undefined` como texto).
 *
 * Só testa o limite de autenticação (retorna antes de qualquer chamada ao
 * Supabase), então não precisa mockar nada além das env vars.
 */

function requestWithAuth(header?: string) {
  const headers = header ? { authorization: header } : undefined;
  return new NextRequest("http://localhost:3000/api/cron/x", { headers });
}

describe.each([
  ["rede-midia-limpeza", "../../app/api/cron/rede-midia-limpeza/route"],
  ["notificacoes", "../../app/api/cron/notificacoes/route"],
])("cron route auth — %s", (_name, modulePath) => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a request with no Authorization header", async () => {
    vi.stubEnv("CRON_SECRET", "s3gredo-de-teste");
    const { GET } = await import(modulePath);
    const response = await GET(requestWithAuth());
    expect(response.status).toBe(401);
  });

  it("rejects a request with the wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3gredo-de-teste");
    const { GET } = await import(modulePath);
    const response = await GET(requestWithAuth("Bearer secret-errado"));
    expect(response.status).toBe(401);
  });

  it("rejects even the correct-shaped header when CRON_SECRET is unset (no 'Bearer undefined' bypass)", async () => {
    // String vazia é falsy igual undefined -- simula CRON_SECRET nunca
    // configurada sem brigar com o bookkeeping de vi.stubEnv/unstubAllEnvs.
    vi.stubEnv("CRON_SECRET", "");
    const { GET } = await import(modulePath);
    const response = await GET(requestWithAuth("Bearer undefined"));
    expect(response.status).toBe(401);
  });
});
