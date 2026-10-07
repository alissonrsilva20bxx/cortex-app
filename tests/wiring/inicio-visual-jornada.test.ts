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
      expect(painel).toMatch(
        /<div className="grid grid-cols-2 gap-\[10px\] \[&>:last-child:nth-child\(even\)\]:col-span-2">/
      );
      expect(painel).toMatch(
        /<div className="col-span-2 flex flex-col gap-\[10px\]">\s*\{\/\*[\s\S]*?\*\/\}\s*<div data-tour="home-hero">\s*<HeroCard/
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

/** Os arquivos que o J02 escreve: as duas páginas e components/home/*. */
const ARQUIVOS_J02 = [
  ...PAGINAS,
  ...readdirSync(join(ROOT, "components", "home")).map(
    (f) => `components/home/${f}`
  ),
];

describe("J02 — nada dos valores ilustrativos do mockup no código (app, laboratório e components/home)", () => {
  // Revisão da PR #169: o laboratório também entra na varredura -- é um
  // dos arquivos que este ticket edita.
  const producao = ARQUIVOS_J02;
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

/** Fonte sem comentários: um número num comentário não é cálculo. */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("J02 — 'não mude cálculo': todo número vem da conta que já existia", () => {
  // Revisão da PR #169: trocar `p.meta` por `3500` no HeroCard passava em
  // todos os casos. Estas guardas amarram cada valor exibido ao campo que
  // o produz, em vez de só conferir o texto em volta.
  const COM_DINHEIRO = [
    "components/home/HeroCard.tsx",
    "components/home/FaltaMetaCard.tsx",
    "components/home/SemanaSection.tsx",
    "components/home/ProximosAtendimentos.tsx",
  ];
  const ARG_PERMITIDO =
    /^(p\.(earned|meta|remaining|projectedMonthEnd)|job\.valor)$/;

  for (const arquivo of COM_DINHEIRO) {
    it(`${arquivo}: todo formatBRL(...) recebe um campo de monthProjection ou o valor do atendimento`, () => {
      const src = semComentarios(read(arquivo));
      const args = [...src.matchAll(/formatBRL\(\s*([^()]*?)\s*\)/g)].map(
        (m) => m[1]
      );
      expect(args.length).toBeGreaterThan(0);
      for (const a of args) expect(a, `formatBRL(${a})`).toMatch(ARG_PERMITIDO);
    });
  }

  for (const arquivo of [
    "components/home/HeroCard.tsx",
    "components/home/FaltaMetaCard.tsx",
  ]) {
    it(`${arquivo}: calcula só com monthProjection(jobs, metas), uma vez, de lib/finance`, () => {
      const src = semComentarios(read(arquivo));
      expect(src).toMatch(
        /^import \{[^}]*\bmonthProjection\b[^}]*\} from "@\/lib\/finance";$/m
      );
      expect(src.match(/monthProjection\(/g)).toHaveLength(1);
      expect(src).toContain("const p = monthProjection(jobs, metas);");
      // Nenhuma reconstrução local da conta.
      expect(src).not.toMatch(/monthEarnings|monthMeta|reduce\(/);
    });
  }

  it("HeroCard: percentual e barra vêm de p.pct e p.barFraction", () => {
    const src = semComentarios(read("components/home/HeroCard.tsx"));
    expect(src).toContain("{Math.round(p.pct)}% da meta");
    expect(src).toContain("`${Math.round(p.barFraction * 100)}%`");
    expect(src).toMatch(/\{p\.pct !== null && \(/);
  });

  it("FaltaMetaCard: mostra p.remaining e some sem meta", () => {
    const src = semComentarios(read("components/home/FaltaMetaCard.tsx"));
    expect(src).toContain(
      "if (p.meta === null || p.remaining === null) return null;"
    );
    expect(src).toContain("{formatBRL(p.remaining)}");
  });

  it("ObjetivosCard: a contagem sai do campo binário `concluido`", () => {
    const src = semComentarios(read("components/home/ObjetivosCard.tsx"));
    expect(src).toContain("const total = objetivos.length;");
    expect(src).toContain(
      "const feitos = objetivos.filter((o) => o.concluido).length;"
    );
    expect(src).toContain("{feitos} de {total}");
  });

  for (const arquivo of ARQUIVOS_J02.filter((f) =>
    f.startsWith("components/")
  )) {
    it(`${arquivo}: nenhum valor de dinheiro escrito à mão`, () => {
      const src = semComentarios(read(arquivo));
      // Milhar com ponto (3.500) ou número de 4+ dígitos fora de CSS.
      expect(src).not.toMatch(/\b\d{1,3}(\.\d{3})+\b/);
      expect(src).not.toMatch(/\b\d{4,}\b/);
    });
  }
});

describe("J02 — cor sempre do tema, nunca o rosa fixo do protótipo (#ff2d78, decisão da Fase 1/#124)", () => {
  // Revisão da PR #169: a guarda existia só pro card principal; vale pra
  // tudo que o J02 escreve.
  for (const arquivo of ARQUIVOS_J02) {
    it(`${arquivo} não usa #ff2d78 nem #ff376e`, () => {
      expect(read(arquivo)).not.toMatch(/#ff2d78|#ff376e/i);
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
