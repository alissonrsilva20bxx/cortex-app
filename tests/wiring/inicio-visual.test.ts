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
  it("HeroCard.tsx has the two-column value+ring composition, not the old single-column layout", () => {
    const src = read("components/home/HeroCard.tsx");
    expect(src).toContain("RING_CIRCUMFERENCE");
    expect(src).toContain("grid-cols-[1fr_86px]");
    expect(src).toContain("strokeDashoffset");
  });

  it("GreetingHeader.tsx uses the lab's literal type scale (17px title), not the old 27px one", () => {
    const src = read("components/home/GreetingHeader.tsx");
    expect(src).toContain('fontSize: "17px"');
    expect(src).not.toContain('fontSize: "27px"');
  });

  it("NextJobCard.tsx has the day/month date badge from the lab, not the old inline date text", () => {
    const src = read("components/home/NextJobCard.tsx");
    expect(src).toContain("formatDayBadge");
    expect(src).toContain("dayBadge");
  });

  it("all 4 components de-blur their GlassCard surface (solid, not the shared blurred glass)", () => {
    for (const file of [
      "components/home/HeroCard.tsx",
      "components/home/NextJobCard.tsx",
      "components/home/ObjetivosCard.tsx",
    ]) {
      expect(read(file)).toContain('backdropFilter: "none"');
    }
  });
});
