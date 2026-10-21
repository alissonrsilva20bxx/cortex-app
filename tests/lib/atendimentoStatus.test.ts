import { describe, expect, it } from "vitest";
import { totalPrevistoDoDia } from "@/lib/atendimentos/status";
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
