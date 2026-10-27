import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  estadoDoDescanso,
  type EstadoDescanso,
} from "@/lib/atendimentos/status";
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

  it("outro dia: futuro marcado é planejado; o atendimento conta no dia escolhido, não em hoje", () => {
    expect(estadoDoDescanso([], true, "2026-10-23", HOJE)).toBe("planejado");
    expect(
      estadoDoDescanso([job("2026-10-23", "agendado")], false, "2026-10-23", HOJE)
    ).toBe("comAtendimento");
    expect(
      estadoDoDescanso([job("2026-10-21", "agendado")], false, "2026-10-23", HOJE)
    ).toBe("normal");
  });

  it("dia que já passou: só leitura", () => {
    expect(estadoDoDescanso([], false, "2026-10-20", HOJE)).toBe("passou");
    expect(estadoDoDescanso([], true, "2026-10-20", HOJE)).toBe("passou");
  });
});

describe("AgendaAcoes: o botão Descanso", () => {
  const html = (situacao: EstadoDescanso) =>
    renderToStaticMarkup(
      createElement(AgendaAcoes, {
        onNovo: () => {},
        onResumo: () => {},
        onAnotacoes: () => {},
        descanso: { situacao, onAlternar: () => {} },
      })
    );
  const botaoDescanso = (marcacao: string, rotulo: string) =>
    marcacao.match(
      new RegExp(`<button[^>]*>(?:(?!</button>).)*${rotulo}</button>`)
    )![0];

  // O atributo `disabled`, não a classe `disabled:opacity-50`.
  const desabilitado = (botao: string) => /\sdisabled(=|\s|>)/.test(botao);

  it("normal: rótulo Descanso, habilitado, sem motivo, e não existe Bloquear", () => {
    const h = html("normal");
    expect(desabilitado(botaoDescanso(h, "Descanso"))).toBe(false);
    expect(h).not.toContain("data-descanso-motivo");
    expect(h).not.toContain("Bloquear");
    expect(h).not.toContain("Hoje é descanso");
  });

  it("já marcado hoje: rótulo Descansou, habilitado (tocar desfaz), pressionado e com a dica", () => {
    const h = html("feito");
    const b = botaoDescanso(h, "Descansou");
    expect(desabilitado(b)).toBe(false);
    expect(b).toContain('aria-pressed="true"');
    expect(h).toContain("Toque de novo para desfazer");
  });

  it("dia futuro marcado: Vai descansar, habilitado (tocar desfaz)", () => {
    const h = html("planejado");
    expect(desabilitado(botaoDescanso(h, "Vai descansar"))).toBe(false);
    expect(h).toContain("Toque de novo para desfazer");
  });

  it("o círculo desabilitado esmaece (opacity-50) e o habilitado não", () => {
    expect(botaoDescanso(html("comAtendimento"), "Descanso")).toContain(
      "disabled:opacity-50"
    );
    // A classe só age com o atributo disabled: o habilitado não leva o atributo.
    expect(desabilitado(botaoDescanso(html("normal"), "Descanso"))).toBe(false);
    expect(desabilitado(botaoDescanso(html("feito"), "Descansou"))).toBe(false);
  });

  it("dia com atendimento: continua Descanso, desabilitado e com o motivo visível", () => {
    const h = html("comAtendimento");
    expect(desabilitado(botaoDescanso(h, "Descanso"))).toBe(true);
    expect(h).toContain("Dia com atendimento");
  });

  it("dia que já passou: desabilitado e diz por quê", () => {
    expect(desabilitado(botaoDescanso(html("passou"), "Descanso"))).toBe(true);
    expect(html("passou")).toContain("Esse dia já passou");
  });
});
