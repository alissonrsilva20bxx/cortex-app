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
  it("HeroCard.tsx keeps a real progress indicator (not decorative)", () => {
    // Jornada J02 (#152): o mockup aprovado da Jornada troca o anel por uma barra. O
    // que este teste guarda continua igual: a largura vem da fração real
    // de monthProjection, não de um valor fixo.
    const src = read("components/home/HeroCard.tsx");
    expect(src).toMatch(
      /width:\s*`\$\{Math\.round\(p\.barFraction \* 100\)\}%`/
    );
  });

  it("GreetingHeader.tsx uses the Jornada mockup's compact header (Olá, 17px/800 title, 12px date, Novo button)", () => {
    // Jornada J02 (#152): a escala 30px/760 do protótipo iOS (#122/#142) foi
    // substituída pelo cabeçalho compacto do mockup aprovado da Jornada
    // (5-telas-8-temas-claro-escuro.html, tela Início). Decisão da
    // coordenação: o mockup da Jornada vence o visual anterior.
    const src = read("components/home/GreetingHeader.tsx");
    expect(src).toContain("{`Olá, ${firstName}`}");
    expect(src).toContain('fontSize: "17px"');
    expect(src).toContain('fontSize: "12px"');
    expect(src).toMatch(/onClick=\{onNovo\}[\s\S]{0,600}Novo/);
    expect(src).not.toContain("min-[390px]:text-[30px]");
  });

  it("NextJobCard.tsx shows the hour and '<name> · <short day>' (Jornada mockup), not the old date badge", () => {
    // Jornada J02 (#152): o "Próximo" virou um card pequeno da grade, com o horário em
    // destaque e "<nome> · <dia curto>", como no mockup aprovado.
    const src = read("components/home/NextJobCard.tsx");
    expect(src).toContain("{formatHora(job.hora)}");
    // Pixel (mockup normativo): só o primeiro nome, dia curto em minúsculas.
    expect(src).toMatch(
      /\{job\.clienteNome\.split\(" "\)\[0\]\} ·\{" "\}\s*\{rotuloDiaCurto\(job\.data\)\.toLowerCase\(\)\}/
    );
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

  it("HeroCard.tsx uses the Jornada mockup's title, meta pill and metric", () => {
    // Jornada J02 (#152): "Sua projeção" + avião + 48px (#131) deram lugar ao card do
    // mockup aprovado da Jornada: "Faturamento · <mês>", a pílula
    // "<n>% da meta" e o valor do mês em destaque.
    const src = read("components/home/HeroCard.tsx");
    expect(src).toContain("{`Faturamento · ${p.monthLabel}`}");
    expect(src).toContain("{Math.round(p.pct)}% da meta");
    expect(src).toContain("{formatBRL(p.earned)}");
    expect(src).toContain('fontSize: "36px"');
  });

  it("the Início cards share one card surface (InicioCard), not a divergent copy per file", () => {
    // Jornada J02 (#152): o título de card de 20px (.card-title, #131) não existe no
    // mockup da Jornada -- lá os cards pequenos têm rótulo de 11px. O que
    // este teste guarda continua: uma superfície só, não uma por arquivo.
    for (const file of [
      "components/home/HeroCard.tsx",
      "components/home/NextJobCard.tsx",
      "components/home/ObjetivosCard.tsx",
      "components/home/FaltaMetaCard.tsx",
      "components/home/CofreCard.tsx",
      "components/home/SemanaSection.tsx",
      "components/home/ProximosAtendimentos.tsx",
    ]) {
      const src = read(file);
      expect(src, file).toMatch(/from "\.\/InicioCard"/);
      expect(src, file).not.toMatch(/background:\s*"var\(--card-solid\)"/);
    }
    expect(read("components/home/InicioCard.tsx")).toContain(
      'background: tom === "cofre" ? "var(--t-hero)" : "var(--t-card)"'
    );
  });

  it("the Início lists divide rows with the mockup line token (--t-line), not a magic value", () => {
    // Jornada J02 (#152): o bloco interno do NextJobCard saiu junto com o card antigo;
    // as linhas novas ("Esta semana", "Próximos atendimentos") seguem a
    // mesma regra de borda neutra.
    for (const file of [
      "components/home/SemanaSection.tsx",
      "components/home/ProximosAtendimentos.tsx",
    ]) {
      expect(read(file), file).toMatch(
        /borderBottom:\s*"1px solid var\(--t-line\)"/
      );
    }
  });

  it("Início prices atendimentos with the shared formatBRL, never a local formatter", () => {
    // Jornada J02 (#152): o preço saiu do card "Próximo" (o mockup não mostra valor ali)
    // e foi pra "Esta semana" (em --accent-deep, como no mockup) e
    // "Próximos atendimentos". A moeda continua a do app, de lib/finance.
    for (const file of [
      "components/home/SemanaSection.tsx",
      "components/home/ProximosAtendimentos.tsx",
    ]) {
      const src = read(file);
      expect(src, file).toMatch(
        /import \{ formatBRL \} from "@\/lib\/finance"/
      );
      expect(src, file).toContain("{formatBRL(job.valor)}");
      expect(src, file).not.toMatch(/new Intl\.NumberFormat/);
    }
  });

  it("NextJobCard.tsx gets its date logic from the tested inicioAgenda module, not a local reimplementation", () => {
    // Jornada J02 (#152): mesma regra de antes (lógica de data num módulo testado), agora
    // com as funções da grade e das listas novas.
    const src = read("components/home/NextJobCard.tsx");
    expect(src).toMatch(
      /import\s*\{[^}]*proximoAtendimento[^}]*\}\s*from\s*"\.\/inicioAgenda"/
    );
    expect(src).not.toMatch(/^function getProximoJob/m);
  });

  it("GreetingHeader.tsx doesn't force capitalize on every word of the date anymore", () => {
    const src = read("components/home/GreetingHeader.tsx");
    expect(src).not.toMatch(/className="capitalize/);
    expect(src).toMatch(/charAt\(0\)\.toUpperCase\(\)/);
  });
});
