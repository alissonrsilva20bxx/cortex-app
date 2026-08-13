import { describe, expect, it } from "vitest";
import { STATUS_META } from "../../components/jobs/status";
import type { JobStatus } from "../../lib/types";

/**
 * T11 (issue #38) — item §3-P0-3 do checklist de paridade funcional
 * (Agenda): rótulos de status devem bater com o enum real
 * (agendado|confirmado|concluído|cancelado). `agenda-visual.test.ts` (T3)
 * só confirma que STATUS_META é referenciado, não os 4 valores em si.
 *
 * Nota importante de escopo (achado do T11, não uma correção): o item
 * §3-P0-1 do checklist original ("Agenda deve ser uma LISTA filtrável por
 * status, não um calendário por dia") foi SUPERADO por uma decisão humana
 * registrada na issue #30 (T3, comentário de 2026-08-10T21:30:42Z) — a
 * Agenda foi deliberadamente redesenhada como calendário semanal + lista
 * do dia, aprovada visualmente. Não é uma regressão; o checklist de
 * 2026-08-07 está desatualizado nesse ponto específico. Ver relatório de
 * execução do T11 para o registro completo.
 */

describe("§3-P0-3 — rótulos de status batem exatamente com o enum real", () => {
  it("STATUS_META cobre exatamente os 4 valores do enum JobStatus, nenhum a mais nem a menos", () => {
    const expected: JobStatus[] = [
      "agendado",
      "confirmado",
      "concluído",
      "cancelado",
    ];
    expect(Object.keys(STATUS_META).sort()).toEqual([...expected].sort());
  });

  it("cada rótulo de exibição corresponde ao valor esperado (Agendado/Confirmado/Concluído/Cancelado)", () => {
    expect(STATUS_META.agendado.label).toBe("Agendado");
    expect(STATUS_META.confirmado.label).toBe("Confirmado");
    expect(STATUS_META["concluído"].label).toBe("Concluído");
    expect(STATUS_META.cancelado.label).toBe("Cancelado");
  });
});
