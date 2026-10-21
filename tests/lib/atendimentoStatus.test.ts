import { describe, expect, it } from "vitest";
import {
  horarioChegou,
  mudarStatus,
  podeConcluir,
  podeConfirmar,
  podeDesmarcar,
  statusPermitidos,
  estadoDoDescanso,
  totalPrevistoDoDia,
  contaComoDiaAtivo,
  type NovoStatus,
} from "@/lib/atendimentos/status";
import { proximoAtendimento as proximoDaInicio } from "@/components/home/inicioAgenda";
import { proximoAtendimento as proximoDaAgenda } from "@/components/jobs/agendaSemana";
import type { Job, JobStatus } from "@/lib/types";

const job = (id: string, valor: number, status: JobStatus): Job => ({
  id,
  clienteNome: id,
  data: "2026-10-21",
  hora: "10:00",
  valor,
  modalidade: "online",
  status,
  criadoEm: "2026-10-01",
  pagoEm: null,
});

describe("totalPrevistoDoDia", () => {
  it("não soma cancelados", () => {
    const dia = [
      job("a", 100, "agendado"),
      job("b", 200, "confirmado"),
      job("c", 300, "concluído"),
      job("d", 999, "cancelado"),
    ];
    expect(totalPrevistoDoDia(dia)).toBe(600);
  });

  it("dia só com cancelados soma zero", () => {
    expect(totalPrevistoDoDia([job("a", 50, "cancelado")])).toBe(0);
  });

  it("dia vazio soma zero", () => {
    expect(totalPrevistoDoDia([])).toBe(0);
  });
});

describe("fluxo de status: Agendado -> Confirmado -> Concluído ou Não aconteceu", () => {
  const ANTES = new Date("2026-10-21T09:00:00");
  const NO_HORARIO = new Date("2026-10-21T10:00:00");
  const DEPOIS = new Date("2026-10-21T15:00:00");

  it("antes do horário: só Confirmar (e só do agendado)", () => {
    expect(podeConfirmar(job("a", 1, "agendado"), ANTES)).toBe(true);
    expect(podeConfirmar(job("a", 1, "confirmado"), ANTES)).toBe(false);
    expect(podeConcluir(job("a", 1, "agendado"), ANTES)).toBe(false);
    expect(podeConcluir(job("a", 1, "confirmado"), ANTES)).toBe(false);
  });

  it("no horário e depois: Concluir ou Não aconteceu, de agendado e confirmado; Confirmar some", () => {
    for (const agora of [NO_HORARIO, DEPOIS]) {
      expect(horarioChegou(job("a", 1, "agendado"), agora)).toBe(true);
      expect(podeConfirmar(job("a", 1, "agendado"), agora)).toBe(false);
      expect(podeConcluir(job("a", 1, "agendado"), agora)).toBe(true);
      expect(podeConcluir(job("a", 1, "confirmado"), agora)).toBe(true);
    }
  });

  it("concluído e cancelado não têm ação de status", () => {
    for (const status of ["concluído", "cancelado"] as const) {
      expect(podeConfirmar(job("a", 1, status), DEPOIS)).toBe(false);
      expect(podeConcluir(job("a", 1, status), DEPOIS)).toBe(false);
    }
  });

  it("mudarStatus grava o status quando o fluxo deixa", async () => {
    const gravados: [string, NovoStatus][] = [];
    const deps = {
      atualizar: async (id: string, status: NovoStatus) => {
        gravados.push([id, status]);
        return { error: null };
      },
      registrar: () => {},
    };
    expect(
      await mudarStatus(job("x", 1, "agendado"), "confirmado", deps, ANTES)
    ).toEqual({ ok: true });
    expect(
      await mudarStatus(job("y", 1, "confirmado"), "concluído", deps, DEPOIS)
    ).toEqual({ ok: true });
    expect(
      await mudarStatus(job("z", 1, "agendado"), "cancelado", deps, DEPOIS)
    ).toEqual({ ok: true });
    expect(gravados).toEqual([
      ["x", "confirmado"],
      ["y", "concluído"],
      ["z", "cancelado"],
    ]);
  });

  it("recusa concluir atendimento futuro, e não grava", async () => {
    let chamadas = 0;
    const deps = {
      atualizar: async () => {
        chamadas++;
        return { error: null };
      },
      registrar: () => {},
    };
    const futuro = job("f", 1, "agendado");
    expect(await mudarStatus(futuro, "concluído", deps, ANTES)).toMatchObject({
      ok: false,
      motivo: "fora-do-fluxo",
    });
    expect(chamadas).toBe(0);
  });

  it("recusa confirmar depois do horário", async () => {
    const r = await mudarStatus(
      job("a", 1, "agendado"),
      "confirmado",
      { atualizar: async () => ({ error: null }), registrar: () => {} },
      DEPOIS
    );
    expect(r).toMatchObject({ ok: false, motivo: "fora-do-fluxo" });
  });

  it("erro do banco volta como falha, com o detalhe", async () => {
    const r = await mudarStatus(
      job("a", 1, "agendado"),
      "concluído",
      {
        atualizar: async () => ({ error: { message: "sem rede" } }),
        registrar: () => {},
      },
      DEPOIS
    );
    expect(r).toEqual({
      ok: false,
      motivo: "falha-ao-gravar",
      detalhe: "sem rede",
    });
  });
});

describe("dia contado da Jornada: só quando o atendimento vira concluído", () => {
  const DEPOIS = new Date("2026-10-21T15:00:00");
  const ANTES = new Date("2026-10-21T09:00:00");

  function deps() {
    const acoes: string[] = [];
    return {
      acoes,
      d: {
        atualizar: async () => ({ error: null }),
        registrar: (acao: string) => void acoes.push(acao),
      },
    };
  }

  it("concluir registra atendimento uma vez", async () => {
    const { acoes, d } = deps();
    await mudarStatus(job("a", 1, "agendado"), "concluído", d, DEPOIS);
    expect(acoes).toEqual(["atendimento"]);
  });

  it("confirmar e Não aconteceu não registram", async () => {
    const { acoes, d } = deps();
    await mudarStatus(job("a", 1, "agendado"), "confirmado", d, ANTES);
    await mudarStatus(job("b", 1, "agendado"), "cancelado", d, DEPOIS);
    expect(acoes).toEqual([]);
  });

  it("se a gravação falha, não registra", async () => {
    const acoes: string[] = [];
    await mudarStatus(
      job("a", 1, "agendado"),
      "concluído",
      {
        atualizar: async () => ({ error: { message: "x" } }),
        registrar: (acao) => void acoes.push(acao),
      },
      DEPOIS
    );
    expect(acoes).toEqual([]);
  });

  it("concluir fora do fluxo (atendimento futuro) não registra", async () => {
    const { acoes, d } = deps();
    await mudarStatus(job("a", 1, "agendado"), "concluído", d, ANTES);
    expect(acoes).toEqual([]);
  });

  it("no formulário: criar agendado não conta; criar já concluído conta; editar o que já era concluído não conta de novo", () => {
    expect(contaComoDiaAtivo(null, "agendado")).toBe(false);
    expect(contaComoDiaAtivo(null, "concluído")).toBe(true);
    expect(contaComoDiaAtivo("agendado", "concluído")).toBe(true);
    expect(contaComoDiaAtivo("confirmado", "concluído")).toBe(true);
    expect(contaComoDiaAtivo("concluído", "concluído")).toBe(false);
    expect(contaComoDiaAtivo("agendado", "cancelado")).toBe(false);
  });
});

describe("Cliente desmarcou: cancelar ANTES do horário, só pelo mudarStatus", () => {
  const ANTES = new Date("2026-10-21T09:00:00");
  const DEPOIS = new Date("2026-10-21T15:00:00");
  const deps = (gravados: string[] = []) => ({
    atualizar: async (_id: string, status: NovoStatus) => {
      gravados.push(status);
      return { error: null };
    },
    registrar: () => {},
  });

  it.each(["agendado", "confirmado"] as const)(
    "podeDesmarcar: %s antes do horário sim, no horário ou depois não",
    (status) => {
      expect(podeDesmarcar(job("a", 1, status), ANTES)).toBe(true);
      expect(podeDesmarcar(job("a", 1, status), DEPOIS)).toBe(false);
    }
  );

  it.each(["concluído", "cancelado"] as const)(
    "podeDesmarcar: %s não se desmarca",
    (status) => {
      expect(podeDesmarcar(job("a", 1, status), ANTES)).toBe(false);
    }
  );

  it("mudarStatus grava cancelado antes do horário (agendado e confirmado)", async () => {
    const gravados: string[] = [];
    for (const status of ["agendado", "confirmado"] as const) {
      expect(
        await mudarStatus(
          job("a", 1, status),
          "cancelado",
          deps(gravados),
          ANTES
        )
      ).toEqual({ ok: true });
    }
    expect(gravados).toEqual(["cancelado", "cancelado"]);
  });

  it("depois do horário o mesmo caminho continua valendo (Não aconteceu)", async () => {
    expect(
      await mudarStatus(job("a", 1, "agendado"), "cancelado", deps(), DEPOIS)
    ).toEqual({ ok: true });
  });

  it("não cancela quem já foi concluído ou cancelado, e não grava", async () => {
    const gravados: string[] = [];
    for (const status of ["concluído", "cancelado"] as const) {
      expect(
        await mudarStatus(
          job("a", 1, status),
          "cancelado",
          deps(gravados),
          ANTES
        )
      ).toMatchObject({ ok: false, motivo: "fora-do-fluxo" });
    }
    expect(gravados).toEqual([]);
  });

  it("desmarcar não conta dia na Jornada", async () => {
    const registros: string[] = [];
    await mudarStatus(
      job("a", 1, "agendado"),
      "cancelado",
      { ...deps(), registrar: (acao) => registros.push(acao) },
      ANTES
    );
    expect(registros).toEqual([]);
  });

  it("o formulário continua sem oferecer Cancelado antes do horário", () => {
    expect(statusPermitidos("2026-10-21", "10:00", null, ANTES)).not.toContain(
      "cancelado"
    );
    expect(
      statusPermitidos("2026-10-21", "10:00", job("a", 1, "agendado"), ANTES)
    ).not.toContain("cancelado");
  });

  it("depois de desmarcar: sai do Próximo, do Previsto e do bloqueio do Descanso", () => {
    const desmarcado = job("a", 100, "cancelado");
    const outro = job("b", 50, "agendado");
    outro.hora = "18:00";
    // Próximo (Início e Agenda): o desmarcado não é mais o próximo.
    expect(proximoDaInicio([desmarcado, outro], ANTES)?.id).toBe("b");
    expect(proximoDaAgenda([desmarcado, outro], ANTES)?.id).toBe("b");
    expect(proximoDaInicio([desmarcado], ANTES)).toBeNull();
    expect(proximoDaAgenda([desmarcado], ANTES)).toBeNull();
    // Previsto do dia.
    expect(totalPrevistoDoDia([desmarcado, outro])).toBe(50);
    // Descanso: dia só com o desmarcado fica livre; com o agendado, bloqueado.
    expect(estadoDoDescanso([desmarcado], false, ANTES)).toBe("normal");
    expect(estadoDoDescanso([desmarcado, outro], false, ANTES)).toBe(
      "comAtendimento"
    );
  });
});
