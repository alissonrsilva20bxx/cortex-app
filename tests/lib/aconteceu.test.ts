import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aguardandoResposta } from "@/lib/atendimentos/status";
import type { Job, JobStatus } from "@/lib/types";

// O hook grava em jobs pelo supabase; aqui só se renderiza, nada é enviado.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { NextJobCard } from "@/components/home/NextJobCard";
import { AgendaAconteceu } from "@/components/jobs/AgendaAconteceu";

const AGORA = new Date("2026-10-21T14:00:00");

const job = (
  id: string,
  data: string,
  hora: string,
  status: JobStatus
): Job => ({
  id,
  clienteNome: `Cliente ${id}`,
  data,
  hora,
  valor: 100,
  modalidade: "online",
  status,
  criadoEm: "2026-10-01",
  pagoEm: null,
});

const texto = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(el)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

afterEach(() => vi.useRealTimers());

describe("aguardandoResposta", () => {
  it("só agendado e confirmado com horário já passado, o mais recente primeiro", () => {
    const jobs = [
      job("velho", "2026-10-19", "09:00", "agendado"),
      job("hoje-cedo", "2026-10-21", "10:00", "confirmado"),
      job("futuro", "2026-10-21", "18:00", "agendado"),
      job("feito", "2026-10-20", "09:00", "concluído"),
      job("desmarcou", "2026-10-20", "10:00", "cancelado"),
    ];
    expect(aguardandoResposta(jobs, AGORA).map((j) => j.id)).toEqual([
      "hoje-cedo",
      "velho",
    ]);
  });

  it("sem nada em aberto no passado, lista vazia", () => {
    expect(
      aguardandoResposta([job("f", "2026-10-22", "09:00", "agendado")], AGORA)
    ).toEqual([]);
  });
});

describe("Início: o card Próximo", () => {
  it("atendimento que já passou vira a pergunta Aconteceu?, não o Próximo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    const html = texto(
      createElement(NextJobCard, {
        jobs: [
          job("passou", "2026-10-21", "10:00", "agendado"),
          job("amanha", "2026-10-22", "09:00", "agendado"),
        ],
        aoMudar: () => {},
      })
    );
    expect(html).toContain("Aconteceu?");
    expect(html).toContain("Sim, concluir");
    expect(html).toContain("Não aconteceu");
    expect(html).toContain("Cliente");
    expect(html).not.toContain("Próximo");
    expect(html).not.toContain("09h00");
  });

  it("sem atendimento passado em aberto, mostra o Próximo de verdade", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    const html = texto(
      createElement(NextJobCard, {
        jobs: [
          job("feito", "2026-10-21", "10:00", "concluído"),
          job("amanha", "2026-10-22", "09:00", "agendado"),
        ],
        aoMudar: () => {},
      })
    );
    expect(html).toContain("Próximo");
    expect(html).toContain("09h00");
    expect(html).not.toContain("Aconteceu?");
  });
});

describe("Agenda: a lista Aconteceu?", () => {
  it("lista os passados em aberto com os dois botões", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    const html = texto(
      createElement(AgendaAconteceu, {
        jobs: [
          job("a", "2026-10-21", "10:00", "agendado"),
          job("b", "2026-10-20", "10:00", "confirmado"),
          job("c", "2026-10-22", "10:00", "agendado"),
        ],
        onOpen: () => {},
        onStatusMudou: () => {},
      })
    );
    expect(html).toContain("Aconteceu?");
    expect(html).toContain("Cliente a");
    expect(html).toContain("Cliente b");
    expect(html).not.toContain("Cliente c");
    expect(html.match(/Sim, concluir/g)).toHaveLength(2);
    expect(html.match(/Não aconteceu/g)).toHaveLength(2);
  });

  it("sem pendente, não aparece", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    const html = renderToStaticMarkup(
      createElement(AgendaAconteceu, {
        jobs: [job("c", "2026-10-22", "10:00", "agendado")],
        onOpen: () => {},
        onStatusMudou: () => {},
      })
    );
    expect(html).toBe("");
  });
});
