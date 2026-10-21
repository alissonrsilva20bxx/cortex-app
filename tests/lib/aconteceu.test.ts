import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aguardandoResposta,
  LIMITE_ACONTECEU_AGENDA,
  pendentesVisiveis,
} from "@/lib/atendimentos/status";
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
        userId: "u1",
        jobs: [
          job("passou", "2026-10-21", "10:00", "agendado"),
          job("amanha", "2026-10-22", "09:00", "agendado"),
        ],
        aoMudar: () => {},
        aoVerAgenda: () => {},
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
        userId: "u1",
        jobs: [
          job("feito", "2026-10-21", "10:00", "concluído"),
          job("amanha", "2026-10-22", "09:00", "agendado"),
        ],
        aoMudar: () => {},
        aoVerAgenda: () => {},
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
        userId: "u1",
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
        userId: "u1",
        jobs: [job("c", "2026-10-22", "10:00", "agendado")],
        onOpen: () => {},
        onStatusMudou: () => {},
      })
    );
    expect(html).toBe("");
  });
});

const cinco = [
  job("1", "2026-10-17", "10:00", "agendado"),
  job("2", "2026-10-18", "10:00", "agendado"),
  job("3", "2026-10-19", "10:00", "confirmado"),
  job("4", "2026-10-20", "10:00", "agendado"),
  job("5", "2026-10-21", "10:00", "agendado"),
];

describe("Agenda: no máximo 3 Aconteceu?, o resto atrás do Ver todos", () => {
  it("pendentesVisiveis corta nos 3 mais recentes, ou entrega todos", () => {
    const pendentes = aguardandoResposta(cinco, AGORA);
    expect(LIMITE_ACONTECEU_AGENDA).toBe(3);
    expect(pendentesVisiveis(pendentes, false).map((j) => j.id)).toEqual([
      "5",
      "4",
      "3",
    ]);
    expect(pendentesVisiveis(pendentes, true)).toHaveLength(5);
  });

  it("com 5 pendentes mostra 3 (os mais recentes) e Ver todos (5), com os mesmos botões", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    const html = texto(
      createElement(AgendaAconteceu, {
        userId: "u1",
        jobs: cinco,
        onOpen: () => {},
        onStatusMudou: () => {},
      })
    );
    for (const id of ["5", "4", "3"]) expect(html).toContain(`Cliente ${id}`);
    for (const id of ["2", "1"]) expect(html).not.toContain(`Cliente ${id}`);
    expect(html).toContain("Ver todos (5)");
    expect(html.match(/Sim, concluir/g)).toHaveLength(3);
    expect(html.match(/Não aconteceu/g)).toHaveLength(3);
  });

  it("com 3 ou menos não aparece Ver todos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    const html = texto(
      createElement(AgendaAconteceu, {
        userId: "u1",
        jobs: cinco.slice(2),
        onOpen: () => {},
        onStatusMudou: () => {},
      })
    );
    expect(html).not.toContain("Ver todos");
    expect(html.match(/Sim, concluir/g)).toHaveLength(3);
  });
});

describe("Início: o mais recente e +N esperando resposta", () => {
  it("mostra só o mais recente e +4 esperando resposta (um botão que leva à Agenda)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    const html = renderToStaticMarkup(
      createElement(NextJobCard, {
        userId: "u1",
        jobs: cinco,
        aoMudar: () => {},
        aoVerAgenda: () => {},
      })
    );
    const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(t).toContain("Cliente");
    expect(t).toContain("+4 esperando resposta");
    expect(t.match(/Sim, concluir/g)).toHaveLength(1);
    expect(t).not.toMatch(/concluir todos/i);
    expect(html).toMatch(/<button[^>]*>\+4 esperando resposta<\/button>/);
  });
});
