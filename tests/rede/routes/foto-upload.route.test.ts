import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ordem de guarda de `app/api/rede/foto-upload` -- TUDO antes de qualquer
 * escrita com service_role:
 *   (1) autenticação      -> 401 JSON (nunca 307, nunca HTML de /login)
 *   (2) membership na Rede -> 403
 *   (3) posse do post      -> 404
 * Só um membro autenticado e autor do post prossegue para a validação das
 * imagens. Este teste prova cada porta e prova que `getSupabaseAdmin()`
 * (o service_role) nunca é tocado antes de todas passarem.
 */

const mocks = vi.hoisted(() => ({
  resolveGateAuth: vi.fn(),
  getSupabaseAdmin: vi.fn(() => {
    throw new Error(
      "getSupabaseAdmin() não deveria ser chamada antes de auth + membership + posse do post"
    );
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/devPreview/serverAuth", () => ({
  resolveGateAuth: mocks.resolveGateAuth,
}));
vi.mock("../../../lib/supabaseAdmin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

import { POST } from "../../../app/api/rede/foto-upload/route";

const AUTHOR_ID = "user-autor";

function request(
  fields: Record<string, string> = { postId: "post-1", ordem: "1" }
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request("http://localhost/api/rede/foto-upload", {
    method: "POST",
    body: form,
  });
}

function fakeSupabase(opts: {
  member?: unknown;
  memberErr?: unknown;
  post?: { id: string; autor_id: string } | null;
  postErr?: unknown;
}) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({
      data: opts.post ?? null,
      error: opts.postErr ?? null,
    });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: opts.member, error: opts.memberErr ?? null });
  return { from, rpc, select, eq, maybeSingle };
}

function authenticated(supabase: ReturnType<typeof fakeSupabase>) {
  return { kind: "authenticated" as const, supabase, userId: AUTHOR_ID };
}

describe("POST /api/rede/foto-upload — portas de autorização", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseAdmin.mockImplementation(() => {
      throw new Error(
        "getSupabaseAdmin() não deveria ser chamada antes de auth + membership + posse do post"
      );
    });
  });

  it("sem sessão: 401 JSON, nunca 307 nem HTML de /login", async () => {
    mocks.resolveGateAuth.mockResolvedValue({ kind: "unauthenticated" });

    const response = await POST(request() as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toEqual({ error: "Não autenticado" });
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("backend inacessível: 503, sem tocar o service_role", async () => {
    mocks.resolveGateAuth.mockResolvedValue({
      kind: "unavailable",
      message: "Serviço indisponível",
    });

    const response = await POST(request() as never);

    expect(response.status).toBe(503);
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("usuário sem acesso à Rede: 403", async () => {
    const supabase = fakeSupabase({ member: false });
    mocks.resolveGateAuth.mockResolvedValue(authenticated(supabase));

    const response = await POST(request() as never);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Sem acesso à Rede" });
    expect(supabase.rpc).toHaveBeenCalledWith("rede_is_member");
    expect(supabase.from).not.toHaveBeenCalled();
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("membro, mas o post não existe: 404", async () => {
    const supabase = fakeSupabase({ member: true, post: null });
    mocks.resolveGateAuth.mockResolvedValue(authenticated(supabase));

    const response = await POST(request() as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Publicação não encontrada" });
    expect(supabase.from).toHaveBeenCalledWith("rede_posts");
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("membro, mas não é o autor do post: 404", async () => {
    const supabase = fakeSupabase({
      member: true,
      post: { id: "post-1", autor_id: "outro-usuario" },
    });
    mocks.resolveGateAuth.mockResolvedValue(authenticated(supabase));

    const response = await POST(request() as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Publicação não encontrada" });
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("membro autenticado e autor: passa as três portas e chega na validação da imagem", async () => {
    const supabase = fakeSupabase({
      member: true,
      post: { id: "post-1", autor_id: AUTHOR_ID },
    });
    mocks.resolveGateAuth.mockResolvedValue(authenticated(supabase));

    // sem os campos `principal`/`miniatura` -> a rota rejeita na validação
    // da imagem (422), o que só é alcançável depois de auth + membership +
    // posse terem passado.
    const response = await POST(request() as never);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(String(body.error)).toContain("principal");
    expect(supabase.rpc).toHaveBeenCalledWith("rede_is_member");
    expect(supabase.from).toHaveBeenCalledWith("rede_posts");
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });
});
