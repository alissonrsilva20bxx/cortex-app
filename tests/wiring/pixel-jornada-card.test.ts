import { describe, expect, it } from "vitest";
import { escapar, norm, read } from "./pixelMockup";
import {
  LETRAS_DA_SEMANA,
  ORDEM_DO_PROXIMO_PASSO,
  PROXIMO_PASSO,
  TEXTO_DO_PROXIMO_PASSO,
  ateProximo,
  capituloEmPartes,
  diasFortesDeTres,
  enfeiteEmPartes,
} from "../../lib/jornada/textos";
import {
  bolinhasDaSemana,
  destinoDoProximoPasso,
  indiceDeHojeNaSemana,
  proximoPasso,
} from "../../components/jornada/progresso";
import { ehEstadoJornada } from "../../lib/jornada/estado";
import { estadoJornadaExemplo } from "../../lib/mockJornada";
import type { EstadoJornada } from "../../lib/jornada/estado";

/**
 * Card "Sua Jornada" no Início = o `.jcard` do protótipo aprovado
 * (docs/jornada/referencias/prototipo-sua-jornada.html). Cada valor é lido
 * do protótipo e procurado no código do card: se um lado mudar, o teste
 * cai.
 */

const PROTO = read("docs/jornada/referencias/prototipo-sua-jornada.html");
const CARD = read("components/home/JornadaCard.tsx");
const ICONES = read("components/jornada/jornadaIcones.tsx");

/** As declarações de uma regra do CSS do protótipo, pelo seletor exato. */
function regra(seletor: string): Record<string, string> {
  const m = PROTO.match(
    new RegExp(`(?:^|\\n|\\})${escapar(seletor)}\\{([^}]*)\\}`)
  );
  if (!m) throw new Error(`${seletor} não está no protótipo`);
  const out: Record<string, string> = {};
  for (const d of m[1].split(";")) {
    const i = d.indexOf(":");
    if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
  }
  return out;
}

/** `fontSize: "12px"` <- (`font-size`, `12px`). */
const camel = (p: string) => p.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** O trecho do card que tem `marca` (do `style={{` até o `}}`). */
function estiloCom(marca: string): string {
  const i = CARD.indexOf(marca);
  if (i < 0) throw new Error(`${marca} não está no card`);
  const ini = CARD.lastIndexOf("style={", i);
  const fim = CARD.indexOf("}}", i);
  return norm(CARD.slice(ini, fim));
}

/** A declaração do protótipo aparece no estilo do card (mesmo valor). */
function temDecl(estilo: string, prop: string, valor: string) {
  const v = norm(valor)
    .replace(/var\(--t-([a-z0-9-]+)\)/g, "var(--t-$1)")
    .replace(/^0(\.\d)/, "$1");
  expect(estilo, `${prop}: ${valor}`).toContain(`${camel(prop)}:${v}`);
}

describe("Pixel card da Jornada — medidas do protótipo (.jcard)", () => {
  it("o card: padding, gap, raio, fundo com brilho do acento e contorno de 1px", () => {
    const jcard = regra(".jcard");
    const cx = regra(".cx");
    const card = estiloCom('padding: "16px 16px 14px"');
    temDecl(card, "padding", jcard.padding);
    temDecl(card, "gap", jcard.gap);
    temDecl(card, "border-radius", cx["border-radius"]);
    temDecl(card, "position", jcard.position);
    temDecl(card, "overflow", jcard.overflow);
    // Fundo: o mesmo gradiente (com "100% 0%" = "right top") sobre --t-card.
    expect(jcard.background).toContain("at 100% 0%");
    expect(card).toContain(
      norm(jcard.background.replace("at 100% 0%", "at right top"))
    );
    expect(card).toContain(`boxShadow:${norm(jcard["box-shadow"])}`);
    // O protótipo não define line-height: "normal" (o Início herda 1,5).
    expect(PROTO).not.toMatch(/\.ph\{[^}]*line-height/);
    expect(card).toContain("lineHeight:normal");
  });

  it("o topo: anel 56×56 com o ícone no centro, gap 12", () => {
    const jtop = regra(".jtop");
    const jring = regra(".jring");
    const jic = regra(".jring .jic");
    expect(jtop.gap).toBe("12px");
    expect(estiloCom('alignItems: "center",\n          gap: "12px"')).toContain(
      `gap:${jtop.gap}`
    );
    const anel = estiloCom('width: "56px"');
    temDecl(anel, "width", jring.width);
    temDecl(anel, "height", jring.height);
    temDecl(anel, "position", jring.position);
    const ic = estiloCom("inset: 0,");
    expect(ic).toContain("inset:0");
    temDecl(ic, "color", jic.color);
    // ring(56, 5, pr): tamanho 56, traço 5, trilho --t-soft, progresso --t-acc.
    expect(PROTO).toMatch(/ring\(56, 5, pr, null, true\)/);
    expect(CARD).toMatch(/const tamanho = 56;\s*const espessura = 5;/);
    expect(PROTO).toMatch(/stroke="' \+ \(track \|\| 'var\(--t-soft\)'\)/);
    expect(CARD).toMatch(/stroke="var\(--t-soft\)"/);
    expect(CARD).toMatch(
      /stroke="var\(--t-acc\)"[\s\S]{0,80}strokeLinecap="round"/
    );
    expect(CARD).toMatch(/strokeDasharray=\{volta\.toFixed\(1\)\}/);
    expect(CARD).toMatch(
      /transform=\{`rotate\(-90 \$\{centro\} \$\{centro\}\)`\}/
    );
  });

  it.each([
    [".eyebrow", 'letterSpacing: ".09em"'],
    [".jname", 'letterSpacing: "-.3px"'],
  ])("tipografia de %s", (seletor, marca) => {
    const r = regra(seletor);
    const estilo = estiloCom(marca);
    for (const [p, v] of Object.entries(r)) temDecl(estilo, p, v);
  });

  it("a linha do Glow (.jsub e .jsub b)", () => {
    const sub = regra(".jsub");
    const b = regra(".jsub b");
    const estilo = estiloCom(
      'fontSize: "12px",\n              fontWeight: 600'
    );
    for (const [p, v] of Object.entries(sub)) temDecl(estilo, p, v);
    const negrito = estiloCom('display: "inline-block"');
    for (const [p, v] of Object.entries(b)) temDecl(negrito, p, v);
  });

  it("as linhas de baixo (.wk-cap e .jch) e o negrito delas", () => {
    const cap = regra(".wk-cap");
    const jch = regra(".jch");
    const linha = norm(
      CARD.slice(
        CARD.indexOf("const LINHA"),
        CARD.indexOf("};", CARD.indexOf("const LINHA"))
      )
    );
    for (const p of ["font-size", "font-weight", "color", "margin-top"]) {
      expect(cap[p]).toBe(jch[p]);
      temDecl(linha, p, cap[p]);
    }
    expect(regra(".wk-cap b").color).toBe("var(--t-ink)");
    expect(regra(".jch b")).toEqual({
      color: "var(--t-ink)",
      "font-weight": "800",
    });
    expect(CARD).toMatch(
      /const FORTE: CSSProperties = \{ color: "var\(--t-ink\)" \};/
    );
    expect(CARD).toMatch(/<b style=\{\{ \.\.\.FORTE, fontWeight: 800 \}\}>/);
    const flex = estiloCom('gap: "8px"');
    temDecl(flex, "gap", jch.gap);
    temDecl(flex, "align-items", jch["align-items"]);
  });

  it("o enfeite do mês: 24px, tracejado do acento (mês em andamento)", () => {
    const orn = regra(".jch .orn");
    const off = regra(".orn.off");
    const now = regra(".orn.now");
    const estilo = estiloCom('border: "1.5px dashed var(--t-acc)"');
    temDecl(estilo, "width", orn.width);
    temDecl(estilo, "height", orn.height);
    expect(off.border).toBe("1.5px dashed var(--t-ring)");
    // .now troca a cor da borda pelo acento.
    expect(estilo).toContain(`border:1.5pxdashed${now["border-color"]}`);
    temDecl(estilo, "color", now.color);
    // ornHTML(m, 'off now', 13): ícone de 13px.
    expect(PROTO).toMatch(/ornHTML\(m, 'off now', 13\)/);
    expect(ICONES).toMatch(/<Svg size=\{13\} strokeWidth=\{2\.2\}>/);
  });

  it("a seta: 20px, traço 2, traço em --t-mut pelo atributo stroke (como ic())", () => {
    expect(PROTO).toMatch(/ic\('chev', 20, 2, 'var\(--t-mut\)'\)/);
    expect(PROTO).toMatch(
      /stroke="' \+ sw \+|fill="none" stroke="' \+ c \+ '"/
    );
    expect(ICONES).toMatch(
      /<Svg size=\{20\} strokeWidth=\{2\} stroke="var\(--t-mut\)">\s*\{PATHS\.chev\}/
    );
    // Sem embrulho com color: o elemento herda --t-ink, como no protótipo.
    expect(CARD).not.toMatch(/color: "var\(--t-mut\)" \}\}>\s*<IconeSeta/);
    expect(CARD).toContain("<IconeSeta />");
  });

  it("a raiz do card tem 16px de fonte (o .ph do protótipo herda 16px)", () => {
    expect(PROTO).not.toMatch(/\.ph\{[^}]*font-size/);
    expect(estiloCom('padding: "16px 16px 14px"')).toContain("fontSize:16px");
  });
});

describe("Pixel card da Jornada — ícones e textos do protótipo", () => {
  /** O desenho de um ícone no `P` do protótipo. */
  const caminho = (nome: string) => {
    const m = PROTO.match(new RegExp(`\\b${nome}:'([^']+)'`));
    if (!m) throw new Error(`ícone ${nome} não está no protótipo`);
    return m[1];
  };
  /** O desenho do mesmo ícone no jornadaIcones.tsx (JSX -> SVG). */
  const doApp = (nome: string) => {
    const i = ICONES.indexOf(`  ${nome}: `);
    const fim =
      ICONES.indexOf("\n  ),", i) > 0 &&
      !/^  \w+: </.test(ICONES.slice(i, i + nome.length + 6))
        ? ICONES.indexOf("\n  ),", i)
        : ICONES.indexOf("\n", i);
    return ICONES.slice(i, fim)
      .replace(/<\/?>/g, "")
      .replace(/\s*\/>/g, "/>")
      .replace(/^\s*\w+: \(?/, "")
      .replace(/\s+</g, "<")
      .replace(/,$/, "")
      .trim();
  };

  const ESTAGIOS = PROTO.match(/var STAGES = \[([\s\S]*?)\];/)![1];
  const DO_ESTAGIO = [...ESTAGIOS.matchAll(/ic:'(\w+)'/g)].map((m) => m[1]);
  const ORN = PROTO.match(/var ORN = \[([\s\S]*?)\];/)![1];
  const DO_MES = [...ORN.matchAll(/\['[^']+', '(\w+)'\]/g)].map((m) => m[1]);

  it("os ícones dos estágios e dos meses estão na mesma ordem do protótipo", () => {
    expect(DO_ESTAGIO).toHaveLength(5);
    expect(DO_MES).toHaveLength(12);
    expect(ICONES).toContain(
      `const DO_ESTAGIO = [${DO_ESTAGIO.map((n) => `"${n}"`).join(", ")}];`
    );
    const doMes = ICONES.slice(ICONES.indexOf("const DO_MES = ["));
    const lista = [
      ...doMes.slice(0, doMes.indexOf("];")).matchAll(/"(\w+)"/g),
    ].map((m) => m[1]);
    expect(lista).toEqual(DO_MES);
  });

  it.each([
    ...new Set([
      "chev",
      "crown",
      "moon",
      "pulse",
      "star",
      "spark",
      "heart",
      "sprout",
      "bulb",
      "palette",
      "sun",
      "coins",
      "bell",
      "layers",
    ]),
  ])("ícone %s com o traço exato do protótipo", (nome) => {
    expect(norm(doApp(nome))).toBe(norm(caminho(nome)));
  });

  it("o ícone do estágio é 22px com traço 2,2 (ic(stageIc(...), 22, 2.2))", () => {
    expect(PROTO).toMatch(/ic\(stageIc\(S\.shown\), 22, 2\.2\)/);
    expect(ICONES).toMatch(/<Svg size=\{22\} strokeWidth=\{2\.2\}>/);
  });

  it("textos: 'N até Estágio', 'N de 3' dias fortes, capítulo e enfeite", () => {
    // toNext(sp): (nextAt - sp) + ' até ' + nextName(sp)
    expect(PROTO).toMatch(
      /return \(nextAt\(sp\) - sp\) \+ ' até ' \+ nextName\(sp\);/
    );
    expect(ateProximo(95, 2)).toBe("95 até Organizada");
    // '<b>' + Math.min(sc, 3) + ' de 3</b> dias fortes nesta semana'
    expect(PROTO).toMatch(
      /Math\.min\(sc, 3\) \+ ' de 3<\/b> dias fortes nesta semana'/
    );
    expect(diasFortesDeTres(2)).toEqual({
      forte: "2 de 3",
      resto: " dias fortes nesta semana",
    });
    expect(diasFortesDeTres(5).forte).toBe("3 de 3");
    expect(PROTO).toMatch(
      /Capítulo de ' \+ MONTHS\[m\] \+ ' · <b>' \+ chCount\(\) \+ ' de 3<\/b> missões/
    );
    expect(capituloEmPartes(10, 0, 3)).toEqual({
      antes: "Capítulo de outubro · ",
      forte: "0 de 3",
      resto: " missões",
    });
    expect(PROTO).toMatch(/<b>' \+ ORN\[m\]\[0\] \+ '<\/b> na sua coleção ✓/);
    expect(enfeiteEmPartes(10)).toEqual({
      forte: "Lua de outubro",
      resto: " na sua coleção ✓",
    });
    // "<b>305</b> Glow · <span>95 até Organizada</span>"
    expect(PROTO).toMatch(/'<\/b> Glow · <span data-live="tonext">'/);
    expect(CARD).toMatch(
      /<\/b>\{" "\}\s*\{NOME_GLOW\} ·\{" "\}\s*<span>\s*\{ateProximo\(/
    );
  });
});

describe("Pixel card da Jornada — lugar no Início (protótipo)", () => {
  it.each(["app/page.tsx", "app/dev-preview/app/page.tsx"])(
    "%s: logo depois do card principal, com o gap da grade (.grid2)",
    (pagina) => {
      const src = read(pagina);
      const gap = regra(".grid2").gap;
      expect(gap).toBe("10px");
      const bloco = src.slice(
        src.indexOf('<div className="col-span-2 flex flex-col gap-['),
        src.indexOf("<NextJobCard")
      );
      expect(bloco).toContain(`gap-[${gap}]`);
      expect(bloco.indexOf("<HeroCard")).toBeGreaterThan(0);
      expect(bloco.indexOf("<JornadaCard")).toBeGreaterThan(
        bloco.indexOf("<HeroCard")
      );
      // No protótipo o .jcard vem logo depois da receita, antes dos pequenos.
      const home = PROTO.slice(PROTO.indexOf("function homeHTML()"));
      expect(home.indexOf("jcard")).toBeLessThan(
        home.indexOf('class="lbl">Próximo<')
      );
      expect(home.indexOf("jcard")).toBeGreaterThan(home.indexOf("Receita · "));
    }
  );
});

describe("Pixel card da Jornada — semana e próximo passo (ordem do operador)", () => {
  const ESTILOS = read("styles/globals.css");

  it("as 7 bolinhas: .week, .day e .dot com os valores do protótipo", () => {
    expect(regra(".week")).toEqual({
      display: "flex",
      "justify-content": "space-between",
    });
    const day = regra(".day");
    const dia = estiloCom(
      'flexDirection: "column",\n                alignItems: "center",\n                gap: "4px"'
    );
    for (const p of ["gap", "font-size", "font-weight"])
      temDecl(dia, p, day[p]);
    expect(dia).toContain(
      `i===hoje?${norm(regra(".day.is-today").color)}:${norm(day.color)}`
    );
    const dot = regra(".dot");
    const base = norm(
      CARD.slice(
        CARD.indexOf("const base: CSSProperties"),
        CARD.indexOf("};", CARD.indexOf("const base: CSSProperties"))
      )
    );
    for (const p of ["width", "height", "border-radius", "color"])
      temDecl(base, p, dot[p]);
    expect(CARD).toContain(
      `<span style={{ ...base, background: "${regra(".dot.strong").background}" }}>`
    );
    expect(regra(".dot.rest")).toEqual({
      background: "var(--t-soft)",
      color: "var(--t-deep)",
    });
    expect(CARD).toMatch(
      /background: "var\(--t-soft\)", color: "var\(--t-deep\)"/
    );
    expect(regra(".dot.today")["box-shadow"]).toBe(
      "inset 0 0 0 2px var(--t-acc)"
    );
    expect(CARD).toContain('boxShadow: "inset 0 0 0 2px var(--t-acc)"');
    // Vazia: --t-sub no claro; no escuro, só o contorno.
    expect(ESTILOS).toMatch(
      /\.jornada-dia-vazio \{\s*background: var\(--t-sub\);/
    );
    expect(PROTO).toContain(
      ".ph[data-md=dark] .dot:not(.strong):not(.rest):not(.today){background:transparent;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--t-mut) 45%,transparent)}"
    );
    expect(ESTILOS).toMatch(
      /:root:not\(\[data-mode="light"\]\) \.jornada-dia-vazio \{\s*background: transparent;\s*box-shadow: inset 0 0 0 1\.5px\s+color-mix\(in srgb, var\(--t-mut\) 45%, transparent\);/
    );
    // ic('check', 15, 3) e ic('moon', 13, 2.4)
    expect(PROTO).toMatch(/ic\('check', big \? 18 : 15, 3\)/);
    expect(PROTO).toMatch(/ic\('moon', big \? 16 : 13, 2\.4\)/);
    expect(CARD).toContain(
      '<IconeDoPrototipo nome="check" tamanho={15} traco={3} />'
    );
    expect(CARD).toContain(
      '<IconeDoPrototipo nome="moon" tamanho={13} traco={2.4} />'
    );
  });

  it("as letras dos dias e a ordem (segunda a domingo) são as do protótipo", () => {
    const days = PROTO.match(/var DAYS = (\[[^\]]+\]);/)![1].replace(/'/g, '"');
    expect(JSON.stringify(LETRAS_DA_SEMANA)).toBe(days.replace(/\s/g, ""));
  });

  it("o próximo passo: .next, .nic, .ntx, small e .pts", () => {
    const next = regra(".next");
    const passo = norm(
      CARD.slice(
        CARD.indexOf("const PASSO: CSSProperties"),
        CARD.indexOf("};", CARD.indexOf("const PASSO: CSSProperties"))
      )
    );
    temDecl(passo, "gap", next.gap);
    temDecl(passo, "padding", next.padding.replace("!important", ""));
    temDecl(passo, "border-radius", next["border-radius"]);
    temDecl(passo, "background", next.background.replace("!important", ""));
    const nic = regra(".next .nic");
    const icone = norm(
      CARD.slice(
        CARD.indexOf("const PASSO_ICONE"),
        CARD.indexOf("};", CARD.indexOf("const PASSO_ICONE"))
      )
    );
    for (const p of ["width", "height", "border-radius", "background", "color"])
      temDecl(icone, p, nic[p]);
    const ntx = regra(".next .ntx");
    const texto = norm(
      CARD.slice(
        CARD.indexOf("const PASSO_TEXTO"),
        CARD.indexOf("};", CARD.indexOf("const PASSO_TEXTO"))
      )
    );
    for (const p of ["font-size", "font-weight"]) temDecl(texto, p, ntx[p]);
    const small = regra(".next .ntx small");
    const rotulo = norm(
      CARD.slice(
        CARD.indexOf("const PASSO_ROTULO"),
        CARD.indexOf("};", CARD.indexOf("const PASSO_ROTULO"))
      )
    );
    for (const p of [
      "font-size",
      "font-weight",
      "letter-spacing",
      "text-transform",
      "color",
    ])
      temDecl(rotulo, p, small[p]);
    const pts = regra(".pts");
    const ptsApp = estiloCom('gap: "3px"');
    for (const p of ["gap", "font-size", "font-weight", "color"])
      temDecl(ptsApp, p, pts[p]);
    // ic(ACTIONS[nk].ic, 16, 2.3) e icf('spark', 11)
    expect(PROTO).toMatch(/ic\(ACTIONS\[nk\]\.ic, 16, 2\.3\)/);
    expect(CARD).toMatch(/tamanho=\{16\}\s*traco=\{2\.3\}/);
    expect(PROTO).toMatch(/icf\('spark', 11\)/);
    expect(CARD).toContain("<FaiscaCheia tamanho={11} />");
  });

  it("ordem, textos e ícones do próximo passo = NEXT_ORDER, NEXT_TXT e ACTIONS do protótipo", () => {
    const ordem = PROTO.match(/var NEXT_ORDER = \[([^\]]+)\]/)![1]
      .match(/'(\w+)'/g)!
      .map((x) => x.slice(1, -1));
    const DE = {
      save: "guardar_meta",
      vault: "comprovante_cofre",
      plan: "planejar",
      rest: "descanso",
      expense: "despesa",
    } as const;
    expect(ordem.map((k) => DE[k as keyof typeof DE])).toEqual([
      ...ORDEM_DO_PROXIMO_PASSO,
    ]);
    const txt = PROTO.match(/var NEXT_TXT = \{([^}]+)\}/)![1];
    for (const k of ordem) {
      const m = txt.match(
        new RegExp(`${k}:'([^']*)'(?: \\+ money\\((\\d+)\\) \\+ '([^']*)')?`)
      )!;
      const esperado = m[2] ? `${m[1]}€ ${m[2]}${m[3]}` : m[1];
      expect(
        TEXTO_DO_PROXIMO_PASSO[DE[k as keyof typeof DE]].replace(/€ /, "€ ")
      ).toBe(esperado);
    }
    for (const k of ordem) {
      const ic = PROTO.match(new RegExp(`\\n  ${k}:\\{[^}]*ic:'(\\w+)'`))![1];
      expect(CARD).toContain(`${DE[k as keyof typeof DE]}: "${ic}"`);
    }
    expect(PROTO).toContain("<small>Próximo passo</small>");
    expect(PROTO).toContain("<small>Hoje</small>Hoje você já cuidou de tudo");
    expect(PROXIMO_PASSO).toEqual({
      rotulo: "Próximo passo",
      feitoRotulo: "Hoje",
      feito: "Hoje você já cuidou de tudo",
    });
  });

  it("o próximo passo é o primeiro que ela não fez hoje (nextKey do protótipo)", () => {
    const base = { feitasHoje: {} } as unknown as EstadoJornada;
    expect(proximoPasso(base)).toBe("guardar_meta");
    expect(proximoPasso({ ...base, feitasHoje: { guardar_meta: 1 } })).toBe(
      "comprovante_cofre"
    );
    expect(
      proximoPasso({
        ...base,
        feitasHoje: {
          guardar_meta: 1,
          comprovante_cofre: 2,
          planejar: 1,
          descanso: 1,
        },
      })
    ).toBe("despesa");
    expect(
      proximoPasso({
        ...base,
        feitasHoje: {
          guardar_meta: 1,
          comprovante_cofre: 1,
          planejar: 1,
          descanso: 1,
          despesa: 1,
        },
      })
    ).toBeNull();
    // Hoje no card: segunda = 0 (sexta 02/10/2026 = 4, como S.today).
    expect(indiceDeHojeNaSemana({ hoje: "2026-10-02" } as EstadoJornada)).toBe(
      4
    );
    expect(PROTO).toMatch(/today:4/);
  });

  it("a 0038 manda feitasHoje lido de jornada_acoes, sem registrar nada novo, e não é aplicada", () => {
    const sql = read("supabase/migrations/0038_jornada_feitas_hoje.sql");
    expect(sql).toMatch(
      /alter function private\.jornada_estado_de\(uuid, date\)\s*rename to jornada_estado_base;/
    );
    expect(sql).toMatch(
      /from public\.jornada_acoes a\s*where a\.user_id = p_user and a\.dia = p_hoje and a\.ganhos_no_dia > 0/
    );
    expect(sql).toMatch(
      /'feitasHoje', private\.jornada_feitas_hoje\(p_user, p_hoje\)/
    );
    expect(sql).not.toMatch(/\b(insert|update|delete)\b/i);
    expect(sql).toMatch(/NUNCA aplicada/);
  });

  it("o laboratório começa sem nada feito hoje (S.done = {}) e o card leva cada passo ao lugar certo", () => {
    expect(PROTO).toMatch(/done:\{\}/);
    expect(estadoJornadaExemplo(new Date(2026, 9, 2)).feitasHoje).toEqual({});
    expect(destinoDoProximoPasso("guardar_meta")).toEqual({
      aba: "financeiro",
      financeiro: "metas",
    });
    expect(destinoDoProximoPasso("despesa")).toEqual({
      aba: "financeiro",
      financeiro: "saidas",
    });
    expect(destinoDoProximoPasso("comprovante_cofre")).toEqual({
      aba: "cofre",
    });
    expect(destinoDoProximoPasso("planejar")).toEqual({ aba: "jobs" });
    for (const pagina of ["app/page.tsx", "app/dev-preview/app/page.tsx"])
      expect(read(pagina)).toMatch(
        /onProximoPasso=\{\(acao\) => \{\s*const destino = destinoDoProximoPasso\(acao\);\s*handleTabChange\(destino\.aba\);\s*if \(destino\.financeiro\)\s*setFinanceiroFocusTab\(destino\.financeiro\);/
      );
  });

  it("as bolinhas saem de semana.dias do servidor (fresh() do protótipo: week e today)", () => {
    // week:['strong', 'rest', 'strong', null, null, null, null], today:4
    const week = PROTO.match(/week:\[([^\]]+)\]/)![1]
      .split(",")
      .map((x) => x.trim().replace(/'/g, ""))
      .map((x) =>
        x === "strong" ? "forte" : x === "rest" ? "descanso" : null
      );
    const hojeP = Number(PROTO.match(/today:(\d+)/)![1]);
    const esperado = week.map((m, i) => m ?? (i === hojeP ? "hoje" : "vazia"));
    const lab = estadoJornadaExemplo(new Date(2026, 9, 2));
    expect(lab.semana?.dias).toEqual(week);
    expect(bolinhasDaSemana(lab)).toEqual(esperado);
    // Outra semana do servidor: as bolinhas acompanham.
    expect(
      bolinhasDaSemana({
        ...lab,
        semana: {
          dias: [null, null, "descanso", "forte", "forte", null, null],
        },
      })
    ).toEqual([
      "vazia",
      "vazia",
      "descanso",
      "forte",
      "forte",
      "vazia",
      "vazia",
    ]);
    expect(bolinhasDaSemana({ ...lab, semana: undefined })).toEqual([]);
    // O card desenha exatamente essas bolinhas.
    expect(CARD).toMatch(/const bolinhas = bolinhasDaSemana\(estado\);/);
    expect(CARD).toMatch(
      /bolinhas\.map\(\(tipo, i\) =>[\s\S]{0,600}<Bolinha tipo=\{tipo\} \/>/
    );
  });

  it("feitasHoje só aceita ações de verdade (nada de linha de controle do servidor)", () => {
    const lab = estadoJornadaExemplo(new Date(2026, 9, 2));
    expect(
      ehEstadoJornada({ ...lab, feitasHoje: { guardar_meta: 1, despesa: 2 } })
    ).toBe(true);
    expect(ehEstadoJornada({ ...lab, feitasHoje: { dica_ajudou: 1 } })).toBe(
      true
    );
    expect(ehEstadoJornada({ ...lab, feitasHoje: { dia_na_jornada: 1 } })).toBe(
      false
    );
    expect(ehEstadoJornada({ ...lab, feitasHoje: { despesa: "2" } })).toBe(
      false
    );
    const sql = read("supabase/migrations/0038_jornada_feitas_hoje.sql");
    expect(sql).toMatch(
      /and exists \(select 1 from private\.jornada_regra\(a\.acao\)\)/
    );
    // Idempotente: o rename só na primeira vez.
    expect(sql).toMatch(
      /if not exists \([\s\S]*?p\.proname = 'jornada_estado_base'[\s\S]*?\) then\s*alter function private\.jornada_estado_de\(uuid, date\)\s*rename to jornada_estado_base;/
    );
  });
});
