import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMockAppSeed } from "../../lib/mockAppData";
import { formatBRL, monthProjection } from "../../lib/finance";
import {
  atendimentosDepoisDaSemana,
  diasRestantesDaSemana,
  formatHora,
  proximoAtendimento,
  rotuloDiaCurto,
  rotuloDiaFrase,
} from "../../components/home/inicioAgenda";
import type { Job, Meta } from "../../lib/types";
import {
  celular,
  esperarEstilo,
  Mockup,
  read,
  TEMAS,
  tokensUsados,
  variaveisDoApp,
  variaveisDoMockup,
} from "./pixelMockup";

/**
 * Pixel do Início A (#206): trava a tela contra o PRÓPRIO mockup normativo
 * (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html), no mesmo
 * molde do pixel-financeiro.test.ts. Quatro partes:
 *
 *  1. Medidas: cada elemento do celular do Início no mockup é achado pelo
 *     texto (ou por um pedaço do estilo); o `style=""` dele é a lista
 *     esperada, e o componente tem de ter um objeto de estilo com todos os
 *     valores. A superfície dos cards (fundo e raio) mora no InicioCard; o
 *     resto (padding, gap, altura mínima) chega pelo `style` de cada card.
 *  2. Tokens: os 16 blocos --t-* do mockup = os do globals.css, e todo
 *     var(--t-*) que o Início usa existe no mockup.
 *  3. Dados: o laboratório, no dia do mockup (quarta 23/09/2026), produz o
 *     Próximo, os Objetivos e os Próximos atendimentos do mockup. As
 *     divergências (o conflito Agenda x Financeiro no mockup) ficam
 *     travadas dos dois lados.
 *  4. "Esta semana": de hoje até domingo, com "Dia livre" nos dias sem
 *     atendimento; as linhas do mockup estão todas lá, iguais.
 *
 * Teste de fiação: lê o fonte (o vitest daqui roda em node, sem JSX).
 */

const INI = celular("inicio");
const M = Mockup(INI);

const H = "components/home/";
const PAGINA = "app/page.tsx";
const LAB = "app/dev-preview/app/page.tsx";
const SAUDACAO = `${H}GreetingHeader.tsx`;
const HERO = `${H}HeroCard.tsx`;
const CARD = `${H}InicioCard.tsx`;
const PECAS = `${H}pecasMockup.tsx`;
const PROXIMO = `${H}NextJobCard.tsx`;
const OBJETIVOS = `${H}ObjetivosCard.tsx`;
const FALTA = `${H}FaltaMetaCard.tsx`;
const COFRE = `${H}CofreCard.tsx`;
const SEMANA = `${H}SemanaSection.tsx`;
const PROXIMOS = `${H}ProximosAtendimentos.tsx`;
const LINK = "components/ui/LinkSecao.tsx";

/** Fundo e raio vêm do InicioCard (testados à parte). */
const SUPERFICIE = ["background", "borderRadius", "color"];

describe("Pixel Início A — medidas iguais às do mockup", () => {
  // [descrição, como achar no mockup, arquivos do app, props fora do teste]
  const CASOS: [string, () => Record<string, string>, string[], string[]?][] = [
    [
      "linha do cabeçalho",
      () => M.doPai('<div style="width: 42px'),
      [SAUDACAO],
    ],
    ['saudação "Olá, Miguel"', () => M.doTexto("Olá, Miguel"), [SAUDACAO]],
    [
      "data do cabeçalho",
      () => M.doTexto("Quarta, 23 de setembro"),
      [SAUDACAO],
    ],
    // O card principal: grid-column vem da grade (col-span-2 em page.tsx).
    [
      "card principal",
      () => M.doConteiner("grid-column: span 2"),
      [HERO],
      [...SUPERFICIE, "gridColumn"],
    ],
    [
      "linha de cima do card principal",
      () => M.doPai('<span style="font-size: 12px; font-weight: 600'),
      [HERO],
    ],
    ['rótulo "Faturamento"', () => M.doTexto("Faturamento · setembro"), [HERO]],
    ['pílula "% da meta"', () => M.doTexto("12% da meta"), [HERO]],
    ["linha do valor", () => M.doConteiner("align-items: baseline"), [HERO]],
    ["valor do mês (36px)", () => M.doTexto("R$ 430"), [HERO]],
    ['"de R$ 3.500"', () => M.doTexto("de R$ 3.500"), [HERO]],
    [
      "trilho da barra",
      () =>
        M.doConteiner(
          "height: 8px; border-radius: 4px; background: var(--t-soft)"
        ),
      [HERO],
    ],
    // A largura é dado (o percentual da meta).
    [
      "preenchimento da barra",
      () => M.doConteiner("height: 8px; background: var(--t-acc)"),
      [HERO],
      ["width"],
    ],
    ["linha de projeção", () => M.doTexto("No seu ritmo"), [HERO]],
    [
      'card "Próximo"',
      () => M.doConteiner("min-height: 118px"),
      [PROXIMO, PECAS],
      SUPERFICIE,
    ],
    ["rótulo dos cards pequenos", () => M.doTexto("Próximo"), [PROXIMO, PECAS]],
    [
      "valor dos cards pequenos (20px)",
      () => M.doTexto("14h00"),
      [PROXIMO, PECAS],
    ],
    ['"Renata · sex 25"', () => M.doTexto("Renata · sex 25"), [PROXIMO]],
    [
      'card "Objetivos"',
      () => M.queTermina("flex-direction: column; gap: 8px"),
      [OBJETIVOS, PECAS],
      SUPERFICIE,
    ],
    ['rótulo "Objetivos"', () => M.doTexto("Objetivos"), [OBJETIVOS, PECAS]],
    ['valor "1 de 4"', () => M.doTexto("1 de 4"), [OBJETIVOS, PECAS]],
    // As colunas são dado (uma por objetivo).
    [
      "traços dos objetivos",
      () => M.doConteiner("repeat(4, minmax(0, 1fr)); gap: 4px"),
      [OBJETIVOS],
      ["gridTemplateColumns"],
    ],
    [
      "traço aceso",
      () =>
        M.doConteiner(
          "height: 5px; border-radius: 3px; background: var(--t-acc)"
        ),
      [OBJETIVOS],
    ],
    [
      "traço apagado",
      () =>
        M.doConteiner(
          "height: 5px; border-radius: 3px; background: var(--t-line)"
        ),
      [OBJETIVOS],
    ],
    [
      'card "Falta pra meta"',
      () => M.queTermina("flex-direction: column; gap: 8px"),
      [FALTA, PECAS],
      SUPERFICIE,
    ],
    [
      'rótulo "Falta pra meta"',
      () => M.doTexto("Falta pra meta"),
      [FALTA, PECAS],
    ],
    ['valor "Falta pra meta"', () => M.doTexto("R$ 3.070"), [FALTA, PECAS]],
    [
      'card "Cofre"',
      () => M.doConteiner("background:var(--t-hero)"),
      [COFRE, PECAS],
      SUPERFICIE,
    ],
    ['rótulo "Cofre"', () => M.doTexto("Cofre"), [COFRE, PECAS]],
    ['"Protegido"', () => M.doTexto("Protegido"), [COFRE]],
    [
      'cabeçalho de "Esta semana"',
      () => M.doConteiner("align-items: center; margin-top: 8px"),
      [SEMANA],
    ],
    ['título "Esta semana"', () => M.doTexto("Esta semana"), [SEMANA]],
    // O link é um <a> no mockup; no app, um botão (sem sublinhado nativo).
    [
      'link "Agenda ›"',
      () => M.doTexto("Agenda ›"),
      [LINK],
      ["textDecoration"],
    ],
    [
      'card de "Esta semana"',
      () => M.doConteiner("padding: 6px 16px"),
      [SEMANA],
      SUPERFICIE,
    ],
    // A borda vem do divisor (só entre linhas), testada à parte.
    [
      'linha de "Esta semana"',
      () => M.doConteiner("gap: 12px; padding: 12px 0; border-bottom"),
      [SEMANA],
      ["borderBottom"],
    ],
    ['dia ("SEX 25")', () => M.doTexto("SEX 25"), [SEMANA]],
    ['nome em "Esta semana"', () => M.doTexto("Renata Ferreira"), [SEMANA]],
    [
      'hora e local em "Esta semana"',
      () => M.doTexto("14h00 · Studio Miguel"),
      [SEMANA],
    ],
    ['valor em "Esta semana"', () => M.doTexto("R$ 180"), [SEMANA]],
    ['"Dia livre"', () => M.doTexto("Dia livre"), [SEMANA]],
    [
      'título "Próximos atendimentos"',
      () => M.doTexto("Próximos atendimentos"),
      [PROXIMOS],
    ],
    [
      'card de "Próximos atendimentos"',
      () => M.doConteiner("border-radius:20px;padding:4px 16px"),
      [PROXIMOS],
      SUPERFICIE,
    ],
    [
      'linha de "Próximos atendimentos"',
      () => M.doConteiner("gap:12px;padding:12px 0"),
      [PROXIMOS],
      ["borderBottom"],
    ],
    [
      "avatar da lista",
      () => M.doConteiner("width:40px;height:40px;border-radius:12px"),
      [PROXIMOS],
    ],
    ["nome da lista", () => M.doTexto("Juliana Prado"), [PROXIMOS]],
    ["data da lista", () => M.doTexto("Seg 28 · 09h00"), [PROXIMOS]],
    ["valor da lista", () => M.doTexto("R$ 150"), [PROXIMOS]],
  ];

  for (const [descricao, mockup, arquivos, ignorar] of CASOS) {
    it(descricao, () => esperarEstilo(arquivos, mockup(), descricao, ignorar));
  }

  it("superfície dos cards: --t-card (raio 20) e o Cofre em --t-hero com texto branco", () => {
    const card = M.doConteiner("min-height: 118px");
    const cofre = M.doConteiner("background:var(--t-hero)");
    const src = read(CARD);
    expect(src).toContain(`borderRadius: "${card.borderRadius}",`);
    expect(cofre.borderRadius).toBe(card.borderRadius);
    expect(src).toContain(
      `background: tom === "cofre" ? "${cofre.background}" : "${card.background}",`
    );
    expect(src).toContain(
      `color: tom === "cofre" ? "${cofre.color}" : "var(--t-ink)",`
    );
    expect(read(COFRE)).toContain('<InicioCard tom="cofre"');
  });

  it("coluna: o gap do mockup, e o espaço até a grade = gap + margin-top da grade", () => {
    const coluna = M.doConteiner("padding: 24px 16px 120px");
    const grade = M.doConteiner(
      "display: grid; grid-template-columns: repeat(2"
    );
    const espaco = parseInt(coluna.gap) + parseInt(grade.marginTop);
    for (const pagina of [PAGINA, LAB])
      expect(read(pagina), pagina).toMatch(
        new RegExp(
          `className="grid grid-cols-\\[minmax\\(0,1fr\\)\\]"\\s+style=\\{\\{ gap: "${coluna.gap}", marginTop: "${espaco}px" \\}\\}`
        )
      );
  });

  it("grade dos cards: 2 colunas com o gap do mockup; o card principal ocupa as duas", () => {
    const grade = M.doConteiner(
      "display: grid; grid-template-columns: repeat(2"
    );
    expect(grade.gridTemplateColumns).toBe("repeat(2,minmax(0,1fr))");
    expect(M.doConteiner("grid-column: span 2").gridColumn).toBe("span2");
    for (const pagina of [PAGINA, LAB]) {
      const src = read(pagina);
      expect(src, pagina).toContain(
        `<div className="grid grid-cols-2 gap-[${grade.gap}]`
      );
      expect(src, pagina).toMatch(
        /<div className="col-span-2 flex flex-col gap-\[10px\]">\s*\{\/\*[\s\S]*?\*\/\}\s*<div data-tour="home-hero">\s*<HeroCard/
      );
    }
  });

  it("ícones dos cards pequenos: cor e traço do mockup", () => {
    const pecas = read(PECAS);
    // Os três primeiros em --t-deep (padrão do IconeCard); o Cofre na cor
    // do texto (branco sobre --t-hero).
    expect(pecas).toContain('cor = "var(--t-deep)",');
    expect(pecas).toContain("stroke={cor}");
    const svgs = [
      ...INI.matchAll(
        /<svg width="20"[^>]*stroke="([^"]+)"[^>]*>([\s\S]*?)<\/svg>/g
      ),
    ];
    const cartoes: [string, string, string][] = [
      ["Próximo", PROXIMO, "var(--t-deep)"],
      ["Objetivos", OBJETIVOS, "var(--t-deep)"],
      ["Falta pra meta", FALTA, "var(--t-deep)"],
      ["Cofre", COFRE, "currentColor"],
    ];
    expect(svgs).toHaveLength(cartoes.length);
    cartoes.forEach(([rotulo, arquivo, cor], i) => {
      const [, stroke, corpo] = svgs[i];
      expect(stroke, rotulo).toBe(cor);
      const src = read(arquivo);
      if (cor === "currentColor")
        expect(src, rotulo).toContain('<IconeCard cor="currentColor">');
      else expect(src, rotulo).toMatch(/<IconeCard>/);
      for (const el of corpo.matchAll(/<(path|circle) ([^>]*?)\s*\/?>/g)) {
        const attrs = [...el[2].matchAll(/(\w+)="([^"]+)"/g)]
          .map((a) => `${a[1]}="${a[2]}"`)
          .join(" ");
        expect(src, `${rotulo}: <${el[1]} ${attrs}>`).toContain(
          `<${el[1]} ${attrs} />`
        );
      }
    });
  });

  it("divisor entre linhas: a borda do mockup, só entre linhas (a última sem)", () => {
    const borda = M.doConteiner(
      "gap: 12px; padding: 12px 0; border-bottom"
    ).borderBottom;
    expect(borda).toBe("1pxsolidvar(--t-line)");
    expect(read(SEMANA)).toContain(
      'const BORDA = { borderBottom: "1px solid var(--t-line)" } as const;'
    );
    expect(read(SEMANA)).toContain(
      "const borda = i < dias.length - 1 ? BORDA : undefined;"
    );
    expect(read(PROXIMOS)).toMatch(
      /i < proximos\.length - 1\s*\?\s*\{ borderBottom: "1px solid var\(--t-line\)" \}/
    );
  });

  it("cabeçalho: avatar e Novo são as peças da casca (desenho do mockup, toque de 44px)", () => {
    const avatar = M.doConteiner("width: 42px; height: 42px");
    const novo = M.doTexto("Novo");
    const pecas = read("components/ui/cabecalho.tsx");
    expect(pecas).toContain(`width: "${avatar.width}",`);
    expect(pecas).toContain(`height: "${novo.height}",`);
    expect(pecas).toContain(`fontSize: "${novo.fontSize}",`);
    expect(pecas).toContain(
      'style={{ width: "44px", height: "44px", margin: "-1px" }}'
    );
    expect(pecas).toContain('style={{ minHeight: "44px", margin: "-3px 0" }}');
    const src = read(SAUDACAO);
    expect(src).toContain(
      'import { AvatarAjustes, BotaoNovo } from "@/components/ui/cabecalho";'
    );
    expect(src).toContain("<BotaoNovo onClick={onNovo}>Novo</BotaoNovo>");
  });

  it('"Agenda ›": desenho do mockup com toque de 44×44, sem crescer a linha', () => {
    const link = read(LINK);
    expect(link).toContain("const ALVO_MINIMO = 44;");
    expect(link).toContain(
      "margin: `-${(ALVO_MINIMO - ALTURA_TEXTO) / 2}px 0`,"
    );
    expect(read(SEMANA)).toContain(
      "<LinkSecao onClick={onGoToAgenda}>Agenda ›</LinkSecao>"
    );
  });
});

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

describe("Pixel Início A — tokens --t-* = os do mockup", () => {
  for (const tema of TEMAS)
    for (const modo of ["light", "dark"] as const) {
      it(`${tema} ${modo === "light" ? "claro" : "escuro"}`, () => {
        const esperado = variaveisDoMockup(tema, modo);
        expect(esperado, "bloco do mockup").not.toBeNull();
        expect(variaveisDoApp(tema, modo)).toEqual(esperado);
      });
    }

  it("todo var(--t-*) que o Início usa existe no mockup", () => {
    const definidos = Object.keys(variaveisDoMockup("pink-neon", "light")!);
    const arquivos = [
      SAUDACAO,
      HERO,
      CARD,
      PECAS,
      PROXIMO,
      OBJETIVOS,
      FALTA,
      COFRE,
      SEMANA,
      PROXIMOS,
      LINK,
    ];
    const usados = tokensUsados(arquivos.map(read).join("\n"));
    expect(usados.length).toBeGreaterThan(8);
    for (const t of usados) expect(definidos, t).toContain(t);
  });
});

// ---------------------------------------------------------------------------
// Dados e "Esta semana"
// ---------------------------------------------------------------------------

describe("Pixel Início A — dados do laboratório = os do mockup", () => {
  afterEach(() => vi.useRealTimers());

  const AGORA = new Date(2026, 8, 23, 10, 0); // quarta 23/09/2026 10h

  /** Mesmo mapeamento de linha -> tipo do app. */
  function seed() {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    const t = buildMockAppSeed().tables as Record<
      string,
      Record<string, unknown>[]
    >;
    const jobs = t.jobs.map((r) => ({
      id: r.id,
      clienteNome: r.cliente_nome,
      data: r.data,
      hora: r.hora,
      valor: r.valor,
      modalidade: r.modalidade,
      local: r.local ?? undefined,
      status: r.status,
    })) as unknown as Job[];
    const metas = t.metas.map((r) => ({
      periodo: r.periodo,
      valorAlvo: r.valor_alvo,
    })) as unknown as Meta[];
    const objetivos = t.objetivos as { concluido: boolean }[];
    return { jobs, metas, objetivos };
  }
  const brl = (n: number) => formatBRL(n).replace(/ /g, " ");
  const texto = (re: RegExp) => {
    const m = INI.match(re);
    if (!m) throw new Error(`${re} não está no mockup`);
    return m[1];
  };

  it('Próximo: hora e "<primeiro nome> · <dia>" do mockup', () => {
    const { jobs } = seed();
    const p = proximoAtendimento(jobs, AGORA)!;
    expect(formatHora(p.hora)).toBe(
      texto(
        /font-weight: 800">([^<]+)<\/span>\s*<span style="font-size: 12px">/
      )
    );
    expect(
      `${p.clienteNome.split(" ")[0]} · ${rotuloDiaCurto(p.data).toLowerCase()}`
    ).toBe(texto(/<span style="font-size: 12px">([^<]+)</));
  });

  it('Objetivos: "N de M" e os N primeiros traços acesos', () => {
    const { objetivos } = seed();
    const feitos = objetivos.filter((o) => o.concluido).length;
    expect(`${feitos} de ${objetivos.length}`).toBe(texto(/>(\d+ de \d+)</));
    const tracos = [
      ...INI.matchAll(
        /height: 5px; border-radius: 3px; background: (var\(--t-[\w-]+\))/g
      ),
    ].map((m) => m[1]);
    expect(tracos).toEqual(
      objetivos.map((_, i) => (i < feitos ? "var(--t-acc)" : "var(--t-line)"))
    );
  });

  it("Próximos atendimentos: as 6 linhas do mockup (inicial, nome, dia · hora, valor), na ordem", () => {
    const { jobs } = seed();
    const i = INI.indexOf(">Próximos atendimentos</h2>");
    const mock = [
      ...INI.slice(i).matchAll(
        /font-weight:800">(\w)<\/span><div style="flex-grow:1"><div style="font-size:14px;font-weight:700">([^<]+)<\/div><div style="font-size:11px;color:var\(--t-mut\)">([^<]+)<\/div><\/div><span[^>]*>([^<]+)</g
      ),
    ].map((m) => [m[1], m[2], m[3], m[4]]);
    expect(mock).toHaveLength(6);
    const app = atendimentosDepoisDaSemana(jobs, AGORA).map((j) => [
      j.clienteNome.charAt(0).toUpperCase(),
      j.clienteNome,
      `${rotuloDiaFrase(j.data)} · ${formatHora(j.hora)}`,
      brl(j.valor),
    ]);
    expect(app).toEqual(mock);
    expect(read(PROXIMOS)).toContain(
      "{rotuloDiaFrase(job.data)} · {formatHora(job.hora)}"
    );
  });

  /**
   * O laboratório tem o faturamento do mockup (R$ 430): Helena Brito, de
   * 13/09, vale R$ 310, e Camila Duarte continua em 20/09 por R$ 120 (o
   * mockup da Agenda). Daí saem a % da meta, a projeção e o que falta.
   */
  it("iguais ao mockup: faturamento, % da meta, projeção e falta pra meta", () => {
    const { jobs, metas } = seed();
    const p = monthProjection(jobs, metas);
    const eta = p.metaEta!.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
    });
    expect([
      [texto(/letter-spacing: -1px">([^<]+)</), brl(p.earned)],
      [texto(/>(\d+% da meta)</), `${Math.round(p.pct!)}% da meta`],
      [texto(/>No seu ritmo, você chega lá até ([^.]+)\./), eta],
      [
        texto(/>Falta pra meta<\/span>\s*<span[^>]*>([^<]+)</),
        brl(p.remaining!),
      ],
    ]).toEqual([
      ["R$ 430", "R$ 430"],
      ["12% da meta", "12% da meta"],
      ["7 de março", "7 de março"],
      ["R$ 3.070", "R$ 3.070"],
    ]);
    // A meta é a mesma dos dois lados.
    expect(texto(/>de ([^<]+)</)).toBe(brl(p.meta!));
  });
});

describe('Pixel Início A — "Esta semana" como o mockup', () => {
  afterEach(() => vi.useRealTimers());
  const AGORA = new Date(2026, 8, 23, 10, 0);

  /** As linhas do mockup: [dia, nome ou "Dia livre", "hora · local", valor]. */
  function linhasDoMockup(): string[][] {
    const i = INI.indexOf(">Esta semana</h2>");
    const fim = INI.indexOf(">Próximos atendimentos</h2>");
    const trecho = INI.slice(i, fim);
    return [
      ...trecho.matchAll(
        /color: var\(--t-mut\)">([A-ZÁÉÍÓÚÇ]{3} \d{2})<\/span>\s*(?:<div style="flex-grow: 1"><div[^>]*>([^<]+)<\/div><div[^>]*>([^<]+)<\/div><\/div>\s*<span[^>]*>([^<]+)<\/span>|<div[^>]*>(Dia livre)<\/div>)/g
      ),
    ].map((m) => (m[5] ? [m[1], m[5]] : [m[1], m[2], m[3], m[4]]));
  }

  function linhasDoApp(): string[][] {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    const t = buildMockAppSeed().tables as Record<
      string,
      Record<string, unknown>[]
    >;
    const jobs = t.jobs.map((r) => ({
      id: r.id,
      clienteNome: r.cliente_nome,
      data: r.data,
      hora: r.hora,
      valor: r.valor,
      modalidade: r.modalidade,
      local: r.local ?? undefined,
      status: r.status,
    })) as unknown as Job[];
    return diasRestantesDaSemana(jobs, AGORA).flatMap((d) =>
      d.jobs.length === 0
        ? [[rotuloDiaCurto(d.data), "Dia livre"]]
        : d.jobs.map((j) => [
            rotuloDiaCurto(d.data),
            j.clienteNome,
            `${formatHora(j.hora)} · ${j.local ?? "Presencial"}`,
            formatBRL(j.valor).replace(/ /g, " "),
          ])
    );
  }

  it("o mockup tem um dia com atendimento e um dia livre", () => {
    expect(linhasDoMockup()).toEqual([
      ["SEX 25", "Renata Ferreira", "14h00 · Studio Miguel", "R$ 180"],
      ["SÁB 26", "Dia livre"],
    ]);
  });

  it("toda linha do mockup está no app, igual e na mesma ordem", () => {
    const app = linhasDoApp();
    const posicoes = linhasDoMockup().map((l) =>
      app.findIndex((a) => JSON.stringify(a) === JSON.stringify(l))
    );
    expect(posicoes.every((p) => p >= 0)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });

  it('de hoje até domingo: os dias a mais do app (fora do recorte do mockup) são só "Dia livre"', () => {
    const app = linhasDoApp();
    expect(app.map((l) => l[0])).toEqual([
      "QUA 23",
      "QUI 24",
      "SEX 25",
      "SÁB 26",
      "DOM 27",
    ]);
    const doMockup = new Set(linhasDoMockup().map((l) => JSON.stringify(l)));
    for (const l of app.filter((a) => !doMockup.has(JSON.stringify(a))))
      expect(l[1], l[0]).toBe("Dia livre");
  });

  it('a seção usa a regra de antes (diasRestantesDaSemana) e mostra "Dia livre"', () => {
    const src = read(SEMANA);
    expect(src).toContain("const dias = diasRestantesDaSemana(jobs);");
    expect(src).toMatch(
      /if \(dia\.jobs\.length === 0\) \{[\s\S]{0,400}Dia livre/
    );
    // O rótulo do dia é o do mockup ("SEX 25").
    expect(rotuloDiaCurto("2026-09-25")).toBe(linhasDoMockup()[0][0]);
  });
});
