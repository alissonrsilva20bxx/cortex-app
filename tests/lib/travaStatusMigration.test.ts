import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mudarStatus,
  statusPermitidos,
  type NovoStatus,
} from "@/lib/atendimentos/status";
import type { Job, JobStatus } from "@/lib/types";

/**
 * A trava do status no banco (migration 0046) e a regra do app
 * (lib/atendimentos/status.ts) não podem se separar: se o banco recusar o
 * que a tela faz, a usuária não conclui o atendimento. O teste lê a lista
 * TRANSICOES-DO-APP da migration e compara com o que a lib deixa gravar,
 * pelo formulário (statusPermitidos) e pelos botões (mudarStatus).
 */

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/0046_jobs_trava_status.sql"),
  "utf-8"
);

const STATUS: JobStatus[] = ["agendado", "confirmado", "concluído", "cancelado"];
type Antigo = JobStatus | "novo";
type Momento = "antes" | "depois";
const ANTIGOS: Antigo[] = ["novo", ...STATUS];
const MOMENTOS: Momento[] = ["antes", "depois"];

const AGORA = new Date("2026-10-21T12:00:00");
// O horário NOVO do atendimento (o que fica gravado).
const HORARIO: Record<Momento, { data: string; hora: string }> = {
  antes: { data: "2026-10-22", hora: "10:00" },
  depois: { data: "2026-10-20", hora: "10:00" },
};

const chave = (antigo: Antigo, novo: JobStatus, momento: Momento) =>
  `${antigo} -> ${novo} (${momento})`;

/** As linhas ('antigo', 'novo', 'quando') entre TRANSICOES-DO-APP e
 * FIM-TRANSICOES-DO-APP, com 'sempre' aberto em antes e depois. */
function transicoesDaMigration(): string[] {
  const inicio = MIGRATION.indexOf("TRANSICOES-DO-APP");
  const fim = MIGRATION.indexOf("FIM-TRANSICOES-DO-APP");
  expect(inicio).toBeGreaterThan(-1);
  expect(fim).toBeGreaterThan(inicio);
  const bloco = MIGRATION.slice(inicio, fim);
  const linhas = [...bloco.matchAll(/\('([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g)];
  const saida = new Set<string>();
  for (const [, antigo, novo, quando] of linhas) {
    expect(ANTIGOS).toContain(antigo);
    expect(STATUS).toContain(novo);
    expect(["sempre", "antes", "depois"]).toContain(quando);
    const momentos = quando === "sempre" ? MOMENTOS : [quando as Momento];
    for (const m of momentos) {
      saida.add(chave(antigo as Antigo, novo as JobStatus, m));
    }
  }
  return [...saida].sort();
}

const jobCom = (status: JobStatus, momento: Momento): Job => ({
  id: "j",
  clienteNome: "c",
  ...HORARIO[momento],
  valor: 100,
  modalidade: "online",
  status,
  criadoEm: "2026-10-01",
  pagoEm: null,
});

const deps = {
  atualizar: async () => ({ error: null }),
  registrar: () => undefined,
};

/** O que o app deixa gravar. Formulário: Novo (gravado null) e Editar, com
 * a data/hora mudada ou não (status igual com horário igual não muda
 * status, data nem hora, e a trava deixa passar). Botões: mudarStatus. */
async function transicoesDoApp(): Promise<string[]> {
  const saida = new Set<string>();
  for (const antigo of ANTIGOS) {
    for (const momento of MOMENTOS) {
      const { data, hora } = HORARIO[momento];
      const gravados =
        antigo === "novo"
          ? [null]
          : [
              { status: antigo, data, hora },
              { status: antigo, data: "2026-09-01", hora: "08:00" },
            ];
      for (const gravado of gravados) {
        for (const novo of statusPermitidos(data, hora, gravado, AGORA)) {
          const mesmoHorario =
            gravado !== null && gravado.data === data && gravado.hora === hora;
          if (mesmoHorario && novo === antigo) continue;
          saida.add(chave(antigo, novo, momento));
        }
      }
      if (antigo === "novo") continue;
      for (const novo of ["confirmado", "concluído", "cancelado"] as NovoStatus[]) {
        if (novo === antigo) continue;
        const r = await mudarStatus(jobCom(antigo, momento), novo, deps, AGORA);
        if (r.ok) saida.add(chave(antigo, novo, momento));
      }
    }
  }
  return [...saida].sort();
}

describe("migration 0046: trava do status igual à regra do app", () => {
  it("permite exatamente as transições que a lib permite", async () => {
    expect(transicoesDaMigration()).toEqual(await transicoesDoApp());
  });

  it("cobre cada transição que a tela faz", () => {
    const banco = transicoesDaMigration();
    const daTela = [
      // Botões do detalhe, Aconteceu? (Início e Agenda), mudarStatus.
      chave("agendado", "confirmado", "antes"), // Confirmar
      chave("agendado", "concluído", "depois"), // Concluir
      chave("confirmado", "concluído", "depois"), // Concluir
      chave("agendado", "cancelado", "depois"), // Não aconteceu
      chave("confirmado", "cancelado", "depois"), // Não aconteceu
      chave("agendado", "cancelado", "antes"), // Cliente desmarcou
      chave("confirmado", "cancelado", "antes"), // Cliente desmarcou
      // Formulário Novo.
      chave("novo", "agendado", "antes"),
      chave("novo", "agendado", "depois"),
      chave("novo", "confirmado", "antes"),
      chave("novo", "concluído", "depois"),
      chave("novo", "cancelado", "depois"),
      // Formulário Editar (inclui voltar para Agendado e trocar a data).
      chave("concluído", "agendado", "antes"),
      chave("concluído", "agendado", "depois"),
      chave("cancelado", "agendado", "depois"),
      chave("concluído", "cancelado", "depois"),
      chave("cancelado", "concluído", "depois"),
      chave("concluído", "concluído", "depois"),
      chave("confirmado", "confirmado", "antes"),
      chave("concluído", "confirmado", "antes"),
    ];
    for (const t of daTela) expect(banco).toContain(t);
  });

  it("recusa o que a tela não faz", () => {
    const banco = transicoesDaMigration();
    for (const antigo of ANTIGOS) {
      expect(banco).not.toContain(chave(antigo, "concluído", "antes"));
      expect(banco).not.toContain(chave(antigo, "confirmado", "depois"));
    }
    expect(banco).not.toContain(chave("novo", "cancelado", "antes"));
    expect(banco).not.toContain(chave("concluído", "cancelado", "antes"));
    expect(banco).not.toContain(chave("cancelado", "cancelado", "antes"));
  });

  it("os status da lista são os do enum job_status do banco", () => {
    const schema = readFileSync(
      join(process.cwd(), "supabase/migrations/0001_jobapp_schema.sql"),
      "utf-8"
    );
    const enumLinha = schema.match(/create type job_status\s+as enum \(([^)]+)\)/);
    expect(enumLinha).not.toBeNull();
    const doBanco = [...enumLinha![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(doBanco).toEqual(STATUS);
  });
});

describe("migration 0046: nunca bloqueia a usuária por fuso ou linha antiga", () => {
  const horas = (nome: string) => {
    const m = MIGRATION.match(
      new RegExp(`${nome} := v_instante ([<>]=?) v_agora_utc ([+-]) interval '(\\d+) hours'`)
    );
    expect(m).not.toBeNull();
    return { op: m![1], sinal: m![2], horas: Number(m![3]) };
  };

  it("'a partir do horário' cobre o fuso mais adiantado (UTC+14)", () => {
    const d = horas("v_depois");
    expect(d.op).toBe("<=");
    expect(d.sinal).toBe("+");
    expect(d.horas).toBeGreaterThanOrEqual(14);
  });

  it("'antes do horário' cobre o fuso mais atrasado (UTC-12)", () => {
    const a = horas("v_antes");
    expect(a.op).toBe(">");
    expect(a.sinal).toBe("-");
    expect(a.horas).toBeGreaterThanOrEqual(12);
  });

  it("update que não muda status, data nem hora passa sempre", () => {
    expect(MIGRATION).toMatch(
      /new\.status is not distinct from old\.status\s+and new\.data is not distinct from old\.data\s+and new\.hora is not distinct from old\.hora then\s+return new;/
    );
  });

  it("só a sessão da usuária passa pela trava; service role e SQL Editor não", () => {
    expect(MIGRATION).toMatch(
      /if v_papel not in \('authenticated', 'anon'\) then\s+return new;/
    );
  });

  it("é migration escrita e não aplicada, com como desfazer", () => {
    expect(MIGRATION).toContain("ESCRITA, NÃO APLICADA");
    expect(MIGRATION).toContain("drop trigger if exists jobs_status_no_fluxo on public.jobs;");
    expect(MIGRATION).toContain("drop function if exists public.jobs_status_no_fluxo();");
  });
});
