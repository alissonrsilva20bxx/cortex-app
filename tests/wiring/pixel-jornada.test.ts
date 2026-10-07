import { describe, expect, it } from "vitest";
import { estadoJornadaExemplo } from "../../lib/mockJornada";
import {
  DESCRICAO_PILAR,
  NOTA,
  RECAP,
  itensDoEstagio,
  rotuloEstagio,
} from "../../lib/jornada/textos";
import { TRACOS } from "../../components/jornada/tracos";
import { TEMAS, read, variaveisDoApp } from "./pixelMockup";

/**
 * Pixel da "Sua Jornada": a tela, os resumos e as comemorações contra o
 * PRÓPRIO protótipo aprovado (docs/jornada/referencias/
 * prototipo-sua-jornada.html), não contra números copiados pra cá.
 *
 *  1. Cores: roda o `tokens()` do protótipo (o gerador dos 8 temas) e
 *     compara com os --t-* do app em cada tema e modo.
 *  2. Ícones: cada traço do `var P` do protótipo = o do IconeJornada.
 *  3. CSS: cada regra do jornada.module.css que existe no protótipo tem as
 *     MESMAS declarações (só o escopo e os ids viram classes).
 *  4. Textos: as frases da tela e dos resumos são as do protótipo.
 *  5. Dados: o laboratório (lib/mockJornada.ts) é a foto "Agora" do
 *     protótipo (`fresh()`).
 *  6. Ordem: as seções da tela na ordem do `journeyHTML`, menos as que o
 *     app não tem dado pra mostrar (listadas na PR).
 */

const PROTO = read("docs/jornada/referencias/prototipo-sua-jornada.html");
const JS = PROTO.slice(PROTO.indexOf("<script>"));
const CSS_PROTO = PROTO.slice(
  PROTO.indexOf("<style>") + 7,
  PROTO.indexOf("</style>")
);
const MODULO = read("components/jornada/jornada.module.css");

// ---------------------------------------------------------------------------
// 1. Cores
// ---------------------------------------------------------------------------

/** O gerador de temas do protótipo, executado como ele é (funções puras). */
function tokensDoPrototipo(): (
  tema: string,
  modo: string
) => Record<string, string> {
  const ini = JS.indexOf("var THEMES");
  const fim = JS.indexOf("/* ---------------- idioma");
  const codigo = JS.slice(ini, fim);
  const fabrica = new Function(
    `${codigo}; return function (tema, modo) {
      var t = THEMES.filter(function (x) { return x[0] === tema; })[0];
      return tokens(t[2], t[3], t[4], t[5], t[6], modo);
    };`
  ) as () => (tema: string, modo: string) => Record<string, string>;
  return fabrica();
}

/** Os --t-* que o jornada.module.css sobrepõe por tema e modo. */
function sobreposicoes(
  tema: string,
  modo: "light" | "dark"
): Record<string, string> {
  const sel =
    modo === "light"
      ? `:global([data-mode="light"][data-theme="${tema}"]) .raiz`
      : `:global([data-theme="${tema}"]:not([data-mode="light"])) .raiz`;
  const i = MODULO.indexOf(`${sel} {`);
  if (i === -1) return {};
  const corpo = MODULO.slice(i + sel.length + 2, MODULO.indexOf("}", i));
  return Object.fromEntries(
    [...corpo.matchAll(/(--t-[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].replace(/\s+/g, ""),
    ])
  );
}

describe("Pixel Jornada — cores: os --t-* da tela = o tokens() do protótipo", () => {
  it("a tela sobrepõe só os 3 valores em que o protótipo e o mockup das 5 telas divergem", () => {
    const todas = TEMAS.flatMap((t) =>
      (["light", "dark"] as const).flatMap((m) =>
        Object.keys(sobreposicoes(t, m)).map((k) => `${t} ${m} ${k}`)
      )
    );
    expect(todas.sort()).toEqual([
      "crimson dark --t-line",
      "emerald light --t-soft",
      "purple dark --t-hero",
    ]);
  });

  const gerar = tokensDoPrototipo();
  for (const tema of TEMAS)
    for (const modo of ["light", "dark"] as const) {
      it(`${tema} ${modo === "light" ? "claro" : "escuro"}`, () => {
        const proto = gerar(tema, modo);
        // Os --t-* do globals.css (mockup das 5 telas) + o que a tela da
        // Jornada sobrepõe pra valer o protótipo (jornada.module.css).
        const app = {
          ...variaveisDoApp(tema, modo),
          ...sobreposicoes(tema, modo),
        };
        expect(app, "bloco --t-* no globals.css").not.toBeNull();
        expect(Object.keys(proto).length).toBeGreaterThan(20);
        for (const [k, v] of Object.entries(proto))
          expect(app![`--t-${k}`], `--t-${k}`).toBe(v.replace(/\s+/g, ""));
      });
    }
});

// ---------------------------------------------------------------------------
// 2. Ícones
// ---------------------------------------------------------------------------

describe("Pixel Jornada — ícones: os traços do protótipo", () => {
  const corpo = JS.slice(
    JS.indexOf("var P = {") + 9,
    JS.indexOf("};", JS.indexOf("var P = {"))
  );
  const doProto = Object.fromEntries(
    [...corpo.matchAll(/(\w+):'([^']*)'/g)].map((m) => [m[1], m[2]])
  );

  it("o mesmo conjunto de ícones", () => {
    expect(Object.keys(TRACOS).sort()).toEqual(Object.keys(doProto).sort());
  });

  it("cada traço igual, caractere por caractere", () => {
    for (const [nome, traco] of Object.entries(doProto))
      expect(TRACOS[nome as keyof typeof TRACOS], nome).toBe(traco);
  });

  it("ic() e icf(): mesmo viewBox, traço redondo, preenchido = currentColor", () => {
    const src = read("components/jornada/IconeJornada.tsx");
    expect(JS).toContain('viewBox="0 0 24 24" fill="none" stroke="');
    expect(src).toMatch(/viewBox="0 0 24 24"\s+fill="none"\s+stroke=\{c\}/);
    expect(src).toMatch(/strokeLinecap="round"\s+strokeLinejoin="round"/);
    expect(JS).toContain('viewBox="0 0 24 24" fill="currentColor"');
    expect(src).toMatch(/viewBox="0 0 24 24"\s+fill="currentColor"/);
  });
});

// ---------------------------------------------------------------------------
// 3. CSS
// ---------------------------------------------------------------------------

/** Regras CSS de um texto: seletor normalizado -> declarações. */
function regras(css: string): Map<string, string[]> {
  const sem = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = new Map<string, string[]>();
  // Só regras de primeiro nível (os @keyframes entram pelo nome abaixo).
  let i = 0;
  while (i < sem.length) {
    const abre = sem.indexOf("{", i);
    if (abre === -1) break;
    const seletor = sem.slice(i, abre).trim();
    let nivel = 1;
    let j = abre + 1;
    while (j < sem.length && nivel > 0) {
      if (sem[j] === "{") nivel++;
      else if (sem[j] === "}") nivel--;
      j++;
    }
    const corpo = sem.slice(abre + 1, j - 1);
    if (!seletor.startsWith("@"))
      out.set(normSeletor(seletor), declaracoes(corpo));
    else if (seletor.startsWith("@keyframes"))
      out.set(seletor.replace(/\s+/g, " "), [
        corpo
          .replace(/\s+/g, "")
          .replace(/(?<![\d])0\./g, ".")
          .replace(/;\}/g, "}"),
      ]);
    i = j;
  }
  return out;
}
const normSeletor = (s: string) =>
  s
    .replace(/#ovBadge/g, ".ovSelo")
    .replace(/#ovStage/g, ".ovEstagio")
    .replace(/#ovRecap/g, ".ovRecap")
    .replace(/#fx\b/g, ".fx")
    .replace(/\s*([>,+~])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
function declaracoes(corpo: string): string[] {
  return corpo
    .split(";")
    .map((d) =>
      d
        .replace(/\s+/g, "")
        .replace(/(?<![\d.])0\.(\d)/g, ".$1")
        .replace(/'/g, '"')
        .toLowerCase()
    )
    .filter(Boolean)
    .sort();
}

describe("Pixel Jornada — CSS: as regras do protótipo, sem tirar nem pôr", () => {
  const proto = regras(CSS_PROTO);
  const app = regras(MODULO);
  // Do app, sem par no protótipo: o escopo (.raiz faz o papel do .ph), o
  // toque de 44px e o seletor do switch (no protótipo é `input.sw`).
  // `.palco` é a área fixa onde folhas e comemorações moram no app (no
  // protótipo, o próprio celular).
  const SO_DO_APP = [
    /^\.raiz/,
    /^:global\(.*\)\s*\.raiz$/,
    /^\.toque$/,
    /^\.sw/,
    /^\.palco$/,
    // O style inline do #sOk (conferido abaixo).
    /^\.sOk$/,
    // Toque de 44px do "Fazer" e do Completa/Calma (área invisível).
    /^\.st \.go,\.psel button$/,
    /^\.st \.go::after,\.psel button::after$/,
  ];
  const PAR_NO_PROTOTIPO: Record<string, string> = {
    ".pad": ".pad",
    ".sw": "input.sw",
    ".sw::after": "input.sw::after",
    ".sw:checked": ".sr input.sw:checked",
    ".sw:checked::after": "input.sw:checked::after",
    // O escuro do protótipo é o `data-md=dark` do celular; no app, o tema
    // sem `data-mode="light"`.
    ':global(:root:not([data-mode="light"])) .dot:not(.strong):not(.rest):not(.today)':
      ".ph[data-md=dark] .dot:not(.strong):not(.rest):not(.today)",
  };

  it("o módulo tem as regras de tela, folha, resumo e comemorações", () => {
    expect(app.size).toBeGreaterThan(120);
  });

  for (const [seletor, decl] of app) {
    if (seletor.startsWith("@keyframes")) continue;
    it(`${seletor}`, () => {
      const par = PAR_NO_PROTOTIPO[seletor] ?? seletor;
      if (seletor === ".pad") {
        // O protótipo põe padding-top:20px inline no #journey.
        expect(decl).toContain("padding:20px16px124px");
        return;
      }
      if (!proto.has(par)) {
        expect(
          SO_DO_APP.some((r) => r.test(seletor)),
          `${seletor} não existe no protótipo`
        ).toBe(true);
        return;
      }
      expect(decl, seletor).toEqual(proto.get(par)!);
    });
  }

  it(".sOk = o style inline do #sOk do protótipo", () => {
    expect(PROTO).toContain(
      'id="sOk" style="background:#fff!important;color:#111114!important"'
    );
    expect(app.get(".sOk")).toEqual(
      declaracoes("background:#fff!important;color:#111114!important")
    );
  });

  it("os @keyframes usados pela Jornada são os do protótipo", () => {
    for (const [nome, corpo] of app)
      if (nome.startsWith("@keyframes")) {
        expect(proto.get(nome), nome).toEqual(corpo);
      }
  });
});

// ---------------------------------------------------------------------------
// 4. Textos
// ---------------------------------------------------------------------------

describe("Pixel Jornada — textos: as frases do protótipo", () => {
  it("as notas, com o mesmo trecho em negrito", () => {
    for (const [antes, negrito, depois] of Object.values(NOTA))
      expect(JS, negrito).toContain(`${antes}<b>${negrito}</b>${depois}`);
  });

  it("a linha de apoio de cada pilar", () => {
    for (const d of Object.values(DESCRICAO_PILAR))
      expect(JS).toContain(`'${d}'`);
  });

  it('"Destrava em": os itens de cada estágio, na ordem (moldura, tema, ícone)', () => {
    const tipo = { frame: "moldura", theme: "tema", icon: "icone" } as const;
    for (const n of [1, 2, 3, 4]) {
      const m = JS.match(new RegExp(`\\b${n}:\\[(\\[[^\\n]*?\\])\\]`))!;
      const doProto = [
        ...m[1].matchAll(/\['(\w+)','([^']+)','([^']+)'\]/g),
      ].map((x) => ({
        tipo: tipo[x[1] as keyof typeof tipo],
        nome: x[2],
        descricao: x[3],
      }));
      expect(itensDoEstagio(n), `estágio ${n}`).toEqual(doProto);
    }
  });

  it("o rótulo do estágio: 'Estágio N de 5' e, da Icônica em diante, 'Icônica · nível N'", () => {
    expect(JS).toContain("'Icônica · nível ' + lv");
    expect(JS).toContain("'Estágio ' + (st + 1) + ' de 5'");
    expect(rotuloEstagio(1)).toBe("Estágio 2 de 5");
    expect(rotuloEstagio(3)).toBe("Estágio 4 de 5");
    expect(rotuloEstagio(4)).toBe("Icônica · nível 1");
    expect(rotuloEstagio(5)).toBe("Icônica · nível 2");
  });

  it("os resumos: cada frase fixa está no slides() do protótipo", () => {
    const slides = JS.slice(
      JS.indexOf("function slides()"),
      JS.indexOf("function showSlide")
    );
    const fixas = Object.entries(RECAP).filter(
      ([k, v]) =>
        typeof v === "string" &&
        // Trocas listadas na PR: o story do dinheiro conta as vezes que ela
        // guardou (a meta atual não está no estado da Jornada).
        !["futuro"].includes(k)
    );
    expect(fixas.length).toBeGreaterThan(25);
    for (const [k, v] of fixas)
      expect(slides + JS, `${k}: ${v}`).toContain(String(v));
  });
});

// ---------------------------------------------------------------------------
// 5. Dados do laboratório = a foto "Agora" do protótipo
// ---------------------------------------------------------------------------

describe('Pixel Jornada — laboratório = a foto "Agora" do protótipo', () => {
  const fresh = JS.slice(
    JS.indexOf("function fresh()"),
    JS.indexOf("S = fresh();")
  );
  const num = (re: RegExp) => Number(fresh.match(re)![1]);
  const AGORA = new Date(2026, 9, 2, 10, 0);
  const e = estadoJornadaExemplo(AGORA);

  it("o dia do protótipo é sexta, 02/10/2026", () => {
    expect(fresh).toContain("date:new Date(2026, 9, 2)");
    expect(e.hoje).toBe("2026-10-02");
  });

  it("Glow e estágio (Em movimento, 95 até Organizada)", () => {
    expect(e.glowTotal).toBe(num(/sparks:(\d+)/));
    expect(e.estagio).toBe(1);
    expect(e.glowProximoEstagio - e.glowTotal).toBe(95);
  });

  it("o capítulo de outubro: as 3 missões e o progresso do protótipo", () => {
    // Outubro = CH_SETS[9 % 3] = planejar 8, guardar em 3 semanas, 2 descansos.
    const ch = fresh.match(/ch:\{ plan:(\d+), saveWk:(\d+), rest:(\d+) \}/)!;
    expect(JS).toContain(
      "[['plan', 8, 'Planejar 8 dias'], ['saveWk', 3, 'Guardar dinheiro em 3 semanas'], ['rest', 2, 'Tirar 2 descansos']]"
    );
    expect(e.capitulo?.mes).toBe(10);
    expect(e.capitulo?.missoes).toEqual([
      { tipo: "planejar_dias", alvo: 8, progresso: Number(ch[1]) },
      { tipo: "guardar_semanas", alvo: 3, progresso: Number(ch[2]) },
      { tipo: "tirar_descansos", alvo: 2, progresso: Number(ch[3]) },
    ]);
  });

  it("coleção vazia e nenhum marco de dinheiro batido (orn:[], miles:{})", () => {
    expect(fresh).toContain("orn:[], missed:[]");
    expect(fresh).toContain("miles:{}");
    expect(e.colecao).toEqual([]);
    expect(e.marcos).toEqual([]);
  });

  it("selos: os níveis que o protótipo calcula do contador (Primeiros passos, Planejadora, Mão amiga)", () => {
    expect(fresh).toContain("first:1, planner:3, helper:14");
    expect(e.selos).toEqual({
      primeiros_passos: 1,
      planejadora: 1,
      mao_amiga: 1,
    });
  });

  it("Me ajudou / Me protegeu: 14 e 4", () => {
    expect(e.ajudou).toBe(num(/helper:(\d+)/));
    expect(e.protegeu).toBe(num(/safe:(\d+)/));
  });

  it("os contadores dos resumos: Glow e dias fortes da semana e do mês", () => {
    const sem = e.periodos.corrente.semana.contadores;
    const mes = e.periodos.corrente.mes.contadores;
    expect(sem.glow).toBe(num(/weekGain:(\d+)/));
    expect(sem.dias_fortes).toBe(2); // ['strong', 'rest', 'strong', …]
    expect(fresh).toContain(
      "week:['strong', 'rest', 'strong', null, null, null, null]"
    );
    expect(mes.glow).toBe(num(/monthGain:(\d+)/));
    expect(mes.dias_fortes).toBe(num(/monthStrong:(\d+)/));
  });
});

// ---------------------------------------------------------------------------
// 6. Ordem das seções
// ---------------------------------------------------------------------------

describe("Pixel Jornada — a ordem da tela é a do journeyHTML", () => {
  it("estágio, começo, ritmo, capítulo, coleção, dinheiro, pilares, selos, destrava, o que dá Glow, resumos", () => {
    const j = JS.slice(
      JS.indexOf("function journeyHTML()"),
      JS.indexOf("function redeHTML()")
    );
    const corpo = j.slice(j.indexOf("return '' +"));
    const ordemProto = [
      '<section class="hero">',
      "starter +",
      "<h3>Ritmo da semana</h3>",
      "chapterHTML()",
      "collectionHTML()",
      "moneyHTML()",
      "Seus 4 pilares",
      "<h3>Selos</h3>",
      "Destrava em",
      "<h3>O que dá Glow</h3>",
      "recap-btn",
    ].map((m) => corpo.indexOf(m));
    expect(
      ordemProto.every((p, i) => p > -1 && (i === 0 || p > ordemProto[i - 1]))
    ).toBe(true);
    const tela = read("components/jornada/JornadaScreen.tsx");
    const ordemApp = [
      "<JornadaEstagio",
      "<JornadaComeco",
      "<JornadaRitmo",
      "<JornadaCapitulo",
      "<JornadaColecao",
      "<JornadaDinheiro",
      "<JornadaPilares",
      "<JornadaSelos",
      "<JornadaDestrava",
      "<JornadaOQueDaGlow",
      "<BotoesDosResumos",
    ].map((m) => tela.indexOf(m));
    expect(
      ordemApp.every((p, i) => p > -1 && (i === 0 || p > ordemApp[i - 1]))
    ).toBe(true);
  });

  it("nada fica fora: cada peça do protótipo lê o dado do servidor (0036)", () => {
    const fonte: [string, RegExp][] = [
      ["JornadaRitmo", /marcasDaSemana\(estado\)/],
      ["JornadaDinheiro", /estado\.dinheiro/],
      ["JornadaPilares", /estado\.pilares\?\.\[pilar\]/],
      ["JornadaSelos", /estado\.selosProgresso/],
      ["JornadaOQueDaGlow", /const \{ glowPorAcao, premios \} = estado;/],
      ["JornadaComeco", /estado\.comeco\.passos/],
      ["JornadaAjustes", /estado\.preferencias/],
    ];
    for (const [peca, re] of fonte)
      expect(read(`components/jornada/${peca}.tsx`), peca).toMatch(re);
    expect(read("components/jornada/JornadaScreen.tsx")).toMatch(
      /premio=\{estado\.premios\?\.capitulo\}/
    );
    expect(read("components/jornada/progresso.ts")).toMatch(
      /return estado\.semana\?\.dias \?\?/
    );
  });
});

describe("Pixel Jornada — a barra de abas com a Jornada aberta (430)", () => {
  const MOCKUP = read(
    "docs/jornada/referencias/5-telas-8-temas-claro-escuro.html"
  );
  const NAV = read("components/BottomNav.tsx");
  const ESTILO = read("lib/bottomNavCompactStyle.ts");
  const num = (nome: string) =>
    Number(ESTILO.match(new RegExp(`export const ${nome} = (\\d+);`))![1]);

  it("o protótipo da Jornada estica a pílula; o mockup das 5 telas a fixa em 288", () => {
    expect(CSS_PROTO).toMatch(
      /\.bar\{position:absolute;bottom:22px;left:16px;right:16px;/
    );
    expect(CSS_PROTO).toMatch(/\.bar \.pill\{[^}]*width:calc\(100% - 70px\)/);
    expect(CSS_PROTO).toMatch(/\.bar \.plus\{[^}]*width:60px;height:60px/);
    expect(MOCKUP).toMatch(/\.b2 \.pill \{[^}]*width:288px/);
  });

  it('com a Jornada aberta, a pílula = a linha menos o "+" (16+16+60+10 = 102); em 390 dá os 288 do mockup', () => {
    const tira =
      num("BOTTOM_NAV_EDGE") * 2 +
      num("BOTTOM_NAV_FAB_SIZE") +
      num("BOTTOM_NAV_GAP");
    // calc(100% - 70px) dentro de uma linha com 16px de cada lado.
    expect(tira).toBe(16 * 2 + 70);
    expect(390 - tira).toBe(num("BOTTOM_NAV_PILL_WIDTH"));
    expect(NAV).toMatch(
      /: pilulaDaJornada\s+\? `calc\(100vw - \$\{BOTTOM_NAV_EDGE \* 2 \+ BOTTOM_NAV_FAB_SIZE \+ BOTTOM_NAV_GAP\}px\)`\s+: `\$\{BOTTOM_NAV_PILL_WIDTH\}px`/
    );
    for (const pagina of ["app/page.tsx", "app/dev-preview/app/page.tsx"])
      expect(read(pagina), pagina).toContain("pilulaDaJornada={jornadaAberta}");
  });
});
