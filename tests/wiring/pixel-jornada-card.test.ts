import { describe, expect, it } from "vitest";
import { escapar, norm, read } from "./pixelMockup";
import {
  ateProximo,
  capituloEmPartes,
  diasFortesDeTres,
  enfeiteEmPartes,
} from "../../lib/jornada/textos";

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

  it("a seta: 20px, traço 2, cor --t-mut", () => {
    expect(PROTO).toMatch(/ic\('chev', 20, 2, 'var\(--t-mut\)'\)/);
    expect(ICONES).toMatch(
      /<Svg size=\{20\} strokeWidth=\{2\}>\s*\{PATHS\.chev\}/
    );
    expect(CARD).toMatch(
      /<span style=\{\{ color: "var\(--t-mut\)" \}\}>\s*<IconeSeta \/>/
    );
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
