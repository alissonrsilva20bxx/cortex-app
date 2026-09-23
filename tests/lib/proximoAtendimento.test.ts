import { describe, expect, it } from "vitest";
import {
  getDaysUntil,
  countdownLabel,
  formatDayBadge,
} from "../../lib/proximoAtendimento";

const REF = new Date("2026-09-23T12:00:00");

describe("getDaysUntil — contagem real, sem inventar dia a partir de dado ruim", () => {
  it("hoje é 0, amanhã é 1, ontem é -1", () => {
    expect(getDaysUntil("2026-09-23", REF)).toBe(0);
    expect(getDaysUntil("2026-09-24", REF)).toBe(1);
    expect(getDaysUntil("2026-09-22", REF)).toBe(-1);
  });

  it("conta corretamente vários dias à frente", () => {
    expect(getDaysUntil("2026-10-03", REF)).toBe(10);
  });

  it("data vazia é inválida (null), não NaN nem um número absurdo", () => {
    expect(getDaysUntil("", REF)).toBeNull();
  });

  it("formato fora do padrão YYYY-MM-DD é inválido", () => {
    expect(getDaysUntil("23/09/2026", REF)).toBeNull();
    expect(getDaysUntil("2026-9-23", REF)).toBeNull();
    expect(getDaysUntil("amanhã", REF)).toBeNull();
  });

  it("data inexistente no calendário (rollover silencioso do Date) é inválida", () => {
    // 30 de fevereiro não existe -- o parser do Date rola silenciosamente
    // pra 2 de março; sem a checagem de round-trip isso viraria uma
    // contagem de dias real, só que pra uma data que nunca foi pedida.
    expect(getDaysUntil("2026-02-30", REF)).toBeNull();
    expect(getDaysUntil("2026-13-01", REF)).toBeNull();
  });

  it("data implausivelmente distante (achado #131, 'em 12131022 dias') é inválida", () => {
    expect(getDaysUntil("9999-01-01", REF)).toBeNull();
    expect(getDaysUntil("1000-01-01", REF)).toBeNull();
  });

  it("data dentro do horizonte plausível (~10 anos) continua válida", () => {
    expect(getDaysUntil("2036-09-01", REF)).not.toBeNull();
  });
});

describe("countdownLabel — fallback honesto pra data inválida", () => {
  it("null vira null (quem chama omite o selo, não mostra contagem inventada)", () => {
    expect(countdownLabel(null)).toBeNull();
  });

  it("rótulos normais continuam iguais", () => {
    expect(countdownLabel(-1)).toBe("Atrasado");
    expect(countdownLabel(0)).toBe("Hoje");
    expect(countdownLabel(1)).toBe("Amanhã");
    expect(countdownLabel(5)).toBe("em 5 dias");
  });

  it("nunca produz uma contagem de dias absurda tipo 'em 12131022 dias'", () => {
    const invalido = getDaysUntil("9999-01-01", REF);
    expect(countdownLabel(invalido)).toBeNull();
  });
});

describe("formatDayBadge — fallback honesto, nunca 'NaN'/'Invalid Date' na tela", () => {
  it("formata dia/mês normalmente pra data válida", () => {
    expect(formatDayBadge("2026-09-23")).toEqual({ day: "23", month: "SET" });
  });

  it("data vazia ou malformada vira o traço de fallback, não 'NaN'", () => {
    expect(formatDayBadge("")).toEqual({ day: "–", month: "—" });
    expect(formatDayBadge("data-invalida")).toEqual({ day: "–", month: "—" });
  });

  it("data inexistente no calendário também cai no fallback", () => {
    expect(formatDayBadge("2026-02-30")).toEqual({ day: "–", month: "—" });
  });
});
