import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * #174 — os seletores do Financeiro (Semana/Mês/Ano e Visão/Entradas/
 * Saídas/Metas) mediam 25px e 32px de altura, abaixo do alvo de toque de
 * 44px. A correção é uma opção opt-in no SegmentedControl compartilhado
 * (`minTouchTarget`, mesmo padrão de FilterChips/BottomSheet), ligada SÓ nos
 * dois usos do Financeiro. Os outros usos (Ajustes, Agenda, Meu espaço,
 * Amigas) têm de continuar idênticos. Teste de fiação: lê o fonte. A
 * medição na tela (44px no Financeiro, os outros sem mudança) está em
 * docs/jornada/prints/174/medicao-*.json.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const sc = read("components/ui/SegmentedControl.tsx");

/** Todo .tsx de app/ e components/ (exceto o próprio componente). */
function arquivosTsx(dir: string): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${nome}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...arquivosTsx(rel));
    else if (rel.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

/**
 * Cada <SegmentedControl ...> usado no app, com o arquivo. A tag vai até o
 * "/>" na MESMA indentação da abertura: as opções podem ter JSX dentro
 * (`<Moon size={14} />` em Ajustes), e parar no primeiro "/>" deixaria
 * escapar uma prop escrita depois delas.
 */
function tagsSegmented(src: string): string[] {
  const tags: string[] = [];
  for (const m of src.matchAll(/^([ \t]*)<SegmentedControl\b/gm)) {
    const inicio = m.index!;
    const fim = src.indexOf(`\n${m[1]}/>`, inicio);
    tags.push(
      src.slice(inicio, fim === -1 ? undefined : fim + m[1].length + 3)
    );
  }
  return tags;
}

const usos = [...arquivosTsx("app"), ...arquivosTsx("components")]
  .filter((f) => f !== "components/ui/SegmentedControl.tsx")
  .flatMap((arquivo) =>
    tagsSegmented(read(arquivo)).map((tag) => ({ arquivo, tag }))
  );

// O Semana/Mês/Ano saiu junto com o gráfico de palitos (correção do
// gráfico, 09/10/2026): fica o seletor do FinanceiroTab.
const FINANCEIRO = ["components/financeiro/FinanceiroTab.tsx"];

describe("#174 — SegmentedControl ganha minTouchTarget opt-in", () => {
  it("a opção existe e vem desligada por padrão", () => {
    expect(sc).toMatch(/minTouchTarget\?: boolean;/);
    expect(sc).toContain("minTouchTarget = false,");
  });

  it("desligada, o segmento é exatamente o de antes (mesma classe e mesmas cores)", () => {
    expect(sc).toContain('"py-2 rounded-xl text-xs"');
    expect(sc).toContain('"px-2.5 py-1 rounded-lg text-[11px]"');
    const ramoPadrao = sc.match(/if \(!minTouchTarget\) \{[\s\S]*?\n {8}\}/);
    expect(ramoPadrao).not.toBeNull();
    expect(ramoPadrao![0]).toContain(
      'className={`${stretch ? "flex-1" : ""} font-bold transition-all ${forma}`}'
    );
    expect(ramoPadrao![0]).toContain("style={cores}");
    expect(ramoPadrao![0]).not.toMatch(/minHeight|minWidth|margin/);
  });

  it("ligada, o botão mede no mínimo 44×44 e a pílula visível fica num <span> com a altura de sempre", () => {
    expect(sc).toContain("const ALVO_MINIMO = 44;");
    expect(sc).toContain(
      "const ALTURA_VISUAL = { md: 32, sm: 24.5 } as const;"
    );
    expect(sc).toContain("minHeight: `${ALVO_MINIMO}px`,");
    expect(sc).toContain("minWidth: `${ALVO_MINIMO}px`,");
    expect(sc).toMatch(
      /<span\s+data-pilula\s+className=\{`w-full transition-all \$\{forma\}`\}\s+style=\{cores\}/
    );
  });

  it("ligada, a margem negativa devolve a sobra ao layout (o trilho não cresce)", () => {
    expect(sc).toContain(
      "const sobra = (ALVO_MINIMO - ALTURA_VISUAL[size]) / 2;"
    );
    expect(sc).toContain("marginBlock: `-${sobra}px`,");
  });
});

describe("#174 — ligada só no seletor do Financeiro", () => {
  for (const arquivo of FINANCEIRO) {
    it(`${arquivo} liga minTouchTarget`, () => {
      const tags = usos.filter((u) => u.arquivo === arquivo);
      expect(tags).toHaveLength(1);
      expect(tags[0].tag).toMatch(/\sminTouchTarget\s/);
    });
  }

  it("nenhum outro uso do SegmentedControl liga a opção (Ajustes, Agenda, Meu espaço, Amigas ficam iguais)", () => {
    const outros = usos.filter((u) => !FINANCEIRO.includes(u.arquivo));
    // Os 5 usos conhecidos fora do Financeiro (o "Gráfico — Financeiro"
    // dos Ajustes saiu junto com os palitos).
    expect(outros.map((u) => u.arquivo).sort()).toEqual(
      [
        "components/ajustes/AjustesTab.tsx",
        "components/ajustes/AjustesTab.tsx",
        "components/jobs/AgendaResumoSheet.tsx",
        "components/rede/AmigasScreen.tsx",
        "components/rede/MeuEspacoScreen.tsx",
      ].sort()
    );
    for (const u of outros) {
      expect(u.tag, u.arquivo).not.toMatch(/minTouchTarget/);
    }
  });
});
