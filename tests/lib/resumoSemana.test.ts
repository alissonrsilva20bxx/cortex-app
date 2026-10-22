import { describe, expect, it } from "vitest";
import { resumoDaSemana } from "@/lib/atendimentos/resumoSemana";
import type { Job, JobStatus } from "@/lib/types";

// Semana da Agenda: domingo 18/10/2026 a sábado 24/10/2026.
// Quarta, 21/10, 14:00.
const QUARTA = new Date("2026-10-21T14:00:00");

let n = 0;
const job = (data: string, hora: string, status: JobStatus): Job => ({
  id: `j${n++}`,
  clienteNome: "Cliente",
  data,
  hora,
  valor: 100,
  modalidade: "online",
  status,
  criadoEm: "2026-10-01T00:00:00Z",
});

const nomes = (r: ReturnType<typeof resumoDaSemana>) =>
  r.diasLivres.map((d) => d.nome);

describe("resumoDaSemana", () => {
  it("semana vazia: tudo zero, 7 dias livres e a frase de semana livre", () => {
    const r = resumoDaSemana([], QUARTA);
    expect(r).toMatchObject({ feitos: 0, pelaFrente: 0, desmarcados: 0 });
    expect(r.diasLivres).toHaveLength(7);
    expect(r.frase).toBe("Semana livre. Nenhum atendimento marcado.");
  });

  it("só feitos: sem 'pela frente' na frase, com 'Nada mais marcado'", () => {
    const r = resumoDaSemana(
      [
        job("2026-10-19", "10:00", "concluído"),
        job("2026-10-20", "10:00", "concluído"),
      ],
      QUARTA
    );
    expect(r.feitos).toBe(2);
    expect(r.pelaFrente).toBe(0);
    expect(r.frase).toBe(
      "Você fez 2 atendimentos. Nada mais marcado esta semana. Quarta e quinta estão livres."
    );
  });

  it("só futuros: conta os agendados e confirmados de agora ao fim da semana", () => {
    const r = resumoDaSemana(
      [
        job("2026-10-22", "10:00", "agendado"),
        job("2026-10-24", "18:00", "confirmado"),
      ],
      QUARTA
    );
    expect(r.feitos).toBe(0);
    expect(r.pelaFrente).toBe(2);
    expect(r.frase).toBe(
      "Você tem 2 atendimentos pela frente. Quarta e sexta estão livres."
    );
  });

  it("desmarcados: 'Cliente desmarcou' (antes do horário) e 'Não aconteceu' (depois) contam os dois, e não ocupam o dia", () => {
    const r = resumoDaSemana(
      [
        job("2026-10-20", "09:00", "cancelado"), // não aconteceu
        job("2026-10-23", "09:00", "cancelado"), // cliente desmarcou
      ],
      QUARTA
    );
    expect(r.desmarcados).toBe(2);
    expect(r.feitos).toBe(0);
    expect(r.pelaFrente).toBe(0);
    expect(r.diasLivres).toHaveLength(7);
    expect(r.frase).toBe("Semana livre. Nenhum atendimento marcado.");
  });

  it("dia de descanso (sem atendimento) é dia livre", () => {
    const r = resumoDaSemana([job("2026-10-22", "10:00", "agendado")], QUARTA);
    expect(nomes(r)).toContain("Quarta");
    expect(nomes(r)).not.toContain("Quinta");
    expect(r.diasLivres).toHaveLength(6);
  });

  it("dias passados sem atendimento contam como livres, mas só os futuros são nomeados", () => {
    const r = resumoDaSemana([job("2026-10-22", "10:00", "agendado")], QUARTA);
    expect(nomes(r)).toContain("Domingo");
    expect(r.diasLivres.find((d) => d.nome === "Domingo")?.futuro).toBe(false);
    expect(r.frase).toBe(
      "Você tem 1 atendimento pela frente. Quarta e sexta estão livres."
    );
  });

  it("nomeia no máximo 2 dias livres futuros", () => {
    const r = resumoDaSemana([job("2026-10-19", "10:00", "concluído")], QUARTA);
    // Livres futuros: quarta, quinta, sexta, sábado -> só 2 na frase.
    expect(r.frase).toContain("Quarta e quinta estão livres.");
    expect(r.frase).not.toContain("sexta");
  });

  it("semana que acaba: sem dia livre futuro, a frase não cita dia", () => {
    const sabado = new Date("2026-10-24T20:00:00");
    const jobs = [
      job("2026-10-18", "10:00", "concluído"),
      job("2026-10-19", "10:00", "concluído"),
      job("2026-10-20", "10:00", "concluído"),
      job("2026-10-21", "10:00", "concluído"),
      job("2026-10-22", "10:00", "concluído"),
      job("2026-10-23", "10:00", "concluído"),
      job("2026-10-24", "10:00", "concluído"),
    ];
    const r = resumoDaSemana(jobs, sabado);
    expect(r.diasLivres).toHaveLength(0);
    expect(r.frase).toBe(
      "Você fez 7 atendimentos. Nada mais marcado esta semana."
    );
  });

  it("singular e plural: 1 atendimento, 2 atendimentos", () => {
    const um = resumoDaSemana(
      [
        job("2026-10-19", "10:00", "concluído"),
        job("2026-10-22", "10:00", "agendado"),
      ],
      QUARTA
    );
    expect(um.frase).toMatch(/^Você fez 1 atendimento e tem 1 pela frente\./);
    const dois = resumoDaSemana(
      [
        job("2026-10-19", "10:00", "concluído"),
        job("2026-10-20", "10:00", "concluído"),
        job("2026-10-22", "10:00", "agendado"),
        job("2026-10-23", "10:00", "agendado"),
      ],
      QUARTA
    );
    expect(dois.frase).toMatch(
      /^Você fez 2 atendimentos e tem 2 pela frente\./
    );
  });

  it("um dia livre só: 'está livre' no singular", () => {
    const jobs = [
      job("2026-10-21", "16:00", "agendado"),
      job("2026-10-23", "10:00", "agendado"),
      job("2026-10-24", "10:00", "agendado"),
    ];
    const r = resumoDaSemana(jobs, QUARTA);
    expect(r.frase).toBe(
      "Você tem 3 atendimentos pela frente. Quinta está livre."
    );
  });

  it("atendimento de hoje já passado do horário, ainda em aberto: não é feito nem pela frente, mas ocupa o dia", () => {
    const r = resumoDaSemana([job("2026-10-21", "09:00", "agendado")], QUARTA);
    expect(r.feitos).toBe(0);
    expect(r.pelaFrente).toBe(0);
    expect(nomes(r)).not.toContain("Quarta");
    expect(r.frase).toMatch(/^Nada mais marcado esta semana\./);
  });

  it("atendimento de hoje ainda por vir conta como pela frente; no minuto exato também", () => {
    const r = resumoDaSemana(
      [
        job("2026-10-21", "14:00", "confirmado"),
        job("2026-10-21", "18:00", "agendado"),
      ],
      QUARTA
    );
    expect(r.pelaFrente).toBe(2);
  });

  describe("virada de domingo para segunda (semana é domingo a sábado, a mesma da Agenda)", () => {
    it("sábado 23:59 ainda é a semana que acaba; o sábado vale", () => {
      const r = resumoDaSemana(
        [job("2026-10-24", "10:00", "concluído")],
        new Date("2026-10-24T23:59:00")
      );
      expect(r.feitos).toBe(1);
    });

    it("domingo 00:00 já é outra semana: o sábado anterior sai da conta", () => {
      const r = resumoDaSemana(
        [
          job("2026-10-24", "10:00", "concluído"),
          job("2026-10-25", "10:00", "agendado"),
        ],
        new Date("2026-10-25T00:00:00")
      );
      expect(r.feitos).toBe(0);
      expect(r.pelaFrente).toBe(1);
      expect(r.diasLivres).toHaveLength(6);
      expect(r.diasLivres.every((d) => d.iso >= "2026-10-25")).toBe(true);
    });

    it("segunda-feira ainda é a semana que começou no domingo; o domingo conta nela e não na anterior", () => {
      const domingo = job("2026-10-25", "10:00", "concluído");
      expect(
        resumoDaSemana([domingo], new Date("2026-10-26T09:00:00")).feitos
      ).toBe(1);
      expect(resumoDaSemana([domingo], QUARTA).feitos).toBe(0);
    });
  });

  it("atendimentos de outras semanas não entram", () => {
    const r = resumoDaSemana(
      [
        job("2026-10-17", "10:00", "concluído"),
        job("2026-10-25", "10:00", "agendado"),
      ],
      QUARTA
    );
    expect(r).toMatchObject({ feitos: 0, pelaFrente: 0, desmarcados: 0 });
  });
});
