import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  statusAposMudarHorario,
  statusPermitidos,
} from "@/lib/atendimentos/status";
import type { Job } from "@/lib/types";

/**
 * O formulário do atendimento (Novo e Editar) segue o mesmo fluxo do
 * detalhe: Concluído e Não aconteceu só a partir do horário; Confirmado só
 * antes dele. O projeto não renderiza JSX no Vitest, então a regra é testada
 * pelas funções que o formulário usa, e a fiação (a recusa no handleSave
 * antes de gravar e de registrar na Jornada) pelo código como texto.
 */

const AGORA = new Date("2026-10-21T12:00:00");
const FUTURO = { data: "2026-10-22", hora: "10:00" };
const PASSADO = { data: "2026-10-20", hora: "10:00" };

const gravado = (
  status: Job["status"],
  quando: { data: string; hora: string }
) => ({ status, ...quando });

describe("statusPermitidos: atendimento novo", () => {
  it("futuro: agendado e confirmado; nunca concluído nem não aconteceu", () => {
    const p = statusPermitidos(FUTURO.data, FUTURO.hora, null, AGORA);
    expect(p).toEqual(["agendado", "confirmado"]);
  });

  it("passado: agendado, concluído e não aconteceu; nunca confirmado", () => {
    const p = statusPermitidos(PASSADO.data, PASSADO.hora, null, AGORA);
    expect(p).toEqual(["agendado", "concluído", "cancelado"]);
  });

  it("no minuto exato do horário já vale concluir", () => {
    const p = statusPermitidos("2026-10-21", "12:00", null, AGORA);
    expect(p).toContain("concluído");
    expect(p).not.toContain("confirmado");
  });
});

describe("statusPermitidos: editar", () => {
  it("atendimento futuro agendado não pode virar concluído", () => {
    const g = gravado("agendado", FUTURO);
    const p = statusPermitidos(FUTURO.data, FUTURO.hora, g, AGORA);
    expect(p).not.toContain("concluído");
    expect(p).not.toContain("cancelado");
  });

  it("mudar a data de um concluído para o futuro tira o concluído", () => {
    const g = gravado("concluído", PASSADO);
    const p = statusPermitidos(FUTURO.data, FUTURO.hora, g, AGORA);
    expect(p).not.toContain("concluído");
  });

  it("o status já gravado continua valendo se data e hora não mudaram", () => {
    const g = gravado("confirmado", PASSADO);
    const p = statusPermitidos(PASSADO.data, PASSADO.hora, g, AGORA);
    expect(p).toContain("confirmado");
  });
});

describe("statusAposMudarHorario", () => {
  it("concluído com data que vira futura volta para agendado", () => {
    expect(
      statusAposMudarHorario("concluído", FUTURO.data, FUTURO.hora, null, AGORA)
    ).toBe("agendado");
  });

  it("confirmado com horário que já passou volta para agendado", () => {
    expect(
      statusAposMudarHorario(
        "confirmado",
        PASSADO.data,
        PASSADO.hora,
        null,
        AGORA
      )
    ).toBe("agendado");
  });

  it("status que ainda vale fica como está", () => {
    expect(
      statusAposMudarHorario(
        "concluído",
        PASSADO.data,
        PASSADO.hora,
        null,
        AGORA
      )
    ).toBe("concluído");
  });
});

describe("JobForm: fiação", () => {
  const form = readFileSync(
    join(__dirname, "..", "..", "components/jobs/JobForm.tsx"),
    "utf-8"
  );

  it("recusa no handleSave, com a mensagem em constante, antes de gravar e de registrar", () => {
    const recusa = form.indexOf(
      "if (!statusPermitidos(form.data, form.hora, job).includes(form.status))"
    );
    expect(recusa).toBeGreaterThan(0);
    expect(form).toContain("return setError(ERRO_FORM_STATUS);");
    expect(recusa).toBeLessThan(form.indexOf('.from("jobs")'));
    expect(recusa).toBeLessThan(form.indexOf('registrar("atendimento")'));
  });

  it("o select só oferece os status permitidos e data/hora passam por setHorario", () => {
    for (const s of ["confirmado", "concluído", "cancelado"])
      expect(form).toContain(`statusOferecidos.includes("${s}")`);
    expect(form).toContain('setHorario("data", e.target.value)');
    expect(form).toContain('setHorario("hora", e.target.value)');
  });
});
