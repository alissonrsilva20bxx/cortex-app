import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { estadoDoDescanso } from "@/lib/atendimentos/status";
import { AgendaAcoes } from "@/components/jobs/AgendaAcoes";
import type { Job, JobStatus } from "@/lib/types";

const HOJE = new Date("2026-10-21T14:00:00");

const job = (
  data: string,
  status: JobStatus
): Pick<Job, "data" | "status"> => ({
  data,
  status,
});

describe("estadoDoDescanso", () => {
  it("dia livre e sem descanso registrado: normal", () => {
    expect(estadoDoDescanso([job("2026-10-22", "agendado")], false, HOJE)).toBe(
      "normal"
    );
  });

  it("já registrado hoje: feito, mesmo com atendimento no dia", () => {
    expect(estadoDoDescanso([], true, HOJE)).toBe("feito");
    expect(estadoDoDescanso([job("2026-10-21", "agendado")], true, HOJE)).toBe(
      "feito"
    );
  });

  it.each(["agendado", "confirmado", "concluído"] as const)(
    "atendimento %s hoje: comAtendimento",
    (status) => {
      expect(estadoDoDescanso([job("2026-10-21", status)], false, HOJE)).toBe(
        "comAtendimento"
      );
    }
  );

  it("atendimento cancelado hoje não impede o descanso", () => {
    expect(
      estadoDoDescanso([job("2026-10-21", "cancelado")], false, HOJE)
    ).toBe("normal");
  });
});

describe("AgendaAcoes: o botão Descanso", () => {
  const html = (situacao: "normal" | "feito" | "comAtendimento") =>
    renderToStaticMarkup(
      createElement(AgendaAcoes, {
        onNovo: () => {},
        onResumo: () => {},
        onAnotacoes: () => {},
        descanso: { situacao, onDescansar: () => {} },
      })
    );
  const botaoDescanso = (marcacao: string, rotulo: string) =>
    marcacao.match(
      new RegExp(`<button[^>]*>(?:(?!</button>).)*${rotulo}</button>`)
    )![0];

  it("normal: rótulo Descanso, habilitado, sem motivo, e não existe Bloquear", () => {
    const h = html("normal");
    expect(botaoDescanso(h, "Descanso")).not.toContain("disabled");
    expect(h).not.toContain("data-descanso-motivo");
    expect(h).not.toContain("Bloquear");
    expect(h).not.toContain("Hoje é descanso");
  });

  it("já registrado: rótulo Descansou, desabilitado, com o motivo", () => {
    const h = html("feito");
    expect(botaoDescanso(h, "Descansou")).toContain("disabled");
    expect(h).toContain("Um descanso por dia");
  });

  it("dia com atendimento: continua Descanso, desabilitado e com o motivo visível", () => {
    const h = html("comAtendimento");
    expect(botaoDescanso(h, "Descanso")).toContain("disabled");
    expect(h).toContain("Hoje você tem atendimento");
  });
});
