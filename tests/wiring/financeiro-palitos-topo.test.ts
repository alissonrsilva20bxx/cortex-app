import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Gráfico de palitos do Financeiro de volta ao topo (decisão do operador
 * sobre o preview real): logo abaixo dos 4 cards, exatamente o bloco de
 * antes da PR de pixel (commit 4451e1b^, FinanceiroHeroCard), e só UM
 * gráfico na tela -- o de barras que ficava abaixo dos lançamentos saiu.
 *
 * Teste de fiação, por texto (mesmo padrão dos outros de tests/wiring): o
 * pixel é medido por tests/visual/pixel/financeiro-grafico.mjs (gráfico ×
 * app daquele commit, app real × laboratório) e pelo comparar.mjs com
 * `--ate='[data-pixel="grafico-palitos"]'` (saldo e 4 cards × mockup).
 */

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) =>
  readFileSync(join(ROOT, rel), "utf-8").replace(/\r\n/g, "\n");

/** Linhas de código sem indentação, sem linhas vazias e sem comentários de
 * linha inteira: o bloco de antes e o de agora mudam de indentação (saíram
 * de dentro do hero), não de conteúdo. */
const normalizar = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"));

/** O bloco do gráfico em 4451e1b^ (FinanceiroHeroCard.tsx), normalizado. */
const BLOCO_DE_ANTES = [
  '<FinCard style={{ padding: "16px" }}>',
  '<div className="flex items-center justify-between mb-3">',
  "<span",
  'className="font-semibold"',
  'style={{ fontSize: "11px", color: "var(--text-muted)" }}',
  ">",
  "Resumo financeiro",
  "</span>",
  '{chartType !== "area" && (',
  "<SegmentedControl",
  'size="sm"',
  "minTouchTarget",
  "options={PERIOD_OPTS}",
  "value={chartPeriod}",
  "onChange={setChartPeriod}",
  "/>",
  ")}",
  "</div>",
  '{chartType === "area" ? (',
  '<AreaSparkline data={sparkData} height={100} id="fin-hero-area" />',
  ") : (",
  '<MiniBarChart data={chartData} height={100} id="fin-hero-bar" />',
  ")}",
  "</FinCard>",
];

const grafico = read("components/financeiro/FinanceiroGrafico.tsx");
const hero = read("components/financeiro/FinanceiroHeroCard.tsx");
const tab = read("components/financeiro/FinanceiroTab.tsx");

describe("FinanceiroGrafico é o gráfico de palitos de antes da PR de pixel", () => {
  it("o JSX do gráfico é o bloco de 4451e1b^, linha a linha", () => {
    const ini = grafico.indexOf('<FinCard style={{ padding: "16px" }}>');
    const fim = grafico.indexOf("</FinCard>") + "</FinCard>".length;
    expect(ini).toBeGreaterThan(-1);
    expect(normalizar(grafico.slice(ini, fim))).toEqual(BLOCO_DE_ANTES);
  });

  it("usa os palitos e a área de antes (components/charts), não barras HTML novas", () => {
    expect(grafico).toMatch(
      /^import \{ MiniBarChart \} from "@\/components\/charts\/MiniBarChart";$/m
    );
    expect(grafico).toMatch(
      /^import \{ AreaSparkline \} from "@\/components\/charts\/AreaSparkline";$/m
    );
    expect(grafico).toMatch(/^import \{ FinCard \} from "\.\/FinCard";$/m);
    expect(grafico).not.toMatch(/function Barras|function Area\b/);
  });

  it("os dados e o período são os de antes (Semana por padrão)", () => {
    expect(grafico).toContain('useState<ChartPeriod>("sem");');
    expect(grafico).toContain("buildChartData(jobs, receitas, chartPeriod)");
    expect(grafico).toContain("last30DaysSpark(jobs, receitas)");
    expect(grafico).toMatch(
      /\{ id: "sem", label: "Semana" \},\s*\{ id: "mes", label: "Mês" \},\s*\{ id: "ano", label: "Ano" \},/
    );
    expect(grafico).toContain('chartType = "bar",');
  });
});

describe("o gráfico fica no topo, logo abaixo dos 4 cards, e só uma vez", () => {
  it("o hero monta o gráfico depois do Ticket médio, ocupando as 2 colunas", () => {
    const ticket = hero.indexOf("<span style={ROTULO}>Ticket médio</span>");
    const uso = hero.search(
      /<div data-pixel="grafico-palitos" style=\{\{ gridColumn: "span 2" \}\}>\s*<FinanceiroGrafico\s+jobs=\{jobs\}\s+receitas=\{receitas\}\s+chartType=\{chartType\}\s*\/>\s*<\/div>\s*<\/div>\s*\);\s*\}\s*$/
    );
    expect(ticket).toBeGreaterThan(-1);
    expect(uso).toBeGreaterThan(ticket);
  });

  it("a grade do hero mantém o gap de 10px (o mesmo da coluna de antes)", () => {
    expect(hero).toMatch(
      /gridTemplateColumns: "repeat\(2, minmax\(0, 1fr\)\)",\s*gap: "10px",/
    );
  });

  it("a preferência de Ajustes chega ao gráfico pelo hero", () => {
    expect(hero).toContain('chartType?: "bar" | "area";');
    expect(hero).toMatch(/metas,\s*chartType = "bar",\s*\}: Props\)/);
    expect(tab).toMatch(
      /<FinanceiroHeroCard[\s\S]*?metas=\{metas\}\s*chartType=\{chartType\}\s*\/>/
    );
  });

  it("o FinanceiroTab não desenha um segundo gráfico abaixo dos lançamentos", () => {
    expect(tab).not.toContain("FinanceiroGrafico");
    expect(tab).not.toMatch(/MiniBarChart|AreaSparkline|buildChartData/);
    const usos = [...hero.matchAll(/<FinanceiroGrafico\b/g)];
    expect(usos).toHaveLength(1);
  });

  it("o hero (com o gráfico) vem antes da Visão e das sub-abas", () => {
    const heroIdx = tab.indexOf("<FinanceiroHeroCard");
    const visaoIdx = tab.indexOf("<VisaoTab");
    expect(heroIdx).toBeGreaterThan(-1);
    expect(visaoIdx).toBeGreaterThan(heroIdx);
  });
});

describe("laboratório e app real renderizam o MESMO FinanceiroTab", () => {
  for (const pagina of ["app/page.tsx", "app/dev-preview/app/page.tsx"]) {
    it(`${pagina} monta o FinanceiroTab real com a preferência de Ajustes`, () => {
      const src = read(pagina);
      expect(src).toMatch(
        /^import \{ FinanceiroTab \} from "@\/components\/financeiro\/FinanceiroTab";$/m
      );
      expect(src).toMatch(
        /<FinanceiroTab\s+userId=\{usuario\.id\}\s+refreshTrigger=\{financeiroRefreshKey\}\s+chartType=\{chartPrefs\.financeiro\}/
      );
      expect(src).not.toMatch(/FinanceiroGrafico|MiniBarChart/);
    });
  }
});
