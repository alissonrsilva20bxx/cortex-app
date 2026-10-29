import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * As rotas `/api/rede/*` perguntam à regra única (lib/rede/acessoRede.ts)
 * se a chamadora está na Rede: teste acabou, sem assinatura e sem convite
 * antigo = 403, antes de qualquer outra leitura. No teste, segue.
 */

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  resolveGateAuth: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/supabase-server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("../../../lib/supabaseAdmin", () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));
vi.mock("../../../lib/devPreview/serverAuth", () => ({
  resolveGateAuth: mocks.resolveGateAuth,
}));
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));

import { POST as notificarPost } from "../../../app/api/rede/posts/notificar/route";
import { POST as notificarAmizade } from "../../../app/api/rede/amizades/notificar/route";
import { POST as notificarMensagem } from "../../../app/api/rede/mensagens/notificar/route";
import { POST as fotoUpload } from "../../../app/api/rede/foto-upload/route";

const haDias = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

/** Sessão da chamadora. Só `configuracoes` e `rede_convites` respondem;
 * qualquer outra tabela é anotada em `outras` (o que a rota leu depois). */
function sessao(config: unknown) {
  const outras: string[] = [];
  const resposta = (tabela: string) => {
    if (tabela === "configuracoes")
      return { data: config, error: null, status: 200 };
    if (tabela === "rede_convites") return { data: [], error: null, status: 200 };
    outras.push(tabela);
    return { data: null, error: null, status: 200 };
  };
  const consulta = (tabela: string) => {
    const r = () => Promise.resolve(resposta(tabela));
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "gte", "limit"])
      q[m] = () => q;
    q.maybeSingle = r;
    q.single = r;
    q.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) =>
      r().then(ok, erro);
    return q;
  };
  return {
    outras,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "u1" } },
        error: null,
      }),
      refreshSession: vi.fn(),
    },
    from: vi.fn(consulta),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  };
}

const json = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;

function foto() {
  const form = new FormData();
  form.set("postId", "post-1");
  form.set("ordem", "1");
  return new Request("http://localhost/api/rede/foto-upload", {
    method: "POST",
    body: form,
  }) as never;
}

const vencido = { assinatura_status: "trial", trial_started_at: haDias(40) };
const noTeste = { assinatura_status: "trial", trial_started_at: haDias(2) };

const rotas: [string, (s: ReturnType<typeof sessao>) => Promise<Response>][] = [
  [
    "posts/notificar",
    () => notificarPost(json("/api/rede/posts/notificar", { tipo: "curtida", postId: "p1" })),
  ],
  [
    "amizades/notificar",
    () => notificarAmizade(json("/api/rede/amizades/notificar", { amizadeId: "a1" })),
  ],
  [
    "mensagens/notificar",
    () =>
      notificarMensagem(
        json("/api/rede/mensagens/notificar", { conversaId: "c1", texto: "oi" })
      ),
  ],
  [
    "foto-upload",
    (s) => {
      mocks.resolveGateAuth.mockResolvedValue({
        kind: "authenticated",
        supabase: s,
        userId: "u1",
      });
      return fotoUpload(foto());
    },
  ],
];

describe("rotas da Rede: a regra única de acesso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(rotas)(
    "%s: teste acabou, sem assinatura nem convite -> 403 antes de ler a Rede",
    async (_nome, chamar) => {
      const s = sessao(vencido);
      mocks.createClient.mockReturnValue(s);
      const r = await chamar(s);
      expect(r.status).toBe(403);
      expect(s.outras).toEqual([]);
      expect(s.rpc).not.toHaveBeenCalled();
    }
  );

  it.each(rotas)(
    "%s: no teste, sem convite -> passa da porta do acesso",
    async (_nome, chamar) => {
      const s = sessao(noTeste);
      mocks.createClient.mockReturnValue(s);
      await chamar(s);
      // passou da porta: a rota já leu a Rede (post, amizade, conversa)
      expect(s.outras.length).toBeGreaterThan(0);
    }
  );
});
