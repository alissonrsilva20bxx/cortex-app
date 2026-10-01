import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Push de pedido de amizade (pedido novo / pedido aceito). Mesmo padrão de
 * mock de `notificar-mensagem.route.test.ts`.
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

import {
  JANELA_NOTIFICAR_MS,
  POST,
} from "../../../app/api/rede/amizades/notificar/route";

type Amizade = {
  solicitante_id: string;
  destinatario_id: string;
  status: "pendente" | "aceita" | "recusada";
  criado_em: string;
  respondido_em: string | null;
};

const agora = () => new Date().toISOString();
const antigo = () =>
  new Date(Date.now() - JANELA_NOTIFICAR_MS - 60_000).toISOString();

function request(body: unknown) {
  return new Request("http://localhost/api/rede/amizades/notificar", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function supabaseClient(
  userId: string | null,
  amizade: Amizade | null,
  amizadeError: unknown = null
) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: amizade, error: amizadeError });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
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
    _inSubs: inSubs,
    _deleteEq: deleteEq,
  };
}

const SUB = { id: "s1", endpoint: "https://push/1", p256dh: "p", auth: "a" };
const ENV_BACKUP = { ...process.env };

function payloadEnviado() {
  return JSON.parse(mocks.sendNotification.mock.calls[0][1] as string);
}

describe("POST /api/rede/amizades/notificar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ENV_BACKUP };
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub-key";
    process.env.VAPID_PRIVATE_KEY = "priv-key";
    mocks.sendNotification.mockResolvedValue({});
  });

  it("401 sem sessão", async () => {
    mocks.createClient.mockReturnValue(supabaseClient(null, null));
    const res = await POST(request({ amizadeId: "a1" }) as never);
    expect(res.status).toBe(401);
  });

  it("400 sem amizadeId", async () => {
    mocks.createClient.mockReturnValue(supabaseClient("u1", null));
    const res = await POST(request({}) as never);
    expect(res.status).toBe(400);
  });

  it("404 quando a RLS não mostra a linha (não é uma das pontas)", async () => {
    mocks.createClient.mockReturnValue(supabaseClient("u1", null));
    const res = await POST(request({ amizadeId: "a1" }) as never);
    expect(res.status).toBe(404);
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("500 em erro real de banco ao ler o pedido", async () => {
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", null, { message: "boom" })
    );
    const res = await POST(request({ amizadeId: "a1" }) as never);
    expect(res.status).toBe(500);
  });

  it("pedido novo: avisa a destinatária com o nome de quem pediu", async () => {
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", {
        solicitante_id: "u1",
        destinatario_id: "u2",
        status: "pendente",
        criado_em: agora(),
        respondido_em: null,
      })
    );
    const admin = adminClient({
      perfil: { nome_exibicao: "Ana" },
      subs: [SUB],
    });
    mocks.getSupabaseAdmin.mockReturnValue(admin);

    const res = await POST(request({ amizadeId: "a1" }) as never);
    expect(await res.json()).toEqual({ sent: 1 });
    expect(admin._inSubs).toHaveBeenCalledWith("user_id", ["u2"]);
    expect(payloadEnviado()).toMatchObject({
      title: "Pedido de amizade",
      body: "Ana quer ser sua amiga na Rede.",
      tag: "rede-amizade-a1",
    });
  });

  it("pedido aceito: avisa quem pediu", async () => {
    mocks.createClient.mockReturnValue(
      supabaseClient("u2", {
        solicitante_id: "u1",
        destinatario_id: "u2",
        status: "aceita",
        criado_em: antigo(),
        respondido_em: agora(),
      })
    );
    const admin = adminClient({
      perfil: { nome_exibicao: "Bia" },
      subs: [SUB],
    });
    mocks.getSupabaseAdmin.mockReturnValue(admin);

    const res = await POST(request({ amizadeId: "a1" }) as never);
    expect(await res.json()).toEqual({ sent: 1 });
    expect(admin._inSubs).toHaveBeenCalledWith("user_id", ["u1"]);
    expect(payloadEnviado().body).toBe("Bia aceitou seu pedido de amizade.");
  });

  it.each([
    [
      "destinatária chamando num pedido pendente",
      "u2",
      { status: "pendente" as const, criado_em: agora(), respondido_em: null },
    ],
    [
      "quem pediu chamando num pedido aceito",
      "u1",
      { status: "aceita" as const, criado_em: agora(), respondido_em: agora() },
    ],
    [
      "pedido recusado",
      "u2",
      {
        status: "recusada" as const,
        criado_em: agora(),
        respondido_em: agora(),
      },
    ],
    [
      "pedido antigo (fora da janela) reenviado",
      "u1",
      { status: "pendente" as const, criado_em: antigo(), respondido_em: null },
    ],
  ])("não notifica: %s", async (_nome, userId, parcial) => {
    mocks.createClient.mockReturnValue(
      supabaseClient(userId, {
        solicitante_id: "u1",
        destinatario_id: "u2",
        ...parcial,
      })
    );
    const res = await POST(request({ amizadeId: "a1" }) as never);
    expect(await res.json()).toEqual({ sent: 0 });
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("remove inscrição expirada (410)", async () => {
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", {
        solicitante_id: "u1",
        destinatario_id: "u2",
        status: "pendente",
        criado_em: agora(),
        respondido_em: null,
      })
    );
    const admin = adminClient({ subs: [SUB] });
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    mocks.sendNotification.mockRejectedValue({ statusCode: 410 });

    const res = await POST(request({ amizadeId: "a1" }) as never);
    expect(await res.json()).toEqual({ sent: 0 });
    expect(admin._deleteEq).toHaveBeenCalledWith("id", "s1");
  });

  it("500 sem VAPID configurado", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", {
        solicitante_id: "u1",
        destinatario_id: "u2",
        status: "pendente",
        criado_em: agora(),
        respondido_em: null,
      })
    );
    mocks.getSupabaseAdmin.mockReturnValue(adminClient({ subs: [SUB] }));
    const res = await POST(request({ amizadeId: "a1" }) as never);
    expect(res.status).toBe(500);
  });
});

describe("wiring: RedeTab dispara o push de amizade", () => {
  const src = readFileSync(
    join(__dirname, "..", "..", "..", "components", "rede", "RedeTab.tsx"),
    "utf8"
  );

  it("ao aceitar e ao enviar pedido", () => {
    expect(src).toContain('fetch("/api/rede/amizades/notificar"');
    expect(src).toContain("notificarAmizade(req.id);");
    expect(src).toContain("notificarAmizade(amizade.id);");
  });
});
