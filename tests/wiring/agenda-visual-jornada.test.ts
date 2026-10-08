import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  atendimentosDaSemana,
  atendimentosProximasSemanas,
  buildWeekStrip,
  formatDiaCurto,
  formatDiaExtenso,
  inicialDoNome,
  localDoAtendimento,
  proximoAtendimento,
  startOfWeek,
} from "../../components/jobs/agendaSemana";
import type { Job, JobStatus } from "../../lib/types";

/**
 * J03 (#153) — Agenda no visual novo da Jornada.
 *
 * Duas partes, no padrão do repositório (sem RTL nem JSX no Vitest):
 * 1. fiação: lê o código-fonte como texto e afirma que a ligação real
 *    existe (`/dev-preview/app` -> `JobsTab` -> componentes novos, títulos,
 *    4 ações e onde cada uma liga), e que nenhum nome/valor ilustrativo do
 *    mockup entrou no código;
 * 2. lógica: executa de verdade as funções puras de
 *    `components/jobs/agendaSemana.ts` (tira da semana, próximo
 *    atendimento, listas), incluindo semana vazia e virada de mês/ano.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const page = read("app/dev-preview/app/page.tsx");
const jobsTab = read("components/jobs/JobsTab.tsx");
const acoes = read("components/jobs/AgendaAcoes.tsx");
const listas = read("components/jobs/AgendaListas.tsx");
const proximoCard = read("components/jobs/AgendaProximoCard.tsx");

/** Trecho JSX de `<Nome ... />` (autofechado), pra afirmar onde cada prop liga. */
function jsxTag(src: string, name: string): string {
  const m = src.match(new RegExp(`<${name}\\b[\\s\\S]*?\\/>`));
  expect(m, `<${name}> não está no JSX`).not.toBeNull();
  return m![0];
}

describe("/dev-preview/app usa o JobsTab real", () => {
  it("importa JobsTab do caminho real, uma vez só", () => {
    expect(page).toMatch(
      /import\s*{\s*JobsTab\s*}\s*from\s*"@\/components\/jobs\/JobsTab"/
    );
    const imports = page
      .split("\n")
      .filter((l) => /^\s*import\b/.test(l) && /\bJobsTab\b/.test(l));
    expect(imports).toHaveLength(1);
    expect(page).toContain("<JobsTab");
  });
});

describe("JobsTab monta a composição do mockup com os componentes novos", () => {
  it.each([
    ["AgendaProximoCard", "./AgendaProximoCard"],
    ["AgendaAcoes", "./AgendaAcoes"],
    ["EstaSemanaSection", "./AgendaListas"],
    ["ProximasSemanasSection", "./AgendaListas"],
  ])("importa e renderiza %s", (name, from) => {
    expect(jobsTab).toMatch(
      new RegExp(`import\\s*{[^}]*\\b${name}\\b[^}]*}\\s*from\\s*"${from}"`)
    );
    expect(jobsTab).toContain(`<${name}`);
  });

  it("segue a ordem do mockup: título, próximo, ações, tira, Esta semana, Próximas semanas", () => {
    // O título agora divide a linha com a busca e o sino (pixel do mockup).
    const ordem = [
      ">\n          Agenda\n        </h1>",
      "<AgendaProximoCard",
      "<AgendaAcoes",
      "{weekStrip.map(",
      "<EstaSemanaSection",
      "<ProximasSemanasSection",
    ].map((marca) => {
      const idx = jobsTab.replace(/\r\n/g, "\n").indexOf(marca);
      expect(idx, marca).toBeGreaterThan(-1);
      return idx;
    });
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
  });

  it("o título Agenda é grande e em negrito forte (24px/800)", () => {
    expect(jobsTab).toMatch(
      /fontSize: "24px",\s*fontWeight: 800,[\s\S]{0,160}Agenda\s*<\/h1>/
    );
  });

  it("as listas recebem os atendimentos reais calculados pelas funções testadas abaixo", () => {
    expect(jobsTab).toContain("proximoAtendimento(jobs, now)");
    expect(jobsTab).toContain("atendimentosDaSemana(jobs, now)");
    expect(jobsTab).toContain("atendimentosProximasSemanas(jobs, now)");
    expect(jsxTag(jobsTab, "AgendaProximoCard")).toContain("job={proximo}");
    expect(jsxTag(jobsTab, "EstaSemanaSection")).toContain("jobs={daSemana}");
    expect(jsxTag(jobsTab, "ProximasSemanasSection")).toContain(
      "jobs={proximasSemanas}"
    );
  });

  it("a tira usa buildWeekStrip e marca hoje e dia com atendimento de formas diferentes", () => {
    expect(jobsTab).toContain("buildWeekStrip(weekStart, filtered)");
    // hoje = anel; dia com atendimento = ponto. Nunca a mesma marca.
    expect(jobsTab).toContain(
      'isToday && !selected ? "1px solid var(--accent)" : "none"'
    );
    // Ordem do operador (pixel da Agenda): o ponto só fora da semana
    // corrente -- a faixa do mockup não tem ponto.
    expect(jobsTab).toMatch(/hasJobs && !naSemanaCorrente\s*\?/);
    expect(jobsTab).toMatch(
      /const naSemanaCorrente =\s*weekStart\.getTime\(\) === startOfWeek\(new Date\(\)\)\.getTime\(\);/
    );
  });
});

describe("Títulos de seção exatos", () => {
  it('"Esta semana" e "Próximas semanas" são os títulos <h2> das seções', () => {
    expect(listas).toMatch(/<h2[^>]*>Esta semana<\/h2>/);
    expect(listas).toMatch(/<h2[^>]*>Próximas semanas<\/h2>/);
  });

  it('o card em destaque tem o rótulo "Próximo atendimento" e o atalho "Lembrar cliente ›"', () => {
    expect(proximoCard).toContain("Próximo atendimento");
    expect(proximoCard).toContain("Lembrar cliente ›");
  });
});

describe("As 4 ações ligam no que já existe", () => {
  it("os 4 rótulos existem, na ordem do mockup", () => {
    const labels = [...acoes.matchAll(/\{ label: "([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual(["Novo", "Bloquear", "Resumo", "Anotações"]);
  });

  it('"Bloquear" não tem ação (não existe no app) e o botão sem ação fica desabilitado', () => {
    // Ícone com o traço do mockup (components/jobs/agendaIcones.tsx).
    expect(acoes).toMatch(/\{ label: "Bloquear", Icon: IconeBloquear \}/);
    expect(acoes).toContain("disabled={!onClick}");
  });

  it('"Novo" abre o JobForm real da página em modo de criação (onEditJob(null)), sem formulário próprio', () => {
    expect(jsxTag(jobsTab, "AgendaAcoes")).toContain(
      "onNovo={() => onEditJob(null)}"
    );
    expect(jobsTab).toContain("onEditJob: (job: Job | null) => void");
    expect(jobsTab).not.toMatch(/import\s*{[^}]*\bJobForm\b/);
  });

  it('"Resumo" abre o AgendaResumoSheet real e só quando há atendimento (gate que já existia)', () => {
    const tag = jsxTag(jobsTab, "AgendaAcoes");
    expect(tag).toMatch(
      /onResumo=\{\s*!initialLoading && jobs\.length > 0\s*\?\s*\(\) => setResumoOpen\(true\)\s*:\s*undefined\s*\}/
    );
    expect(jobsTab).toMatch(/<AgendaResumoSheet\s+open=\{resumoOpen\}/);
  });

  it('"Anotações" abre o bloco de notas real (NotasSection)', () => {
    expect(jsxTag(jobsTab, "AgendaAcoes")).toContain(
      "onAnotacoes={() => setAnotacoesOpen(true)}"
    );
    expect(jobsTab).toMatch(
      /<BottomSheet\s+open=\{anotacoesOpen\}[\s\S]*?<NotasSection userId=\{userId\} \/>/
    );
  });

  it("os dois botões antigos do fim da página saíram (não há ação duplicada)", () => {
    expect(jobsTab).not.toContain("NotebookPen");
    expect(jobsTab).not.toMatch(/>\s*Bloco de notas\s*<\/button>/);
  });

  it('"Ver tudo ›" fica desabilitado (não existe ação para ele no app)', () => {
    expect(listas).toMatch(/disabled[\s\S]{0,300}Ver tudo ›/);
  });

  it('"Lembrar cliente ›" tem ação (decisão antiga revogada pelo operador): abre o cartão de agenda', () => {
    expect(proximoCard).toMatch(
      /onClick=\{\(\) => onLembrar\?\.\(job\)\}[\s\S]{0,800}Lembrar cliente ›/
    );
    expect(proximoCard).not.toMatch(
      /disabled\s+aria-disabled="true"[\s\S]{0,300}Lembrar cliente ›/
    );
  });
});

describe("Status vêm de status.ts", () => {
  it("as linhas de Esta semana usam o rótulo de STATUS_META, sem texto de status próprio", () => {
    expect(listas).toMatch(
      /import\s*{\s*STATUS_META\s*}\s*from\s*"\.\/status"/
    );
    expect(listas).toContain("${meta.label}");
    expect(listas).not.toMatch(/"(Agendado|Confirmado|Concluído|Cancelado)"/);
  });
});

describe("Nenhum nome ou valor ilustrativo do mockup no código", () => {
  const ILUSTRATIVOS = [
    "Renata Ferreira",
    "Camila Duarte",
    "Juliana Prado",
    "Beatriz Lima",
    "Larissa Costa",
    "Fernanda Rocha",
    "Paula Mendes",
    "Carla Nunes",
    "Studio Miguel",
    "R$ 180",
    "R$ 120",
    "R$ 150",
    "R$ 200",
    "R$ 220",
    "R$ 160",
    "25 de setembro",
    "em 2 dias",
    "Dom 20",
    "Sex 25",
  ];
  const arquivos = readdirSync(join(ROOT, "components/jobs")).map(
    (f) => `components/jobs/${f}`
  );

  it.each(arquivos)("%s não contém nome/valor do mockup", (arquivo) => {
    const src = read(arquivo);
    for (const valor of ILUSTRATIVOS) {
      expect(src, `${valor} em ${arquivo}`).not.toContain(valor);
    }
  });
});

// ---------------------------------------------------------------------------
// Lógica pura
// ---------------------------------------------------------------------------

let seq = 0;
function job(
  data: string,
  hora = "10:00",
  status: JobStatus = "agendado",
  extra: Partial<Job> = {}
): Job {
  seq += 1;
  return {
    id: `j${seq}`,
    clienteNome: `Cliente ${seq}`,
    data,
    hora,
    valor: 100,
    modalidade: "presencial",
    status,
    criadoEm: "2026-01-01T00:00:00Z",
    ...extra,
  };
}

const at = (iso: string, hora = "12:00") => new Date(`${iso}T${hora}:00`);

describe("Tira da semana", () => {
  it("semana totalmente vazia: 7 dias, D S T Q Q S S, nenhum marcado com atendimento", () => {
    const strip = buildWeekStrip(startOfWeek(at("2026-11-11")), []);
    expect(strip).toHaveLength(7);
    expect(strip.map((d) => d.letter)).toEqual([
      "D",
      "S",
      "T",
      "Q",
      "Q",
      "S",
      "S",
    ]);
    expect(strip.map((d) => d.day)).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(strip.every((d) => !d.hasJobs)).toBe(true);
  });

  it("semana vazia mesmo com atendimentos em outras semanas", () => {
    const jobs = [job("2026-11-07"), job("2026-11-15")];
    const strip = buildWeekStrip(startOfWeek(at("2026-11-11")), jobs);
    expect(strip.some((d) => d.hasJobs)).toBe(false);
  });

  it("virada de mês: a semana que começa em 27/09 segue até 03/10 com as datas reais", () => {
    const jobs = [job("2026-09-30"), job("2026-10-02")];
    const strip = buildWeekStrip(startOfWeek(at("2026-10-01")), jobs);
    expect(strip.map((d) => d.iso)).toEqual([
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
    expect(strip.map((d) => d.day)).toEqual([27, 28, 29, 30, 1, 2, 3]);
    expect(strip.filter((d) => d.hasJobs).map((d) => d.iso)).toEqual([
      "2026-09-30",
      "2026-10-02",
    ]);
  });

  it("virada de ano: 27/12 a 02/01", () => {
    const strip = buildWeekStrip(startOfWeek(at("2027-01-01")), []);
    expect(strip[0].iso).toBe("2026-12-27");
    expect(strip[6].iso).toBe("2027-01-02");
  });

  it("começa no domingo mesmo quando hoje é domingo ou sábado", () => {
    expect(buildWeekStrip(startOfWeek(at("2026-09-27")), [])[0].iso).toBe(
      "2026-09-27"
    );
    expect(buildWeekStrip(startOfWeek(at("2026-10-03")), [])[0].iso).toBe(
      "2026-09-27"
    );
  });
});

describe("Próximo atendimento", () => {
  it("o mais cedo a partir de agora, só agendado/confirmado", () => {
    const passado = job("2026-10-01", "09:00");
    const cancelado = job("2026-10-01", "13:00", "cancelado");
    const concluido = job("2026-10-01", "14:00", "concluído");
    const depois = job("2026-10-05", "09:00", "confirmado");
    const primeiro = job("2026-10-01", "15:00");
    const r = proximoAtendimento(
      [depois, passado, cancelado, concluido, primeiro],
      at("2026-10-01", "12:00")
    );
    expect(r?.id).toBe(primeiro.id);
  });

  it("sem atendimento futuro devolve null (o card mostra o estado vazio)", () => {
    expect(
      proximoAtendimento([job("2026-09-01")], at("2026-10-01"))
    ).toBeNull();
    expect(proximoAtendimento([], at("2026-10-01"))).toBeNull();
  });
});

describe("Listas Esta semana / Próximas semanas", () => {
  const hoje = at("2026-10-01"); // quinta; semana 27/09–03/10
  const domingo = job("2026-09-27", "10:00", "concluído");
  const sabado = job("2026-10-03", "18:00", "cancelado");
  const quarta = job("2026-09-30", "08:00");
  const anterior = job("2026-09-26");
  const seguinte = job("2026-10-04", "09:00");
  const longe = job("2026-11-20");
  const canceladoFuturo = job("2026-10-10", "09:00", "cancelado");
  const todos = [
    longe,
    sabado,
    seguinte,
    anterior,
    quarta,
    domingo,
    canceladoFuturo,
  ];

  it("Esta semana: domingo a sábado da semana real, atravessando o mês, em ordem, com todos os status", () => {
    expect(atendimentosDaSemana(todos, hoje).map((j) => j.id)).toEqual([
      domingo.id,
      quarta.id,
      sabado.id,
    ]);
  });

  it("Esta semana vazia devolve lista vazia", () => {
    expect(atendimentosDaSemana(todos, at("2026-11-11"))).toEqual([]);
  });

  it("Próximas semanas: só depois do sábado, em ordem, sem cancelados", () => {
    expect(atendimentosProximasSemanas(todos, hoje).map((j) => j.id)).toEqual([
      seguinte.id,
      longe.id,
    ]);
  });
});

describe("Formatação das linhas", () => {
  it('dia curto "Dom 27" / "Qui 01" e dia por extenso sem "-feira"', () => {
    expect(formatDiaCurto("2026-09-27")).toBe("Dom 27");
    expect(formatDiaCurto("2026-10-01")).toBe("Qui 01");
    expect(formatDiaCurto("2027-01-02")).toBe("Sáb 02");
    expect(formatDiaExtenso("2026-10-01")).toBe("Quinta, 1 de outubro");
    expect(formatDiaExtenso("2027-01-02")).toBe("Sábado, 2 de janeiro");
  });

  it("local só com dado real: online, o local salvo, ou nada", () => {
    expect(
      localDoAtendimento(
        job("2026-10-01", "10:00", "agendado", { modalidade: "online" })
      )
    ).toBe("Online");
    expect(
      localDoAtendimento(
        job("2026-10-01", "10:00", "agendado", { local: "Sala 2" })
      )
    ).toBe("Sala 2");
    expect(
      localDoAtendimento(
        job("2026-10-01", "10:00", "agendado", { local: "  " })
      )
    ).toBeNull();
    expect(localDoAtendimento(job("2026-10-01"))).toBeNull();
  });

  it("inicial do avatar", () => {
    expect(inicialDoNome(" ana")).toBe("A");
    expect(inicialDoNome("")).toBe("?");
  });
});
