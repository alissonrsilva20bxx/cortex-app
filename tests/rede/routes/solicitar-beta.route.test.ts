import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/supabase-server", () => ({
  createClient: mocks.createClient,
}));

import { POST } from "../../../app/api/rede/solicitar-beta/route";

function request() {
  return new Request("http://localhost/api/rede/solicitar-beta", {
    method: "POST",
  });
}

function client(
  userId: string | null,
  insertResult: { data: unknown; error: unknown }
) {
  const single = vi.fn().mockResolvedValue(insertResult);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({ insert }),
    insert,
  };
}

describe("POST /api/rede/solicitar-beta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria solicitação pendente para o usuário autenticado", async () => {
    const supabase = client("user-1", {
      data: { id: "solicitacao-1", status: "pendente" },
      error: null,
    });
    mocks.createClient.mockReturnValue(supabase);

    const response = await POST(request() as never);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      solicitada: true,
      jaExistia: false,
      solicitacao: { id: "solicitacao-1", status: "pendente" },
    });
    expect(supabase.from).toHaveBeenCalledWith("rede_solicitacoes_beta");
    expect(supabase.insert).toHaveBeenCalledWith({ user_id: "user-1" });
  });

  it("recusa chamada sem sessão antes de acessar a tabela", async () => {
    const supabase = client(null, { data: null, error: null });
    mocks.createClient.mockReturnValue(supabase);

    const response = await POST(request() as never);

    expect(response.status).toBe(401);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("trata conflito UNIQUE como sucesso idempotente claro", async () => {
    const supabase = client("user-2", {
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    mocks.createClient.mockReturnValue(supabase);

    const response = await POST(request() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ solicitada: true, jaExistia: true });
  });

  it("não expõe detalhes de erro inesperado do banco", async () => {
    const supabase = client("user-3", {
      data: null,
      error: { code: "XX000", message: "detalhe interno sensível" },
    });
    mocks.createClient.mockReturnValue(supabase);

    const response = await POST(request() as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Não foi possível solicitar a beta" });
    expect(JSON.stringify(body)).not.toContain("detalhe interno");
  });
});
