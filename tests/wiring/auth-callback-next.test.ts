import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #94 — o link de recuperação de senha usa /auth/callback?next=/login/nova-senha
 * (mesma rota do OAuth) pra trocar o code por uma session real antes de
 * cair na tela de nova senha — só assim o middleware deixa passar (exige
 * user autenticado em qualquer rota fora de /login, /auth, /dev-preview).
 * `next` só é seguido se for um path relativo interno (nunca um redirect
 * aberto pra outro host).
 */

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  })),
}));

import { GET } from "../../app/auth/callback/route";

function request(search: string) {
  return new Request(`http://localhost:3000/auth/callback${search}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/callback — next param", () => {
  it("redireciona pra / quando next não é informado (comportamento atual, OAuth normal)", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(request("?code=abc") as never);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redireciona pro next informado quando a troca de code dá certo (fluxo de recuperação de senha)", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(request("?code=abc&next=/login/nova-senha") as never);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login/nova-senha"
    );
  });

  it("ignora next que não começa com / (redirect aberto pra outro host)", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(
      request(
        "?code=abc&next=" + encodeURIComponent("https://evil.example")
      ) as never
    );
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("ignora next que começa com // (protocol-relative, também é redirect aberto)", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(
      request("?code=abc&next=" + encodeURIComponent("//evil.example")) as never
    );
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("ignora next com barra invertida (/\\\\host) — o parser de URL trata como separador de host, bypass real achado na revisão", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(
      request(
        "?code=abc&next=" + encodeURIComponent("/\\\\evil.example")
      ) as never
    );
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("preserva query string e hash de um next relativo válido", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(
      request(
        "?code=abc&next=" + encodeURIComponent("/login/nova-senha?foo=bar#baz")
      ) as never
    );
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login/nova-senha?foo=bar#baz"
    );
  });

  it("nunca segue next quando a troca de code falha — continua indo pra /login com o erro", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid code" },
    });
    const res = await GET(request("?code=abc&next=/login/nova-senha") as never);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?error=auth_failed"
    );
  });
});

/**
 * #128 (Fase 5) — a falha do callback (código ausente, ou troca de code
 * recusada pelo Supabase) precisa terminar num /login que MOSTRA o erro
 * (achado: antes terminava em silêncio, sem toast nem foco nenhum). A
 * correção tem duas pontas: esta rota nunca deve colocar a mensagem crua
 * do provedor na URL (histórico do navegador, referrer, logs) — só um
 * código estável e sem informação (`auth_failed`); e /login lê apenas a
 * PRESENÇA do parâmetro `error`, nunca o valor, pra mostrar uma mensagem
 * própria (ver AuthErrorNotice em app/login/page.tsx, sem teste de
 * renderização porque este projeto não usa testing-library — o contrato
 * de segurança real, testável, é este: a mensagem do provedor nunca
 * atravessa a URL de redirect).
 */
describe("GET /auth/callback — erro nunca vaza pra URL de redirect (#128)", () => {
  it("redireciona pra /login?error=no_code quando o code está ausente, sem detalhe nenhum", async () => {
    const res = await GET(request("") as never);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?error=no_code"
    );
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("nunca inclui a mensagem do provedor na URL, mesmo quando ela carrega texto sensível", async () => {
    const mensagemSensivel =
      "invalid_grant: token ya1.a0Ac-secret-provider-detail expired for user@example.com";
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: { message: mensagemSensivel },
    });
    const res = await GET(request("?code=abc") as never);
    const location = res.headers.get("location") ?? "";
    expect(location).toBe("http://localhost:3000/login?error=auth_failed");
    expect(location).not.toContain("secret");
    expect(location).not.toContain("user@example.com");
    expect(location.toLowerCase()).not.toContain(
      mensagemSensivel.toLowerCase()
    );
  });
});
