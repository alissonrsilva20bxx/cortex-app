import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { progressoMeta } from "@/components/financeiro/progressoMeta";

/**
 * Jornada J04 (#154) — o Financeiro no visual do mockup aprovado
 * (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html). Teste de
 * fiação: lê o fonte e afirma que a ligação EXISTE (import do caminho real
 * + montagem), que nenhum número veio de fora das contas que já existiam,
 * e que nenhuma data é montada em UTC. Cada guarda foi validada apagando
 * a fiação ou trocando um campo por um literal (ver o PR).
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

/** Fonte sem comentários: um número num comentário não é cálculo. */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** O painel de uma aba no page.tsx -- montar em outra aba não conta. */
function painel(src: string, tab: string): string {
  const start = src.indexOf(`<TabPanel tab="${tab}"`);
  if (start === -1) throw new Error(`<TabPanel tab="${tab}"> não encontrado`);
  return src.slice(start, src.indexOf("</TabPanel>", start));
}

/** Os arquivos que o J04 escreve. */
const TOCADOS = [
  "components/financeiro/FinanceiroTab.tsx",
  "components/financeiro/FinanceiroHeroCard.tsx",
  "components/financeiro/VisaoTab.tsx",
  "components/financeiro/MetasTab.tsx",
  "components/financeiro/FinCard.tsx",
  "components/financeiro/progressoMeta.ts",
];

describe("J04 — os componentes reais estão montados", () => {
  for (const pagina of ["app/page.tsx", "app/dev-preview/app/page.tsx"]) {
    it(`${pagina}: importa FinanceiroTab do caminho real e monta no painel do Financeiro`, () => {
      const src = read(pagina);
      expect(src).toMatch(
        /^import \{ FinanceiroTab \} from "@\/components\/financeiro\/FinanceiroTab";$/m
      );
      expect(painel(src, "financeiro")).toMatch(/<FinanceiroTab\s/);
    });
  }

  it("FinanceiroTab monta o card de saldo (com as metas reais) e a Visão", () => {
    const src = read("components/financeiro/FinanceiroTab.tsx");
    expect(src).toMatch(
      /^import \{ FinanceiroHeroCard \} from "\.\/FinanceiroHeroCard";$/m
    );
    expect(src).toMatch(/^import \{ VisaoTab \} from "\.\/VisaoTab";$/m);
    // Só dentro da tag do card de saldo (até o "/>"), não o metas={metas}
    // do MetasTab mais abaixo.
    const hero = src.match(/<FinanceiroHeroCard\b[^>]*?\/>/);
    expect(hero).not.toBeNull();
    expect(hero![0]).toContain("metas={metas}");
    expect(src).toMatch(
      /tab === "visao" && \(\s*<VisaoTab jobs=\{jobs\} despesas=\{despesas\} receitas=\{receitas\} \/>/
    );
  });

  for (const arquivo of [
    "components/financeiro/FinanceiroHeroCard.tsx",
    "components/financeiro/VisaoTab.tsx",
  ]) {
    it(`${arquivo} usa a superfície única FinCard`, () => {
      const src = read(arquivo);
      expect(src).toMatch(/^import \{ FinCard \} from "\.\/FinCard";$/m);
      expect(src).toContain("<FinCard");
      expect(src).not.toMatch(/background:\s*"var\(--card-solid\)"/);
    });
  }
});

describe("J04 — os títulos de seção do mockup", () => {
  const src = read("components/financeiro/VisaoTab.tsx");

  it('"Recentes" e "Mais lançamentos" são <h2> da Visão', () => {
    expect(src).toMatch(/<h2[^>]*>\s*Recentes\s*<\/h2>/);
    expect(src).toMatch(/<h2[^>]*>\s*Mais lançamentos\s*<\/h2>/);
  });

  it("as duas listas são as mesmas movimentações de antes, divididas", () => {
    expect(src).toContain(
      "const movements = buildMovements(jobs, despesas, receitas);"
    );
    expect(src).toContain("const recentes = movements.slice(0, QTD_RECENTES);");
    expect(src).toContain("const mais = movements.slice(QTD_RECENTES);");
  });
});

describe("J04 — cabeçalho e botão Novo", () => {
  const src = read("components/financeiro/FinanceiroTab.tsx");

  it('"Novo" abre o mesmo formulário que o "+" abre em cada sub-aba', () => {
    expect(src).toMatch(
      /const acaoNovo =\s*tab === "entradas"\s*\?\s*onAddReceita\s*:\s*tab === "metas"\s*\?\s*undefined\s*:\s*onAddDespesa;/
    );
    expect(src).toMatch(/onClick=\{acaoNovo\}[\s\S]{0,600}Novo/);
  });

  it('título "Financeiro" e o mês por extenso vindo da data real', () => {
    expect(src).toMatch(/<h1[\s\S]{0,200}>\s*Financeiro\s*<\/h1>/);
    expect(src).toContain("{monthYearLabel}");
  });
});

describe("J04 — entrada x saída nunca só pela cor", () => {
  it("o valor de cada movimentação leva o sinal no texto", () => {
    const src = semComentarios(read("components/financeiro/VisaoTab.tsx"));
    expect(src).toMatch(
      /\{m\.positive \? "\+" : "-"\}\s*\{formatBRL\(m\.valor\)\}/
    );
    // As duas listas usam esse mesmo componente de valor.
    expect(src.match(/<Valor m=\{m\}/g)).toHaveLength(2);
  });

  it("a pílula de variação leva o sinal no texto", () => {
    const src = semComentarios(
      read("components/financeiro/FinanceiroHeroCard.tsx")
    );
    expect(src).toMatch(
      /\{variacaoPct >= 0 \? "\+" : ""\}\s*\{Math\.round\(variacaoPct\)\}% vs \{mesAnterior\}/
    );
  });
});

describe("J04 — 'nenhuma conta muda': todo número vem do que já existia", () => {
  const hero = semComentarios(
    read("components/financeiro/FinanceiroHeroCard.tsx")
  );

  it("FinanceiroHeroCard: todo formatBRL(...) recebe um total pronto do FinanceiroTab ou a meta mensal", () => {
    const args = [...hero.matchAll(/formatBRL\(\s*([^()]*?)\s*\)/g)].map(
      (m) => m[1]
    );
    expect(args.length).toBeGreaterThan(0);
    for (const a of args) {
      expect(a, `formatBRL(${a})`).toMatch(
        /^(saldo|totalEntradaMes|totalDespMes|metaMes)$/
      );
    }
  });

  it("FinanceiroHeroCard: saldo e totais chegam como props, sem reconstruir a conta", () => {
    // O único calcEarnings/monthExpenses do arquivo é o do mês anterior
    // (variação, #136); o mês corrente vem pronto do FinanceiroTab.
    expect(hero.match(/calcEarnings\(/g)).toHaveLength(1);
    expect(hero).toContain('calcEarnings(jobs, receitas, "mes", prevRef)');
    expect(hero.match(/monthExpenses\(/g)).toHaveLength(1);
    expect(hero).toContain("monthExpenses(despesas, prevRef)");
    expect(hero).not.toMatch(/\.reduce\(/);
  });

  it("FinanceiroHeroCard: a meta usa monthMeta e a mesma conta do MetasTab (progressoMeta)", () => {
    expect(hero).toContain("const metaMes = monthMeta(metas);");
    expect(hero).toContain("progressoMeta(totalEntradaMes, metaMes)");
    expect(hero).toContain("{Math.round(metaPct)}%");
    const metas = semComentarios(read("components/financeiro/MetasTab.tsx"));
    expect(metas).toContain(
      "const current = calcEarnings(jobs, receitas, meta.periodo);"
    );
    expect(metas).toContain(
      "const pct = progressoMeta(current, meta.valorAlvo);"
    );
  });

  it("FinanceiroTab: as contas do mês continuam as de antes", () => {
    const src = semComentarios(read("components/financeiro/FinanceiroTab.tsx"));
    expect(src).toContain(
      'const totalEntradaMes = calcEarnings(jobs, receitas, "mes");'
    );
    expect(src).toContain(
      "const totalDespMes = despMes.reduce((s, d) => s + d.valor, 0);"
    );
    expect(src).toContain("const saldo = totalEntradaMes - totalDespMes;");
  });

  it("VisaoTab: o valor exibido é sempre o da movimentação", () => {
    const src = semComentarios(read("components/financeiro/VisaoTab.tsx"));
    const args = [...src.matchAll(/formatBRL\(\s*([^()]*?)\s*\)/g)].map(
      (m) => m[1]
    );
    expect(args).toEqual(["m.valor"]);
  });

  it("progressoMeta é a conta de sempre: entrou / alvo, limitado a 100", () => {
    expect(progressoMeta(430, 3500)).toBeCloseTo((430 / 3500) * 100);
    expect(progressoMeta(5000, 3500)).toBe(100);
    expect(progressoMeta(0, 3500)).toBe(0);
  });

  for (const arquivo of TOCADOS) {
    it(`${arquivo}: nenhum valor de dinheiro escrito à mão`, () => {
      const src = semComentarios(read(arquivo));
      expect(src).not.toMatch(/\b\d{1,3}(\.\d{3})+\b/);
      expect(src).not.toMatch(/\b\d{4,}\b/);
    });
  }
});

describe("J04 — nada do mockup no código", () => {
  const DO_MOCKUP = [
    "R$ 217",
    "-56%",
    "Sônia Aparecida",
    "Uber pra atendimento",
    "Almoço entre atendimentos",
    "Material de trabalho",
    "Camila Duarte",
    "Estacionamento",
    "R$ 530",
    "R$ 313",
    "R$ 177",
    "3.500",
    "agosto",
    "Setembro de 2026",
  ];
  for (const arquivo of TOCADOS) {
    it(`${arquivo} não traz nenhum valor do mockup`, () => {
      const src = read(arquivo);
      for (const v of DO_MOCKUP) expect(src, v).not.toContain(v);
    });
  }
});

describe("J04 — nenhuma data montada em UTC nos arquivos tocados", () => {
  // Bug já corrigido aqui: a data padrão de Despesa/Receita saía em UTC e
  // caía no dia errado. Datas "YYYY-MM-DD" se leem com "T00:00:00" (local).
  for (const arquivo of TOCADOS) {
    it(`${arquivo}: sem toISOString/getUTC*/Date.UTC, e new Date(<data>) sempre local`, () => {
      const src = semComentarios(read(arquivo));
      expect(src).not.toMatch(/toISOString|getUTC|setUTC|Date\.UTC/);
      for (const m of src.matchAll(
        /new Date\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g
      )) {
        const arg = m[1].trim();
        // Sem argumento (agora), por partes (ano, mês, dia) ou string com
        // horário local explícito.
        const ok =
          arg === "" || /getFullYear\(\)/.test(arg) || /T00:00:00/.test(arg);
        expect(ok, `new Date(${arg})`).toBe(true);
      }
    });
  }
});
