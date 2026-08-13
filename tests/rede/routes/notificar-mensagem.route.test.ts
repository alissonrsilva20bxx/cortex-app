import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * T11 (issue #38) — item §6.9-P1-3 do checklist de paridade funcional:
 * push notification (fire-and-forget após envio, erro real de banco não
 * mascarado, VAPID ausente retorna 500). Rota sem nenhum teste até então
 * (diferente de convites/solicitar-beta, que já tinham `*.route.test.ts`).
 * Mesmo padrão de mock usado em `solicitar-beta.route.test.ts`.
 */

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/supabase-server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("../../../lib/supabaseAdmin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mocks.setVapidDetails,
    sendNotification: mocks.sendNotification,
  },
}));

import { POST } from "../../../app/api/rede/mensagens/notificar/route";

function request(body: unknown) {
  return new Request("http://localhost/api/rede/mensagens/notificar", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function supabaseClient(
  userId: string | null,
  participantes: { user_id: string }[] | null,
  participantesError: unknown = null
) {
  const eq = vi.fn().mockResolvedValue({
    data: participantes,
    error: participantesError,
  });
  const select = vi.fn().mockReturnValue({ eq });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({ select }),
  };
}

function adminClient(opts: {
  perfil?: { nome_exibicao: string } | null;
  subs?:
    | { id: string; endpoint: string; p256dh: string; auth: string }[]
    | null;
  subsError?: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: opts.perfil ?? null,
    error: null,
  });
  const eqPerfil = vi.fn().mockReturnValue({ maybeSingle });
  const selectPerfil = vi.fn().mockReturnValue({ eq: eqPerfil });

  const inSubs = vi.fn().mockResolvedValue({
    data: opts.subs ?? null,
    error: opts.subsError ?? null,
  });
  const selectSubs = vi.fn().mockReturnValue({ in: inSubs });

  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const del = vi.fn().mockReturnValue({ eq: deleteEq });

  return {
    from: vi.fn((table: string) => {
      if (table === "rede_perfis") return { select: selectPerfil };
      if (table === "push_subscriptions")
        return { select: selectSubs, delete: del };
      throw new Error(`tabela inesperada: ${table}`);
    }),
    _deleteEq: deleteEq,
  };
}

const ENV_BACKUP = { ...process.env };

describe("POST /api/rede/mensagens/notificar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ENV_BACKUP };
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub-key";
    process.env.VAPID_PRIVATE_KEY = "priv-key";
  });

  it("recusa chamada sem sessão antes de qualquer consulta", async () => {
    mocks.createClient.mockReturnValue(supabaseClient(null, []));
    const response = await POST(
      request({ conversaId: "c1", texto: "oi" }) as never
    );
    expect(response.status).toBe(401);
  });

  it("rejeita payload inválido (conversaId/texto ausentes)", async () => {
    mocks.createClient.mockReturnValue(supabaseClient("u1", []));
    const response = await POST(request({}) as never);
    expect(response.status).toBe(400);
  });

  it("nega acesso (403) se a chamadora não é participante da conversa", async () => {
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", [{ user_id: "outro-user" }])
    );
    const response = await POST(
      request({ conversaId: "c1", texto: "oi" }) as never
    );
    expect(response.status).toBe(403);
  });

  it("erro real ao buscar participantes retorna 500, não mascara como 'sem acesso'", async () => {
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", null, { message: "conexão falhou" })
    );
    const response = await POST(
      request({ conversaId: "c1", texto: "oi" }) as never
    );
    expect(response.status).toBe(500);
  });

  it("retorna sent:0 sem tentar enviar quando não há outro participante", async () => {
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", [{ user_id: "u1" }])
    );
    const response = await POST(
      request({ conversaId: "c1", texto: "oi" }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ sent: 0 });
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("erro real de banco ao buscar inscrições NÃO é mascarado como 'ninguém inscrito' (500, não sent:0)", async () => {
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", [{ user_id: "u1" }, { user_id: "u2" }])
    );
    mocks.getSupabaseAdmin.mockReturnValue(
      adminClient({ subsError: { message: "falha real de infra" } })
    );
    const response = await POST(
      request({ conversaId: "c1", texto: "oi" }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body).not.toEqual({ sent: 0 });
  });

  it("retorna sent:0 quando ninguém está de fato inscrito (sem erro de banco)", async () => {
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", [{ user_id: "u1" }, { user_id: "u2" }])
    );
    mocks.getSupabaseAdmin.mockReturnValue(adminClient({ subs: [] }));
    const response = await POST(
      request({ conversaId: "c1", texto: "oi" }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ sent: 0 });
  });

  it("VAPID ausente retorna 500 mesmo com inscrições válidas encontradas", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", [{ user_id: "u1" }, { user_id: "u2" }])
    );
    mocks.getSupabaseAdmin.mockReturnValue(
      adminClient({
        subs: [{ id: "s1", endpoint: "https://x", p256dh: "p", auth: "a" }],
      })
    );
    const response = await POST(
      request({ conversaId: "c1", texto: "oi" }) as never
    );
    expect(response.status).toBe(500);
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("envia push real via webpush.sendNotification e retorna a contagem enviada", async () => {
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", [{ user_id: "u1" }, { user_id: "u2" }])
    );
    mocks.getSupabaseAdmin.mockReturnValue(
      adminClient({
        perfil: { nome_exibicao: "Ana" },
        subs: [{ id: "s1", endpoint: "https://x", p256dh: "p", auth: "a" }],
      })
    );
    mocks.sendNotification.mockResolvedValue(undefined);

    const response = await POST(
      request({ conversaId: "c1", texto: "oi" }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ sent: 1 });
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://x", keys: { p256dh: "p", auth: "a" } },
      expect.stringContaining("Ana")
    );
  });

  it("remove inscrição expirada (404/410) e continua sem falhar a requisição inteira", async () => {
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", [{ user_id: "u1" }, { user_id: "u2" }])
    );
    const admin = adminClient({
      subs: [{ id: "s1", endpoint: "https://x", p256dh: "p", auth: "a" }],
    });
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    mocks.sendNotification.mockRejectedValue({ statusCode: 410 });

    const response = await POST(
      request({ conversaId: "c1", texto: "oi" }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ sent: 0 });
    expect(admin._deleteEq).toHaveBeenCalledWith("id", "s1");
  });
});
