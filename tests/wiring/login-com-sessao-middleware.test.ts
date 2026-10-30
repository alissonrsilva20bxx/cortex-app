import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * R17 M2: quem já está logada e abre /login (pelo voltar do celular, por
 * um favorito, pelo app instalado) via a tela "Bom ter você de volta" e
 * parecia ter saído da conta. Com sessão ativa, /login manda para "/".
 * /login/nova-senha continua abrindo (é lá que a sessão de recuperação
 * troca a senha).
 */

const sessao = vi.hoisted(() => ({ user: null as null | { id: string } }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: sessao.user } }) },
  }),
}));

function requestTo(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("middleware — /login com sessão ativa", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:9");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder-anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    sessao.user = null;
  });

  it("logada: /login redireciona para o início", async () => {
    sessao.user = { id: "u1" };
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/login"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/");
  });

  it("logada: /login sem erro vai ao início sem parâmetro nenhum", async () => {
    sessao.user = { id: "u1" };
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/login?x=1"));
    expect(new URL(response.headers.get("location")!).search).toBe("");
  });

  // R18rev BAIXA 4: a volta do Google que falhou (reconfirmação do PIN)
  // cai em /login?error=auth_failed. Logada, ela ia ao início sem o aviso.
  it("logada: o aviso de erro (?error=) vai junto para o início", async () => {
    sessao.user = { id: "u1" };
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/login?error=auth_failed"));
    const destino = new URL(response.headers.get("location")!);
    expect(destino.pathname).toBe("/");
    expect(destino.search).toBe("?error=auth_failed");
  });

  it("logada: o valor do ?error= nunca é repassado, só o código genérico", async () => {
    sessao.user = { id: "u1" };
    const { middleware } = await import("../../middleware");
    const response = await middleware(
      requestTo("/login?error=%3Cscript%3E&outro=1")
    );
    expect(new URL(response.headers.get("location")!).search).toBe(
      "?error=auth_failed"
    );
  });

  it("logada: /login/nova-senha continua abrindo", async () => {
    sessao.user = { id: "u1" };
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/login/nova-senha"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("sem sessão: /login abre normalmente", async () => {
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/login"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("sem sessão: o início continua indo para /login", async () => {
    const { middleware } = await import("../../middleware");
    const response = await middleware(requestTo("/"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });
});
