import { describe, expect, it } from "vitest";

import { createMockSupabaseClient } from "../../../lib/mockSupabase";
import { listarConversas } from "../../../lib/rede/mensagens";

/**
 * O harness `/dev-preview/rede` monta o `RedeTab` real contra o cliente
 * mock. `RedeTab` chama `listarConversas` na montagem -> `rpc(
 * "rede_listar_resumo_conversas")`. Sem essa RPC no mock, o `RedeTab` pega o
 * erro genérico e cospe "Não foi possível carregar as conversas" (2x, por
 * causa do StrictMode) + um `console.error` -- exatamente os avisos que
 * apareceram na validação de iPhone da PR #112.
 *
 * Este teste fixa a RPC do mock espelhando a migration 0024: uma linha por
 * conversa minha, última mensagem, não lidas (do outro, sem `lida_em`) e o
 * filtro de conversa oculta.
 */

const EU = "user-eu";
const OUTRA = "user-outra";

function cliente(extra: Record<string, unknown>[] = []) {
  return createMockSupabaseClient(
    {
      tables: {
        rede_perfis: [
          {
            user_id: EU,
            nome_exibicao: "Eu",
            cor_avatar: "#fff",
            avatar_url: null,
          },
          {
            user_id: OUTRA,
            nome_exibicao: "Outra",
            cor_avatar: "#f0f",
            avatar_url: null,
          },
        ],
        rede_conversas: [{ id: "c1" }],
        rede_conversas_participantes: [
          { conversa_id: "c1", user_id: EU, ...(extra[0] ?? {}) },
          { conversa_id: "c1", user_id: OUTRA },
        ],
        rede_mensagens: [
          {
            id: "m1",
            conversa_id: "c1",
            autor_id: OUTRA,
            texto: "primeira",
            criado_em: "2026-09-01T10:00:00.000Z",
            lida_em: null,
          },
          {
            id: "m2",
            conversa_id: "c1",
            autor_id: OUTRA,
            texto: "última",
            criado_em: "2026-09-01T11:00:00.000Z",
            lida_em: null,
          },
        ],
      },
      cofreFiles: [],
    },
    EU
  );
}

describe("mock rpc rede_listar_resumo_conversas", () => {
  it("resume a conversa com última mensagem e não lidas", async () => {
    const conversas = await listarConversas(cliente() as never);
    expect(conversas).toHaveLength(1);
    expect(conversas[0]).toMatchObject({
      id: "c1",
      outroUserId: OUTRA,
      outroNome: "Outra",
      ultimaMensagem: "última",
      ultimaMensagemEm: "2026-09-01T11:00:00.000Z",
      naoLidas: 2,
    });
  });

  it("não conta como não lida a mensagem própria", async () => {
    const c = createMockSupabaseClient(
      {
        tables: {
          rede_perfis: [
            {
              user_id: EU,
              nome_exibicao: "Eu",
              cor_avatar: "#fff",
              avatar_url: null,
            },
            {
              user_id: OUTRA,
              nome_exibicao: "Outra",
              cor_avatar: "#f0f",
              avatar_url: null,
            },
          ],
          rede_conversas: [{ id: "c1" }],
          rede_conversas_participantes: [
            { conversa_id: "c1", user_id: EU },
            { conversa_id: "c1", user_id: OUTRA },
          ],
          rede_mensagens: [
            {
              id: "m1",
              conversa_id: "c1",
              autor_id: EU,
              texto: "minha",
              criado_em: "2026-09-01T10:00:00.000Z",
              lida_em: null,
            },
          ],
        },
        cofreFiles: [],
      },
      EU
    );
    const conversas = await listarConversas(c as never);
    expect(conversas[0].naoLidas).toBe(0);
    expect(conversas[0].ultimaMensagem).toBe("minha");
  });

  it("esconde conversa oculta sem mensagem nova depois de oculta_desde", async () => {
    const conversas = await listarConversas(
      cliente([{ oculta_desde: "2026-09-02T00:00:00.000Z" }]) as never
    );
    expect(conversas).toHaveLength(0);
  });

  it("reabre conversa oculta quando chega mensagem nova", async () => {
    const conversas = await listarConversas(
      cliente([{ oculta_desde: "2026-09-01T10:30:00.000Z" }]) as never
    );
    expect(conversas).toHaveLength(1);
  });
});
