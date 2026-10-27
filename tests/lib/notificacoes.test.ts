import { describe, expect, it } from "vitest";
import { proximoLembrete, type Lembrete } from "../../lib/notificacoes";
import { TEXTOS_LEMBRETE } from "../../lib/textosNotificacoes";
import type { Job } from "../../lib/types";

/**
 * Notificação sem nome de cliente e sem e-mail (regra do capitão): o push
 * aparece na tela bloqueada, onde qualquer pessoa ao lado lê. O lembrete
 * do dia diz só que há um atendimento e quando.
 */

const REF = new Date("2026-10-27T08:00:00");
const NOME = "Ana Souza";
const EMAIL = "ana.souza@exemplo.com";

function job(parcial: Partial<Job>): Job {
  return {
    id: crypto.randomUUID(),
    clienteNome: NOME,
    data: "2026-10-27",
    hora: "15:30",
    valor: 50,
    modalidade: "presencial" as Job["modalidade"],
    status: "agendado",
    criadoEm: "2026-10-01T10:00:00Z",
    ...parcial,
  };
}

function semDadoDaCliente(lembrete: Lembrete | null, ...dados: string[]) {
  expect(lembrete).not.toBeNull();
  const tudo = `${lembrete!.title} ${lembrete!.body}`;
  for (const dado of dados) {
    expect(tudo).not.toContain(dado);
    for (const parte of dado.split(/\s+/)) expect(tudo).not.toContain(parte);
  }
  expect(tudo).not.toContain("@");
}

describe("lembrete de atendimento sem nome de cliente nem e-mail", () => {
  it("hoje: diz só o horário", () => {
    const l = proximoLembrete([job({})], REF);
    semDadoDaCliente(l, NOME);
    expect(l!.title).toBe(TEXTOS_LEMBRETE.atendimento.titulo);
    expect(l!.body).toBe(TEXTOS_LEMBRETE.atendimento.corpo(false, "15h30"));
  });

  it("amanhã: diz só o dia e o horário", () => {
    const l = proximoLembrete([job({ data: "2026-10-28", hora: "09:00" })], REF);
    semDadoDaCliente(l, NOME);
    expect(l!.body).toBe(TEXTOS_LEMBRETE.atendimento.corpo(true, "09h00"));
  });

  it("cliente gravada com e-mail no nome: o e-mail não sai no push", () => {
    const l = proximoLembrete([job({ clienteNome: EMAIL })], REF);
    semDadoDaCliente(l, EMAIL);
  });
});

describe("cliente recorrente sem nome de cliente nem e-mail", () => {
  const passados = (nome: string) => [
    job({ clienteNome: nome, data: "2026-09-01", status: "concluído" }),
    job({ clienteNome: nome, data: "2026-10-01", status: "concluído" }),
  ];

  it("avisa que uma cliente costuma voltar, sem dizer quem", () => {
    const l = proximoLembrete(passados(NOME), REF);
    expect(l!.tag).toBe("cliente-recorrente");
    expect(l!.body).toBe(TEXTOS_LEMBRETE.recorrente.corpo);
    semDadoDaCliente(l, NOME);
  });

  it("nome que é e-mail também não sai", () => {
    semDadoDaCliente(proximoLembrete(passados(EMAIL), REF), EMAIL);
  });
});
