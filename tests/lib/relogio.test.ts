import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  agoraSeMudouDeMinuto,
  assinarRelogio,
  INTERVALO_DO_RELOGIO_MS,
} from "@/lib/relogio";
import {
  aguardandoResposta,
  podeConcluir,
  podeConfirmar,
} from "@/lib/atendimentos/status";
import type { Job } from "@/lib/types";

/**
 * O "Aconteceu?" e os botões do detalhe precisam perceber sozinhos que o
 * horário passou. Sem React no Vitest, o relógio é testado com timers falsos
 * e a fiação nos componentes pelo código como texto.
 */

/** Um alvo de eventos de mentira (document ou window). */
function alvo(extra: Record<string, unknown> = {}) {
  const ouvintes = new Map<string, Set<() => void>>();
  return {
    ...extra,
    addEventListener: (t: string, f: () => void) => {
      if (!ouvintes.has(t)) ouvintes.set(t, new Set());
      ouvintes.get(t)!.add(f);
    },
    removeEventListener: (t: string, f: () => void) => {
      ouvintes.get(t)?.delete(f);
    },
    disparar: (t: string) => ouvintes.get(t)?.forEach((f) => f()),
    total: () => [...ouvintes.values()].reduce((n, s) => n + s.size, 0),
  };
}

const job = (data: string, hora: string): Job => ({
  id: "j1",
  clienteNome: "Renata",
  data,
  hora,
  valor: 100,
  modalidade: "online",
  status: "agendado",
  criadoEm: "2026-10-01",
  pagoEm: null,
});

describe("assinarRelogio", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("avisa a cada minuto", () => {
    const aoTocar = vi.fn();
    const parar = assinarRelogio(aoTocar, { documento: alvo(), janela: alvo() });
    vi.advanceTimersByTime(INTERVALO_DO_RELOGIO_MS - 1);
    expect(aoTocar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(aoTocar).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(INTERVALO_DO_RELOGIO_MS * 2);
    expect(aoTocar).toHaveBeenCalledTimes(3);
    parar();
  });

  it("avisa quando a aba volta a ficar visível e quando a janela volta a ter foco", () => {
    const documento = alvo({ visibilityState: "visible" });
    const janela = alvo();
    const aoTocar = vi.fn();
    const parar = assinarRelogio(aoTocar, { documento, janela });
    documento.disparar("visibilitychange");
    janela.disparar("focus");
    expect(aoTocar).toHaveBeenCalledTimes(2);
    parar();
  });

  it("não avisa quando a aba vai para segundo plano", () => {
    const documento = alvo({ visibilityState: "hidden" });
    const aoTocar = vi.fn();
    const parar = assinarRelogio(aoTocar, { documento, janela: alvo() });
    documento.disparar("visibilitychange");
    expect(aoTocar).not.toHaveBeenCalled();
    parar();
  });

  it("ao parar, não sobra timer nem ouvinte", () => {
    const documento = alvo({ visibilityState: "visible" });
    const janela = alvo();
    const aoTocar = vi.fn();
    const parar = assinarRelogio(aoTocar, { documento, janela });
    parar();
    vi.advanceTimersByTime(INTERVALO_DO_RELOGIO_MS * 5);
    documento.disparar("visibilitychange");
    janela.disparar("focus");
    expect(aoTocar).not.toHaveBeenCalled();
    expect(documento.total() + janela.total()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("passar o tempo vira a pergunta 'Aconteceu?' sem ninguém redesenhar a tela", () => {
    vi.setSystemTime(new Date("2026-10-21T09:58:00"));
    const lista = [job("2026-10-21", "10:00")];
    let agora = new Date();
    expect(aguardandoResposta(lista, agora)).toHaveLength(0);
    expect(podeConfirmar(lista[0], agora)).toBe(true);
    expect(podeConcluir(lista[0], agora)).toBe(false);

    const parar = assinarRelogio(
      () => {
        agora = agoraSeMudouDeMinuto(agora, new Date());
      },
      { documento: alvo(), janela: alvo() }
    );
    vi.advanceTimersByTime(3 * INTERVALO_DO_RELOGIO_MS);

    expect(aguardandoResposta(lista, agora)).toHaveLength(1);
    expect(podeConfirmar(lista[0], agora)).toBe(false);
    expect(podeConcluir(lista[0], agora)).toBe(true);
    parar();
  });
});

describe("agoraSeMudouDeMinuto", () => {
  it("no mesmo minuto devolve o mesmo objeto (o React não redesenha)", () => {
    const a = new Date("2026-10-21T10:00:05");
    expect(agoraSeMudouDeMinuto(a, new Date("2026-10-21T10:00:55"))).toBe(a);
  });

  it("em outro minuto devolve a hora nova", () => {
    const a = new Date("2026-10-21T10:00:55");
    const b = new Date("2026-10-21T10:01:00");
    expect(agoraSeMudouDeMinuto(a, b)).toBe(b);
  });
});

describe("fiação nos componentes", () => {
  const ler = (p: string) =>
    readFileSync(join(__dirname, "..", "..", p), "utf-8");

  it.each([
    ["components/home/NextJobCard.tsx", "aguardandoResposta(jobs, agora)"],
    ["components/home/AconteceuCard.tsx", "aguardandoResposta(jobs, agora)"],
    ["components/jobs/AgendaAconteceu.tsx", "aguardandoResposta(jobs, agora)"],
    ["components/jobs/JobDetailSheet.tsx", "podeConcluir(job, agora)"],
  ])("%s usa o relógio (useAgora) e passa a hora a regra", (arq, uso) => {
    const src = ler(arq);
    expect(src).toContain("useAgora(");
    expect(src).toContain(uso);
  });

  it("o hook renova pelo relógio e não redesenha dentro do mesmo minuto", () => {
    const src = ler("lib/useAgora.ts");
    expect(src).toContain("assinarRelogio(renovar)");
    expect(src).toContain("agoraSeMudouDeMinuto(anterior, new Date())");
  });
});
