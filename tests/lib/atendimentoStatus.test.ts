import { describe, expect, it } from "vitest";
import {
  horarioChegou,
  mudarStatus,
  podeConcluir,
  podeConfirmar,
  totalPrevistoDoDia,
  type NovoStatus,
} from "@/lib/atendimentos/status";
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

  it("recusa concluir ou cancelar atendimento futuro, e não grava", async () => {
    let chamadas = 0;
    const deps = {
      atualizar: async () => {
        chamadas++;
        return { error: null };
      },
    };
    const futuro = job("f", 1, "agendado");
    expect(await mudarStatus(futuro, "concluído", deps, ANTES)).toMatchObject({
      ok: false,
      motivo: "fora-do-fluxo",
    });
    expect(await mudarStatus(futuro, "cancelado", deps, ANTES)).toMatchObject({
      ok: false,
      motivo: "fora-do-fluxo",
    });
    expect(chamadas).toBe(0);
  });

  it("recusa confirmar depois do horário", async () => {
    const r = await mudarStatus(
      job("a", 1, "agendado"),
      "confirmado",
      { atualizar: async () => ({ error: null }) },
      DEPOIS
    );
    expect(r).toMatchObject({ ok: false, motivo: "fora-do-fluxo" });
  });

  it("erro do banco volta como falha, com o detalhe", async () => {
    const r = await mudarStatus(
      job("a", 1, "agendado"),
      "concluído",
      { atualizar: async () => ({ error: { message: "sem rede" } }) },
      DEPOIS
    );
    expect(r).toEqual({
      ok: false,
      motivo: "falha-ao-gravar",
      detalhe: "sem rede",
    });
  });
});
