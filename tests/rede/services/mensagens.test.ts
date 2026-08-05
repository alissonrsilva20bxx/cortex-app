import { describe, expect, it, vi } from "vitest";

import {
  abrirConversa1a1,
  assinarMensagensConversa,
  enviarMensagem,
  listarConversas,
  listarMensagens,
  marcarMensagemComoLida,
  reconcileConfirmedMessage,
} from "../../../lib/rede/mensagens";

function clienteComUsuario(userId = "user-1") {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    rpc: vi.fn(),
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn().mockResolvedValue("ok"),
  };
}

describe("serviço de mensagens", () => {
  it("abre a conversa 1:1 pelo RPC atômico e reutilizável", async () => {
    const client = clienteComUsuario();
    client.rpc.mockResolvedValue({ data: "conversa-1", error: null });

    await expect(
      abrirConversa1a1(client as never, { outroUserId: "user-2" })
    ).resolves.toBe("conversa-1");
    expect(client.rpc).toHaveBeenCalledWith("rede_criar_conversa_1a1", {
      outro_user_id: "user-2",
    });
  });

  it("lista conversas com a última mensagem, não lidas e o outro participante", async () => {
    const client = clienteComUsuario();
    client.from.mockImplementation((table: string) => {
      if (table === "rede_conversas_participantes") {
        return {
          select: (cols: string) => {
            if (cols === "conversa_id") {
              return {
                eq: () =>
                  Promise.resolve({
                    data: [{ conversa_id: "conversa-1" }],
                    error: null,
                  }),
              };
            }
            return {
              in: () =>
                Promise.resolve({
                  data: [
                    { conversa_id: "conversa-1", user_id: "user-1" },
                    { conversa_id: "conversa-1", user_id: "user-2" },
                  ],
                  error: null,
                }),
            };
          },
        };
      }
      if (table === "rede_mensagens") {
        return {
          select: () => ({
            in: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      conversa_id: "conversa-1",
                      autor_id: "user-2",
                      texto: "Oi!",
                      criado_em: "2026-01-01T00:00:00.000Z",
                      lida_em: null,
                    },
                    {
                      conversa_id: "conversa-1",
                      autor_id: "user-2",
                      texto: "Tudo bem?",
                      criado_em: "2026-01-01T00:01:00.000Z",
                      lida_em: null,
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "rede_perfis") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  {
                    user_id: "user-2",
                    nome_exibicao: "Bia",
                    cor_avatar: "#abc",
                    bio: null,
                  },
                ],
                error: null,
              }),
          }),
        };
      }
      throw new Error(`tabela inesperada: ${table}`);
    });

    await expect(listarConversas(client as never)).resolves.toEqual([
      {
        id: "conversa-1",
        outroUserId: "user-2",
        outroNome: "Bia",
        outroCor: "#abc",
        ultimaMensagem: "Tudo bem?",
        ultimaMensagemEm: "2026-01-01T00:01:00.000Z",
        naoLidas: 2,
      },
    ]);
  });

  it("devolve lista vazia sem consultar mais nada quando não participa de nenhuma conversa", async () => {
    const client = clienteComUsuario();
    const eq = vi.fn().mockResolvedValue({ data: [], error: null });
    client.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) });

    await expect(listarConversas(client as never)).resolves.toEqual([]);
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("lista mensagens em ordem cronológica, marcando deMim contra o usuário autenticado", async () => {
    const mensagens = [
      {
        id: "m1",
        conversa_id: "conversa-1",
        autor_id: "user-1",
        texto: "Oi",
        criado_em: "2026-01-01T00:00:00.000Z",
        lida_em: null,
      },
      {
        id: "m2",
        conversa_id: "conversa-1",
        autor_id: "user-2",
        texto: "E aí",
        criado_em: "2026-01-01T00:01:00.000Z",
        lida_em: null,
      },
    ];
    const order = vi.fn().mockResolvedValue({ data: mensagens, error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ select });

    await expect(
      listarMensagens(client as never, "conversa-1")
    ).resolves.toEqual([
      {
        id: "m1",
        autorId: "user-1",
        texto: "Oi",
        criadoEm: "2026-01-01T00:00:00.000Z",
        lidaEm: null,
        deMim: true,
      },
      {
        id: "m2",
        autorId: "user-2",
        texto: "E aí",
        criadoEm: "2026-01-01T00:01:00.000Z",
        lidaEm: null,
        deMim: false,
      },
    ]);
  });

  it("envia texto como o usuário autenticado", async () => {
    const mensagem = {
      id: "mensagem-1",
      conversa_id: "conversa-1",
      autor_id: "user-1",
      texto: "Olá",
    };
    const single = vi.fn().mockResolvedValue({ data: mensagem, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ insert });

    await expect(
      enviarMensagem(client as never, {
        conversaId: "conversa-1",
        texto: "Olá",
      })
    ).resolves.toEqual(mensagem);
    expect(insert).toHaveBeenCalledWith({
      conversa_id: "conversa-1",
      autor_id: "user-1",
      texto: "Olá",
    });
  });

  it("marca uma mensagem recebida como lida", async () => {
    const mensagem = { id: "mensagem-1", lida_em: "2026-07-26T00:00:00.000Z" };
    const single = vi.fn().mockResolvedValue({ data: mensagem, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eqConversa = vi.fn().mockReturnValue({ select });
    const eqId = vi.fn().mockReturnValue({ eq: eqConversa });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ update });

    await expect(
      marcarMensagemComoLida(client as never, {
        conversaId: "conversa-1",
        mensagemId: "mensagem-1",
      })
    ).resolves.toEqual(mensagem);
    expect(update).toHaveBeenCalledWith({ lida_em: expect.any(String) });
    expect(eqId).toHaveBeenCalledWith("id", "mensagem-1");
    expect(eqConversa).toHaveBeenCalledWith("conversa_id", "conversa-1");
  });

  it("só assina o canal depois de confirmar acesso visível à conversa", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "conversa-1" }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const subscribe = vi.fn((callback) => callback("SUBSCRIBED"));
    const channel = { on: vi.fn(), subscribe };
    channel.on.mockReturnValue(channel);
    const client = clienteComUsuario();
    client.from.mockReturnValue({ select });
    client.channel.mockReturnValue(channel);
    const onMensagem = vi.fn();

    await assinarMensagensConversa(client as never, {
      conversaId: "conversa-1",
      onMensagem,
    });

    expect(select).toHaveBeenCalledWith("id");
    expect(eq).toHaveBeenCalledWith("id", "conversa-1");
    expect(client.channel).toHaveBeenCalledWith(
      expect.stringMatching(/^rede-mensagens:conversa-1:\d+$/)
    );
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "rede_mensagens",
        filter: "conversa_id=eq.conversa-1",
      },
      expect.any(Function)
    );
    expect(subscribe).toHaveBeenCalledOnce();
    const callback = channel.on.mock.calls[0][2];
    const novaMensagem = { id: "mensagem-2", texto: "Cheguei" };
    callback({ new: novaMensagem });
    expect(onMensagem).toHaveBeenCalledWith(novaMensagem);
  });

  it("mantem duas assinaturas da mesma conversa em canais independentes", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "conversa-1" }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const criarCanal = () => {
      const channel = {
        on: vi.fn(),
        subscribe: vi.fn((callback) => callback("SUBSCRIBED")),
      };
      channel.on.mockReturnValue(channel);
      return channel;
    };
    const primeiroCanal = criarCanal();
    const segundoCanal = criarCanal();
    const client = clienteComUsuario();
    client.from.mockReturnValue({ select });
    client.channel
      .mockReturnValueOnce(primeiroCanal)
      .mockReturnValueOnce(segundoCanal);

    const primeiro = await assinarMensagensConversa(client as never, {
      conversaId: "conversa-1",
      onMensagem: vi.fn(),
    });
    const segundo = await assinarMensagensConversa(client as never, {
      conversaId: "conversa-1",
      onMensagem: vi.fn(),
    });

    expect(client.channel.mock.calls[0][0]).not.toBe(
      client.channel.mock.calls[1][0]
    );
    await client.removeChannel(primeiro);
    expect(client.removeChannel).toHaveBeenCalledWith(primeiroCanal);
    expect(segundo).toBe(segundoCanal);
  });

  it.each(["CHANNEL_ERROR", "TIMED_OUT"] as const)(
    "remove o canal e rejeita quando a assinatura termina com %s",
    async (status) => {
      const maybeSingle = vi
        .fn()
        .mockResolvedValue({ data: { id: "conversa-1" }, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      const channel = {
        on: vi.fn(),
        subscribe: vi.fn((callback) => callback(status)),
      };
      channel.on.mockReturnValue(channel);
      const client = clienteComUsuario();
      client.from.mockReturnValue({ select });
      client.channel.mockReturnValue(channel);

      await expect(
        assinarMensagensConversa(client as never, {
          conversaId: "conversa-1",
          onMensagem: vi.fn(),
        })
      ).rejects.toThrow(`Falha ao assinar conversa: ${status}`);
      expect(client.removeChannel).toHaveBeenCalledWith(channel);
    }
  );

  it("não cria canal quando a conversa não está visível ao usuário", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const client = clienteComUsuario();
    client.from.mockReturnValue({ select });

    await expect(
      assinarMensagensConversa(client as never, {
        conversaId: "conversa-1",
        onMensagem: vi.fn(),
      })
    ).rejects.toThrow("Sem acesso à conversa");
    expect(client.channel).not.toHaveBeenCalled();
  });

  it("recusa escrita e assinatura sem usuário autenticado", async () => {
    const client = clienteComUsuario();
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      enviarMensagem(client as never, {
        conversaId: "conversa-1",
        texto: "Olá",
      })
    ).rejects.toThrow("Usuário não autenticado");
    await expect(
      assinarMensagensConversa(client as never, {
        conversaId: "conversa-1",
        onMensagem: vi.fn(),
      })
    ).rejects.toThrow("Usuário não autenticado");
    expect(client.from).not.toHaveBeenCalled();
    expect(client.channel).not.toHaveBeenCalled();
  });
});

describe("reconcileConfirmedMessage", () => {
  function otimista(id: string, texto: string) {
    return { id, texto, deMim: true, status: "sending" as const };
  }

  it("substitui a mensagem otimista pela confirmada quando o REST responde antes do Realtime (casa por localId)", () => {
    const atual = [otimista("temp-1", "Oi")];
    const confirmada = { id: "real-1", texto: "Oi", deMim: true };

    expect(reconcileConfirmedMessage(atual, confirmada, "temp-1")).toEqual([
      confirmada,
    ]);
  });

  it("substitui a mensagem otimista pendente quando o eco do Realtime chega antes do REST (casa por texto+deMim, sem localId)", () => {
    const atual = [otimista("temp-1", "Oi")];
    const confirmada = { id: "real-1", texto: "Oi", deMim: true };

    // Simula o eco do Realtime, que não sabe o localId gerado no cliente.
    expect(reconcileConfirmedMessage(atual, confirmada)).toEqual([confirmada]);
  });

  it("não duplica quando a mensagem já reconciliada (por id real) chega de novo pela outra via", () => {
    const confirmada = { id: "real-1", texto: "Oi", deMim: true };
    // Já reconciliada uma vez (por exemplo pelo REST) -- o eco do Realtime
    // pro mesmo id real não deve criar uma segunda entrada.
    const atual = [confirmada];

    expect(reconcileConfirmedMessage(atual, confirmada)).toBe(atual);
    expect(reconcileConfirmedMessage(atual, confirmada, "temp-1")).toBe(atual);
  });

  it("reconcilia em ordem FIFO quando o mesmo texto foi enviado duas vezes seguidas", () => {
    const atual = [otimista("temp-1", "oi"), otimista("temp-2", "oi")];
    const primeiraConfirmada = { id: "real-1", texto: "oi", deMim: true };

    const depoisDaPrimeira = reconcileConfirmedMessage(
      atual,
      primeiraConfirmada
    );
    expect(depoisDaPrimeira).toEqual([
      primeiraConfirmada,
      otimista("temp-2", "oi"),
    ]);

    const segundaConfirmada = { id: "real-2", texto: "oi", deMim: true };
    const depoisDaSegunda = reconcileConfirmedMessage(
      depoisDaPrimeira,
      segundaConfirmada
    );
    expect(depoisDaSegunda).toEqual([primeiraConfirmada, segundaConfirmada]);
  });

  it("anexa mensagem de outra pessoa sem tentar casar contra placeholders próprios pendentes", () => {
    const atual = [otimista("temp-1", "Oi")];
    const daOutraPessoa = { id: "real-9", texto: "E aí", deMim: false };

    expect(reconcileConfirmedMessage(atual, daOutraPessoa)).toEqual([
      ...atual,
      daOutraPessoa,
    ]);
  });

  it("anexa mensagem própria vinda de outra aba/sessão (sem placeholder local pendente) em vez de descartá-la", () => {
    const atual: ReturnType<typeof otimista>[] = [];
    const deOutraSessao = {
      id: "real-5",
      texto: "Mandado do celular",
      deMim: true,
    };

    expect(reconcileConfirmedMessage(atual, deOutraSessao)).toEqual([
      deOutraSessao,
    ]);
  });

  it("reconcilia uma mensagem marcada como 'error' (ack perdido) quando o eco do Realtime confirma que o envio deu certo", () => {
    // enviarMensagem perdeu a resposta (queda de rede), doSendMessage marcou
    // a bolha local como "error" -- mas o insert já tinha ido pro banco, e
    // o eco do Realtime chega depois confirmando. Sem casar contra "error"
    // também, isso viraria uma segunda bolha ao lado da que ficou travada.
    const falhou = {
      id: "temp-1",
      texto: "Oi",
      deMim: true,
      status: "error" as const,
    };
    const confirmada = { id: "real-1", texto: "Oi", deMim: true };

    expect(reconcileConfirmedMessage([falhou], confirmada)).toEqual([
      confirmada,
    ]);
  });
});
