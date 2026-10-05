import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Job } from "@/lib/types";
import {
  atendimentosDepoisDaSemana,
  diasRestantesDaSemana,
  fimDaSemana,
  formatHora,
  proximoAtendimento,
  rotuloDiaCurto,
  rotuloDiaFrase,
} from "@/components/home/inicioAgenda";

/**
 * Jornada J02 (#152) — a Início no visual do mockup aprovado
 * (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html). Teste de
 * fiação: lê o fonte e afirma que a ligação EXISTE (import do caminho
 * real + montagem dentro do painel da Início, na ordem do mockup), não só
 * que um nome aparece em algum lugar do arquivo. Lição da revisão do J01:
 * cada afirmação aqui foi validada apagando a fiação e vendo o teste
 * falhar (ver o PR).
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

/** Só o conteúdo do painel da Início -- montar em outra aba não conta. */
function homePanel(src: string): string {
  const start = src.indexOf('<TabPanel tab="home"');
  if (start === -1) throw new Error('<TabPanel tab="home"> não encontrado');
  const end = src.indexOf("</TabPanel>", start);
  return src.slice(start, end);
}

/** Na ordem do mockup, de cima pra baixo. */
const COMPONENTES_INICIO = [
  "GreetingHeader",
  "HeroCard",
  "NextJobCard",
  "ObjetivosCard",
  "FaltaMetaCard",
  "CofreCard",
  "SemanaSection",
  "ProximosAtendimentos",
];

const PAGINAS = ["app/dev-preview/app/page.tsx", "app/page.tsx"];

describe("J02 — /dev-preview/app e app/page.tsx montam a Início real, na ordem do mockup", () => {
  for (const pagina of PAGINAS) {
    const src = read(pagina);
    const painel = homePanel(src);

    for (const nome of COMPONENTES_INICIO) {
      it(`${pagina}: importa ${nome} de @/components/home/${nome} e monta no painel da Início`, () => {
        expect(src).toMatch(
          new RegExp(
            `^import \\{ ${nome} \\} from "@/components/home/${nome}";$`,
            "m"
          )
        );
        expect(painel).toMatch(new RegExp(`<${nome}[\\s/>]`));
      });
    }

    it(`${pagina}: a ordem no painel é a do mockup`, () => {
      const posicoes = COMPONENTES_INICIO.map((n) =>
        painel.search(new RegExp(`<${n}[\\s/>]`))
      );
      expect(posicoes.every((p) => p >= 0)).toBe(true);
      expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
    });

    it(`${pagina}: o card principal e a grade de 2 colunas`, () => {
      expect(painel).toMatch(/<div className="grid grid-cols-2 gap-\[10px\] \[&>:last-child:nth-child\(even\)\]:col-span-2">/);
      expect(painel).toMatch(
        /<div data-tour="home-hero" className="col-span-2">\s*<HeroCard/
      );
    });

    it(`${pagina}: as props novas estão ligadas ao que já existe`, () => {
      // "Novo" do cabeçalho abre o mesmo JobForm que o "+" da Início.
      expect(painel).toMatch(
        /<GreetingHeader[\s\S]*?onNovo=\{\(\) => \{\s*setEditingJob\(null\);\s*setJobFormOpen\(true\);\s*\}\}/
      );
      // Cofre: "Protegido" vem do PIN real, e o toque abre a aba Cofre.
      expect(painel).toMatch(
        /<CofreCard\s+protegido=\{Boolean\(pinHash\)\}\s+onOpenCofre=\{\(\) => handleTabChange\("cofre"\)\}/
      );
      // "Agenda ›" leva à aba Agenda.
      expect(painel).toMatch(
        /<SemanaSection\s+jobs=\{jobs\}\s+onGoToAgenda=\{\(\) => handleTabChange\("jobs"\)\}/
      );
    });
  }
});

describe("J02 — os dois títulos de seção do mockup", () => {
  it('"Esta semana" é o <h2> de SemanaSection, com o atalho "Agenda ›"', () => {
    const src = read("components/home/SemanaSection.tsx");
    expect(src).toMatch(/<h2[^>]*>\s*Esta semana\s*<\/h2>/);
    expect(src).toMatch(/onClick=\{onGoToAgenda\}[\s\S]{0,300}Agenda ›/);
    expect(src).toContain("Dia livre");
  });

  it('"Próximos atendimentos" é o <h2> de ProximosAtendimentos', () => {
    const src = read("components/home/ProximosAtendimentos.tsx");
    expect(src).toMatch(/<h2[^>]*>\s*Próximos atendimentos\s*<\/h2>/);
  });
});

describe("J02 — nada dos valores ilustrativos do mockup no código de produção", () => {
  const producao = [
    "app/page.tsx",
    ...readdirSync(join(ROOT, "components", "home")).map(
      (f) => `components/home/${f}`
    ),
  ];
  // Nomes, valores e datas que só existem no mockup.
  const DO_MOCKUP = [
    "3.500",
    "3.070",
    "Renata",
    "R$ 430",
    "7 de março",
    "Juliana",
    "Beatriz",
    "Studio Miguel",
    "Olá, Miguel",
  ];

  for (const arquivo of producao) {
    it(`${arquivo} não traz nenhum valor do mockup`, () => {
      const src = read(arquivo);
      for (const v of DO_MOCKUP) expect(src, v).not.toContain(v);
    });
  }
});

describe("J02 — inicioAgenda: arranjo dos atendimentos (sem cálculo novo)", () => {
  // Quarta, 23 de setembro de 2026, 10h -- o mesmo dia do mockup.
  const REF = new Date(2026, 8, 23, 10, 0);
  const job = (over: Partial<Job>): Job => ({
    id: Math.random().toString(36).slice(2),
    clienteNome: "Cliente",
    data: "2026-09-25",
    hora: "14:00",
    valor: 100,
    modalidade: "presencial",
    status: "agendado",
    criadoEm: "2026-09-01T00:00:00",
    ...over,
  });

  it("a semana vai de hoje até domingo", () => {
    const dias = diasRestantesDaSemana([], REF).map((d) => d.data);
    expect(dias).toEqual([
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
    // Domingo: só o próprio dia.
    const domingo = new Date(2026, 8, 27, 9, 0);
    expect(fimDaSemana(domingo).getDate()).toBe(27);
    expect(diasRestantesDaSemana([], domingo)).toHaveLength(1);
  });

  it("agrupa por dia em ordem de hora, só agendado/confirmado; dia vazio vem sem atendimentos", () => {
    const jobs = [
      job({ id: "b", data: "2026-09-25", hora: "16:00" }),
      job({ id: "a", data: "2026-09-25", hora: "09:30", status: "confirmado" }),
      job({ id: "x", data: "2026-09-25", hora: "11:00", status: "cancelado" }),
      job({ id: "y", data: "2026-09-24", status: "concluído" }),
    ];
    const dias = diasRestantesDaSemana(jobs, REF);
    const sexta = dias.find((d) => d.data === "2026-09-25")!;
    expect(sexta.jobs.map((j) => j.id)).toEqual(["a", "b"]);
    expect(dias.find((d) => d.data === "2026-09-24")!.jobs).toEqual([]);
  });

  it("'Próximos atendimentos' começa depois desta semana, em ordem, com limite", () => {
    const jobs = [
      job({ id: "semana", data: "2026-09-27" }),
      job({ id: "c", data: "2026-10-01" }),
      job({ id: "a", data: "2026-09-28", hora: "09:00" }),
      job({ id: "b", data: "2026-09-28", hora: "15:30" }),
      job({ id: "cancelado", data: "2026-09-29", status: "cancelado" }),
    ];
    expect(atendimentosDepoisDaSemana(jobs, REF).map((j) => j.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(atendimentosDepoisDaSemana(jobs, REF, 2)).toHaveLength(2);
  });

  it("o próximo atendimento ignora os que já passaram e os cancelados", () => {
    const jobs = [
      job({ id: "passou", data: "2026-09-23", hora: "08:00" }),
      job({
        id: "cancelado",
        data: "2026-09-23",
        hora: "11:00",
        status: "cancelado",
      }),
      job({ id: "proximo", data: "2026-09-23", hora: "15:00" }),
      job({ id: "depois", data: "2026-09-24", hora: "08:00" }),
    ];
    expect(proximoAtendimento(jobs, REF)?.id).toBe("proximo");
    expect(proximoAtendimento([], REF)).toBeNull();
  });

  it("rótulos de dia e hora no formato do mockup", () => {
    expect(rotuloDiaCurto("2026-09-25")).toBe("SEX 25");
    expect(rotuloDiaCurto("2026-09-26")).toBe("SÁB 26");
    expect(rotuloDiaFrase("2026-09-28")).toBe("Seg 28");
    expect(formatHora("14:00")).toBe("14h00");
    expect(rotuloDiaCurto("inválida")).toBe("");
  });
});
