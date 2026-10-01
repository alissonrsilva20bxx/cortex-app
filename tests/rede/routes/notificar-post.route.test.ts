import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Push de curtida/comentário pra autora da publicação. Mesmo padrão de
 * mock de `notificar-amizade.route.test.ts`.
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

import { POST } from "../../../app/api/rede/posts/notificar/route";
import { JANELA_NOTIFICAR_MS } from "../../../lib/rede/pushEnvio";

const agora = () => new Date().toISOString();
const antigo = () =>
  new Date(Date.now() - JANELA_NOTIFICAR_MS - 60_000).toISOString();

type Comentario = {
  autor_id: string;
  post_id: string;
  texto: string;
  criado_em: string;
};

function request(body: unknown) {
  return new Request("http://localhost/api/rede/posts/notificar", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Cliente com sessão: cada tabela devolve a linha de `rows` via maybeSingle. */
function supabaseClient(
  userId: string | null,
  rows: {
    post?: { autor_id: string } | null;
    curtida?: { criado_em: string } | null;
    comentario?: Comentario | null;
    postError?: unknown;
  }
) {
  const cadeia = (data: unknown, error: unknown = null) => {
    const maybeSingle = vi.fn().mockResolvedValue({ data, error });
    const eq: ReturnType<typeof vi.fn> = vi.fn();
    eq.mockReturnValue({ eq, maybeSingle });
    return { select: vi.fn().mockReturnValue({ eq }) };
  };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "rede_posts")
        return cadeia(rows.post ?? null, rows.postError ?? null);
      if (table === "rede_curtidas") return cadeia(rows.curtida ?? null);
      if (table === "rede_comentarios") return cadeia(rows.comentario ?? null);
      throw new Error(`tabela inesperada: ${table}`);
    }),
  };
}

function adminClient(opts: {
  perfil?: { nome_exibicao: string } | null;
  subs?: { id: string; endpoint: string; p256dh: string; auth: string }[];
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: opts.perfil ?? null,
    error: null,
  });
  const selectPerfil = vi
    .fn()
    .mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });
  const inSubs = vi
    .fn()
    .mockResolvedValue({ data: opts.subs ?? [], error: null });
  return {
    from: vi.fn((table: string) => {
      if (table === "rede_perfis") return { select: selectPerfil };
      if (table === "push_subscriptions")
        return {
          select: vi.fn().mockReturnValue({ in: inSubs }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      throw new Error(`tabela inesperada: ${table}`);
    }),
    _inSubs: inSubs,
  };
}

const SUB = { id: "s1", endpoint: "https://push/1", p256dh: "p", auth: "a" };
const ENV_BACKUP = { ...process.env };

function payloadEnviado() {
  return JSON.parse(mocks.sendNotification.mock.calls[0][1] as string);
}

describe("POST /api/rede/posts/notificar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ENV_BACKUP };
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub-key";
    process.env.VAPID_PRIVATE_KEY = "priv-key";
    mocks.sendNotification.mockResolvedValue({});
  });

  it("401 sem sessão", async () => {
    mocks.createClient.mockReturnValue(supabaseClient(null, {}));
    const res = await POST(request({ tipo: "curtida", postId: "p1" }) as never);
    expect(res.status).toBe(401);
  });

  it.each([
    [{}],
    [{ tipo: "outro", postId: "p1" }],
    [{ tipo: "comentario", postId: "p1" }],
    [{ tipo: "curtida" }],
  ])("400 com payload inválido %j", async (body) => {
    mocks.createClient.mockReturnValue(supabaseClient("u1", {}));
    const res = await POST(request(body) as never);
    expect(res.status).toBe(400);
  });

  it("404 quando a RLS esconde o post (inclui bloqueio)", async () => {
    mocks.createClient.mockReturnValue(supabaseClient("u1", { post: null }));
    const res = await POST(request({ tipo: "curtida", postId: "p1" }) as never);
    expect(res.status).toBe(404);
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("500 em erro real ao ler o post", async () => {
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", { postError: { message: "boom" } })
    );
    const res = await POST(request({ tipo: "curtida", postId: "p1" }) as never);
    expect(res.status).toBe(500);
  });

  it("curtida: avisa a autora", async () => {
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", {
        post: { autor_id: "autora" },
        curtida: { criado_em: agora() },
      })
    );
    const admin = adminClient({
      perfil: { nome_exibicao: "Ana" },
      subs: [SUB],
    });
    mocks.getSupabaseAdmin.mockReturnValue(admin);

    const res = await POST(request({ tipo: "curtida", postId: "p1" }) as never);
    expect(await res.json()).toEqual({ sent: 1 });
    expect(admin._inSubs).toHaveBeenCalledWith("user_id", ["autora"]);
    expect(payloadEnviado()).toMatchObject({
      title: "Nova curtida",
      body: "Ana curtiu sua publicação.",
      tag: "rede-curtida-p1-u1",
      url: "/",
    });
  });

  it("comentário: avisa a autora com o texto (cortado em 80)", async () => {
    const longo = "a".repeat(100);
    mocks.createClient.mockReturnValue(
      supabaseClient("u1", {
        post: { autor_id: "autora" },
        comentario: {
          autor_id: "u1",
          post_id: "p1",
          texto: longo,
          criado_em: agora(),
        },
      })
    );
    mocks.getSupabaseAdmin.mockReturnValue(
      adminClient({ perfil: { nome_exibicao: "Bia" }, subs: [SUB] })
    );

    const res = await POST(
      request({ tipo: "comentario", postId: "p1", comentarioId: "c1" }) as never
    );
    expect(await res.json()).toEqual({ sent: 1 });
    expect(payloadEnviado()).toMatchObject({
      title: "Novo comentário",
      body: `Bia comentou: ${"a".repeat(80)}…`,
      tag: "rede-comentario-c1",
    });
  });

  it.each([
    [
      "próprio post",
      { tipo: "curtida", postId: "p1" },
      { post: { autor_id: "u1" }, curtida: { criado_em: agora() } },
    ],
    [
      "curtida inexistente (já descurtiu)",
      { tipo: "curtida", postId: "p1" },
      { post: { autor_id: "autora" }, curtida: null },
    ],
    [
      "curtida antiga",
      { tipo: "curtida", postId: "p1" },
      { post: { autor_id: "autora" }, curtida: { criado_em: antigo() } },
    ],
    [
      "comentário de outra pessoa",
      { tipo: "comentario", postId: "p1", comentarioId: "c1" },
      {
        post: { autor_id: "autora" },
        comentario: {
          autor_id: "outra",
          post_id: "p1",
          texto: "oi",
          criado_em: agora(),
        },
      },
    ],
    [
      "comentário de outro post",
      { tipo: "comentario", postId: "p1", comentarioId: "c1" },
      {
        post: { autor_id: "autora" },
        comentario: {
          autor_id: "u1",
          post_id: "p2",
          texto: "oi",
          criado_em: agora(),
        },
      },
    ],
    [
      "comentário antigo",
      { tipo: "comentario", postId: "p1", comentarioId: "c1" },
      {
        post: { autor_id: "autora" },
        comentario: {
          autor_id: "u1",
          post_id: "p1",
          texto: "oi",
          criado_em: antigo(),
        },
      },
    ],
  ])("não notifica: %s", async (_nome, body, rows) => {
    mocks.createClient.mockReturnValue(supabaseClient("u1", rows));
    const res = await POST(request(body) as never);
    expect(await res.json()).toEqual({ sent: 0 });
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });
});

describe("wiring: RedeTab dispara o push de curtida/comentário", () => {
  const src = readFileSync(
    join(__dirname, "..", "..", "..", "components", "rede", "RedeTab.tsx"),
    "utf8"
  );

  it("só ao curtir (não ao descurtir) e ao comentar", () => {
    expect(src).toContain('fetch("/api/rede/posts/notificar"');
    expect(src).toContain(
      'if (curtido) notificarPost({ tipo: "curtida", postId: id });'
    );
    expect(src).toMatch(/notificarPost\(\{\s*tipo: "comentario",/);
  });
});
