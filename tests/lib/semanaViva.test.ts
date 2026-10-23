import { describe, expect, it } from "vitest";
import { semanaViva } from "@/lib/atendimentos/semanaViva";
import type { Job, JobStatus } from "@/lib/types";

// Semana da Agenda: domingo 18/10/2026 a sábado 24/10/2026.
// Quinta, 22/10, 14:00.
const QUINTA = new Date("2026-10-22T14:00:00");

let n = 0;
const job = (data: string, hora: string, status: JobStatus): Job => ({
  id: `j${n++}`,
  clienteNome: `Cliente ${n}`,
  data,
  hora,
  valor: 100,
  modalidade: "online",
  status,
  criadoEm: "2026-10-01T00:00:00Z",
});

describe("semanaViva", () => {
  it("7 dias de domingo a sábado, com hoje marcado e o período do topo", () => {
    const s = semanaViva([], QUINTA);
    expect(s.dias.map((d) => d.rotulo)).toEqual([
      "Dom",
      "Seg",
      "Ter",
      "Qua",
      "Qui",
      "Sex",
      "Sáb",
    ]);
    expect(s.dias.map((d) => d.numero)).toEqual([18, 19, 20, 21, 22, 23, 24]);
    expect(s.dias.filter((d) => d.hoje).map((d) => d.iso)).toEqual([
      "2026-10-22",
    ]);
    expect(s.dias[3].passado).toBe(true);
    expect(s.dias[5].passado).toBe(false);
    expect(s.periodo).toBe("18 a 24 out");
  });

  it("semana que vira o mês leva os dois meses no período", () => {
    expect(semanaViva([], new Date("2026-10-01T10:00:00")).periodo).toBe(
      "27 set a 3 out"
    );
  });

  it("marca cada atendimento como feito, pela frente, desmarcado ou em aberto, em ordem de horário", () => {
    const s = semanaViva(
      [
        job("2026-10-22", "18:00", "agendado"),
        job("2026-10-22", "09:00", "confirmado"),
        job("2026-10-22", "11:00", "concluído"),
        job("2026-10-22", "10:00", "cancelado"),
        job("2026-10-30", "10:00", "agendado"),
      ],
      QUINTA
    );
    const hoje = s.dias[4];
    expect(hoje.atendimentos.map((a) => [a.hora, a.marca])).toEqual([
      ["09:00", "aberto"],
      ["10:00", "desmarcado"],
      ["11:00", "feito"],
      ["18:00", "frente"],
    ]);
    expect(s.dias.flatMap((d) => d.atendimentos)).toHaveLength(4);
  });
});
