import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/supabase-server", () => ({
  createClient: mocks.createClient,
}));

import { POST } from "../../../app/api/rede/convites/route";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/rede/convites", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function client(
  userId: string | null,
  rpcResult: { data: unknown; error: unknown }
) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    rpc,
  };
}

describe("POST /api/rede/convites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ação: gerar", () => {
    it("recusa chamada sem sessão antes de chamar a RPC", async () => {
      const supabase = client(null, { data: null, error: null });
      mocks.createClient.mockReturnValue(supabase);

      const response = await POST(request({ acao: "gerar" }) as never);

      expect(response.status).toBe(401);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("gera o código, hasheia antes de chamar a RPC e devolve o código em texto puro só na resposta", async () => {
      const supabase = client("admin-1", {
        data: { id: "convite-1", expira_em: "2026-08-04T00:00:00.000Z" },
        error: null,
      });
      mocks.createClient.mockReturnValue(supabase);

      const response = await POST(request({ acao: "gerar" }) as never);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.id).toBe("convite-1");
      expect(body.expiraEm).toBe("2026-08-04T00:00:00.000Z");
      expect(typeof body.codigo).toBe("string");
      expect(body.codigo.length).toBeGreaterThan(0);

      // A asserção central deste teste: a RPC recebe exatamente
      // `codigo_hash` (o nome real do parâmetro no banco -- ver
      // supabase/migrations/0015_rede_convites_rpc.sql) já hasheado em
      // SHA-256 hex, nunca o código em texto puro sob nenhum nome.
      expect(supabase.rpc).toHaveBeenCalledWith("rede_gerar_convite", {
        codigo_hash: hash(body.codigo),
      });
      const [, params] = supabase.rpc.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(params).not.toHaveProperty("codigo");
      expect(String(params.codigo_hash)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("traduz 42501 (não-admin) em 403 sem vazar a mensagem do banco", async () => {
      const supabase = client("user-1", {
        data: null,
        error: { code: "42501", message: "acesso negado" },
      });
      mocks.createClient.mockReturnValue(supabase);

      const response = await POST(request({ acao: "gerar" }) as never);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual({ error: "Acesso negado" });
    });

    it("não expõe detalhe de erro inesperado do banco", async () => {
      const supabase = client("admin-1", {
        data: null,
        error: { code: "XX000", message: "detalhe interno sensível" },
      });
      mocks.createClient.mockReturnValue(supabase);

      const response = await POST(request({ acao: "gerar" }) as never);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(JSON.stringify(body)).not.toContain("detalhe interno");
    });
  });

  describe("ação: resgatar", () => {
    it("recusa chamada sem sessão antes de chamar a RPC", async () => {
      const supabase = client(null, { data: null, error: null });
      mocks.createClient.mockReturnValue(supabase);

      const response = await POST(
        request({ acao: "resgatar", codigo: "abc" }) as never
      );

      expect(response.status).toBe(401);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("rejeita código ausente ou vazio antes de chamar a RPC", async () => {
      const supabase = client("user-1", { data: null, error: null });
      mocks.createClient.mockReturnValue(supabase);

      const response = await POST(
        request({ acao: "resgatar", codigo: "" }) as never
      );

      expect(response.status).toBe(400);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("hasheia o código e o IP antes de chamar a RPC com os nomes de parâmetro corretos", async () => {
      const supabase = client("user-1", {
        data: { status: "resgatado" },
        error: null,
      });
      mocks.createClient.mockReturnValue(supabase);

      const response = await POST(
        request(
          { acao: "resgatar", codigo: "codigo-em-texto-puro" },
          { "x-forwarded-for": "203.0.113.7, 10.0.0.1" }
        ) as never
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ resgatado: true });

      // Esta é a asserção que teria pego o bug real encontrado em auditoria
      // (docs/rede/CODEX_IMPLEMENTATION_AUDIT.md §3): uma versão anterior
      // deste endpoint chamava a RPC com `{ codigo: <texto puro> }` --
      // parâmetro errado (a função só tem `codigo_hash`) e valor errado
      // (nunca hasheado). Essa chamada quebraria 100% dos resgates.
      // O código é normalizado (maiúsculas, trim, traço tipográfico -> "-")
      // antes de ser hasheado -- ver normalizarCodigo em route.ts, criada
      // pra tolerar Smart Punctuation do teclado do iOS trocando o hífen.
      expect(supabase.rpc).toHaveBeenCalledWith("rede_resgatar_convite", {
        codigo_hash: hash("CODIGO-EM-TEXTO-PURO"),
        ip_hash: hash("203.0.113.7"),
      });
      const [, params] = supabase.rpc.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(params).not.toHaveProperty("codigo");
      expect(String(params.codigo_hash)).toMatch(/^[0-9a-f]{64}$/);
      expect(String(params.ip_hash)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("usa x-real-ip quando x-forwarded-for está ausente", async () => {
      const supabase = client("user-1", {
        data: { status: "resgatado" },
        error: null,
      });
      mocks.createClient.mockReturnValue(supabase);

      await POST(
        request(
          { acao: "resgatar", codigo: "abc" },
          { "x-real-ip": "198.51.100.9" }
        ) as never
      );

      const [, params] = supabase.rpc.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(params.ip_hash).toBe(hash("198.51.100.9"));
    });

    it("traduz status 'limitado' em 429 com retry-after", async () => {
      const supabase = client("user-1", {
        data: { status: "limitado", retry_after: 42 },
        error: null,
      });
      mocks.createClient.mockReturnValue(supabase);

      const response = await POST(
        request({ acao: "resgatar", codigo: "abc" }) as never
      );
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("42");
      expect(body.error).toMatch(/tente novamente/i);
    });

    it("traduz status 'invalido' em 400", async () => {
      const supabase = client("user-1", {
        data: { status: "invalido" },
        error: null,
      });
      mocks.createClient.mockReturnValue(supabase);

      const response = await POST(
        request({ acao: "resgatar", codigo: "abc" }) as never
      );

      expect(response.status).toBe(400);
    });

    it("não expõe detalhe de erro inesperado do banco", async () => {
      const supabase = client("user-1", {
        data: null,
        error: { code: "XX000", message: "detalhe interno sensível" },
      });
      mocks.createClient.mockReturnValue(supabase);

      const response = await POST(
        request({ acao: "resgatar", codigo: "abc" }) as never
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(JSON.stringify(body)).not.toContain("detalhe interno");
    });
  });

  it("rejeita ação inválida", async () => {
    const supabase = client("user-1", { data: null, error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await POST(request({ acao: "voar" }) as never);

    expect(response.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejeita JSON inválido", async () => {
    const malformed = new Request("http://localhost/api/rede/convites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    const response = await POST(malformed as never);

    expect(response.status).toBe(400);
  });
});
