import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Jornada com o topo tampado no iPhone (PWA instalado).
 *
 * Causa: o app usa `viewport-fit: cover` com a barra de status
 * `black-translucent` -- a página começa por BAIXO do relógio/notch. A
 * casca do app soma `env(safe-area-inset-top)`; a Jornada cobre a tela
 * inteira (fixed inset-0) e trazia os 20px do `.pad` do protótipo, então
 * Voltar, áudio e Ajustes ficavam embaixo da barra de status.
 *
 * Correção: cada peça da Jornada presa ao topo (ou ao rodapé) soma a área
 * segura ao valor do protótipo, numa regra `.raiz …` à parte. Fora do
 * iPhone `env()` é 0: o pixel aprovado (0,00%) não muda.
 */
const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");
const CSS = read("components/jornada/jornada.module.css");

/** Corpo da regra com exatamente esse seletor (primeira ocorrência). */
function regra(sel: string): string {
  const i = CSS.indexOf(`\n${sel} {`);
  expect(i, sel).toBeGreaterThan(-1);
  return CSS.slice(i, CSS.indexOf("}", i));
}
/** Os 4 lados de um `padding` (1 a 4 valores) ou de um `inset`. */
function lados(v: string): [string, string, string, string] {
  const p = v.trim().split(/\s+/);
  const [t, r = t, b = t, l = r] = p;
  return [t, r, b, l];
}
function decl(corpo: string, prop: string): string {
  const m = corpo.match(new RegExp(`\\n\\s*${prop}:\\s*([^;]+);`));
  expect(m, prop).toBeTruthy();
  return m![1].trim();
}

describe("a causa: a página começa por baixo da barra de status do iPhone", () => {
  it("viewport-fit cover e barra de status black-translucent (app/layout.tsx)", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toMatch(/viewportFit:\s*"cover"/);
    expect(layout).toMatch(/statusBarStyle:\s*"black-translucent"/);
  });
});

describe("cada peça presa ao topo/rodapé soma a área segura ao valor do protótipo", () => {
  // [seletor, lado, de onde sai o valor base na regra do protótipo]
  const CASOS: [string, "top" | "bottom", string, number][] = [
    [".pad", "top", "padding", 0],
    [".pad", "bottom", "padding", 2],
    [".rc-body", "top", "padding", 0],
    [".rc-body", "bottom", "padding", 2],
    [".stg", "top", "padding", 0],
    [".stg", "bottom", "padding", 2],
    [".sheet", "bottom", "padding", 2],
    [".toast", "top", "top", -1],
    [".rc-seg", "top", "top", -1],
    [".rc-x", "top", "top", -1],
    [".rc-tap", "top", "inset", 0],
  ];
  it.each(CASOS)("%s (%s)", (sel, lado, prop, idx) => {
    const base = decl(regra(sel), prop);
    const valor = idx < 0 ? base : lados(base)[idx];
    expect(valor).toMatch(/^\d+px$/);
    const seg = regra(`.raiz ${sel}`);
    const alvo = prop === "padding" ? `padding-${lado}` : "top";
    expect(decl(seg, alvo)).toBe(
      `calc(${valor} + env(safe-area-inset-${lado}, 0px))`
    );
  });

  it("as regras moram em `.raiz …` e as peças são renderizadas dentro de um .raiz", () => {
    expect(read("components/jornada/JornadaScreen.tsx")).toMatch(
      /className=\{cx\(\s*s\.raiz,/
    );
    expect(read("components/jornada/JornadaAjustes.tsx")).toContain(
      "className={cx(s.raiz, s.palco)}"
    );
    expect(read("components/jornada/resumos/JornadaResumos.tsx")).toContain(
      "className={cx(s.raiz, s.palco)}"
    );
    expect(
      read("components/jornada/celebracao/ComemoracaoPalco.tsx")
    ).toContain("className={cx(s.raiz, s.palco)}");
  });
});

describe('o "+" não recua por causa do que está escondido atrás da Jornada', () => {
  it('com a Jornada aberta, a checagem de colisão do "+" fica desligada', () => {
    const fab = read("components/FAB.tsx");
    expect(fab).toMatch(
      /useFabCollisionAvoidance\(\s*Boolean\(action\) && !open && !cobertoPorTela\s*\)/
    );
    for (const p of ["app/page.tsx", "app/dev-preview/app/page.tsx"])
      expect(read(p), p).toContain("cobertoPorTela={jornadaAberta}");
  });
});
