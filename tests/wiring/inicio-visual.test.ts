import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Teste de fiação (não de renderização): confirma, a partir do código
 * fonte, que `/dev-preview/app` — a rota funcional usada pra validar T2
 * — realmente importa e renderiza os 4 componentes de Início tocados por
 * este ticket, e que o arquivo de cada componente contém o marcador da
 * composição nova (não uma versão antiga em cache/duplicada).
 *
 * Não usa Vitest+RTL: este projeto não tem `@testing-library/react` nem
 * um plugin de JSX no `vitest.config.ts` (só roda testes de backend em
 * ambiente `node`) — importar um `.tsx` quebra o parse. Ler o arquivo
 * como texto evita isso e ainda pega o bug relatado (import antigo,
 * wrapper escondendo o componente novo, versão duplicada).
 */

const ROOT = join(__dirname, "..", "..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

describe("/dev-preview/app renders the T2 Início components", () => {
  const page = read("app/dev-preview/app/page.tsx");

  it.each([
    ["GreetingHeader", "@/components/home/GreetingHeader"],
    ["HeroCard", "@/components/home/HeroCard"],
    ["NextJobCard", "@/components/home/NextJobCard"],
    ["ObjetivosCard", "@/components/home/ObjetivosCard"],
  ])(
    "imports %s from the real component path, not a duplicate/mock",
    (name, path) => {
      expect(page).toMatch(
        new RegExp(`import\\s*{[^}]*\\b${name}\\b[^}]*}\\s*from\\s*"${path}"`)
      );
    }
  );

  it.each(["GreetingHeader", "HeroCard", "NextJobCard", "ObjetivosCard"])(
    "actually renders <%s in the home tab JSX (imported but unused would still be a bug)",
    (name) => {
      expect(page).toContain(`<${name}`);
    }
  );

  it("does not import a second/alternate copy of any of the 4 components from elsewhere", () => {
    const importLines = page.split("\n").filter((l) => /^\s*import\b/.test(l));
    for (const name of [
      "GreetingHeader",
      "HeroCard",
      "NextJobCard",
      "ObjetivosCard",
    ]) {
      const matches = importLines.filter((l) =>
        new RegExp(`\\b${name}\\b`).test(l)
      );
      expect(matches).toHaveLength(1);
    }
  });
});

describe("the Início component files on disk carry the T2 visual rewrite", () => {
  it("HeroCard.tsx keeps the real progress ring (not decorative)", () => {
    const src = read("components/home/HeroCard.tsx");
    expect(src).toContain("RING_CIRCUMFERENCE");
    expect(src).toContain("strokeDashoffset");
  });

  it("GreetingHeader.tsx uses the approved iOS prototype's greeting scale (30px/28px title, weight 760), not the old lab scale (17px) or the original 27px one", () => {
    // Fundação Visual (redesign #122, ticket #142): a escala de 17px/600
    // era uma decisão do laboratório anterior ao protótipo iOS aprovado,
    // nunca revisitada -- o protótipo (`.greetingHeader h1`) usa
    // 30px/760/-0.035em (28px <390px). Ver docs/visual/IOS_VISUAL_SYSTEM.md.
    const src = read("components/home/GreetingHeader.tsx");
    expect(src).toContain("text-[28px]");
    expect(src).toContain("min-[390px]:text-[30px]");
    expect(src).toContain("fontWeight: 760");
    expect(src).not.toContain('fontSize: "27px"');
    expect(src).not.toContain('fontSize: "17px"');
  });

  it("NextJobCard.tsx has the day/month date badge from the lab, not the old inline date text", () => {
    const src = read("components/home/NextJobCard.tsx");
    expect(src).toContain("formatDayBadge");
    expect(src).toContain("dayBadge");
  });
});

describe("the Início component files carry the #131 visual-review correction (real vs /dev-preview/ios)", () => {
  it("HeroCard/NextJobCard/ObjetivosCard don't duplicate a per-file card surface anymore", () => {
    // Achado #131: os 3 arquivos sobrescreviam a borda neutra de
    // `.glass-card` (--card-border) por --border-color (cor-de-destaque
    // do tema), produzindo um contorno temático (rosa em pink-neon etc.)
    // que o protótipo aprovado não tem. A correção é usar SÓ o material
    // compartilhado de `.glass-card` (sem `style` de superfície na própria
    // GlassCard) — nenhum dos 3 deve mais montar a própria superfície com
    // esse objeto. Não checa TODO uso de --border-color no arquivo (chips
    // pequenos internos, como o selo de status de NextJobCard, continuam
    // legitimamente temáticos — só a superfície do CARD é o que mudou).
    for (const file of [
      "components/home/HeroCard.tsx",
      "components/home/NextJobCard.tsx",
      "components/home/ObjetivosCard.tsx",
    ]) {
      expect(read(file)).not.toContain("SOLID_SURFACE_STYLE");
    }
  });

  it("HeroCard.tsx restores the approved title/metric/icon (achado #131)", () => {
    const src = read("components/home/HeroCard.tsx");
    expect(src).toContain("Sua projeção");
    expect(src).toMatch(/<Plane\b/);
    expect(src).not.toMatch(/<Target\b/);
    expect(src).toContain('fontSize: "48px"');
  });

  it("HeroCard/NextJobCard/ObjetivosCard share one card-title style, not 3 divergent inline copies", () => {
    for (const file of [
      "components/home/HeroCard.tsx",
      "components/home/NextJobCard.tsx",
      "components/home/ObjetivosCard.tsx",
    ]) {
      expect(read(file)).toMatch(/className="card-title"/);
    }
    expect(read("styles/globals.css")).toContain(".card-title {");
  });

  it("NextJobCard.tsx wraps the summary row in an inner block (bloco interno) using --card-border, not a magic value", () => {
    const src = read("components/home/NextJobCard.tsx");
    expect(src).toMatch(/border:\s*"1px solid var\(--card-border\)"/);
  });

  it("NextJobCard.tsx prices the atendimento in --warning, not --accent (achado #131)", () => {
    const src = read("components/home/NextJobCard.tsx");
    expect(src).toMatch(/color:\s*"var\(--warning\)"/);
  });

  it("NextJobCard.tsx gets getDaysUntil/countdownLabel/formatDayBadge from the tested lib module, not a local reimplementation", () => {
    const src = read("components/home/NextJobCard.tsx");
    expect(src).toMatch(
      /import\s*\{[^}]*getDaysUntil[^}]*countdownLabel[^}]*formatDayBadge[^}]*\}\s*from\s*"@\/lib\/proximoAtendimento"/
    );
    expect(src).not.toMatch(/^function getDaysUntil/m);
  });

  it("GreetingHeader.tsx doesn't force capitalize on every word of the date anymore", () => {
    const src = read("components/home/GreetingHeader.tsx");
    expect(src).not.toMatch(/className="capitalize/);
    expect(src).toMatch(/charAt\(0\)\.toUpperCase\(\)/);
  });
});
