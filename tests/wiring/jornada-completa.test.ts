import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * J16 (#166) — o app monta a Jornada INTEIRA dos caminhos reais, e nenhuma
 * cópia ou mock do protótipo entra no app de verdade.
 *
 * Cada ticket da Fase 2 tem a sua fiação (J12 tela, J13 comemoração, J14
 * resumos, J15 ligação). Este teste olha o conjunto: o app autenticado
 * (`app/page.tsx`) monta card, tela e comemoração; a tela monta todas as
 * seções e os resumos; tudo lê o mesmo hook da J11; e o transporte de
 * laboratório e os dados de mentira ficam só em /dev-preview.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");

function soCodigo(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function importsDe(src: string): string[] {
  return [...src.matchAll(/^import[\s\S]*?from\s+["']([^"']+)["'];?$/gm)].map(
    (m) => m[1]
  );
}

function arquivos(dir: string): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  const out: string[] = [];
  for (const nome of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${nome}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...arquivos(rel));
    else if (/\.(ts|tsx)$/.test(rel)) out.push(rel);
  }
  return out;
}

const APP = soCodigo(read("app/page.tsx"));
const LAB = soCodigo(read("app/dev-preview/app/page.tsx"));
const TELA = soCodigo(read("components/jornada/JornadaScreen.tsx"));

/** Todo arquivo da Jornada que aparece pra usuária. */
const DA_JORNADA = [
  ...arquivos("components/jornada"),
  "components/home/JornadaCard.tsx",
];

/** O app de verdade: tudo fora de /dev-preview e dos testes. */
const DO_APP = [
  ...arquivos("app").filter((f) => !f.startsWith("app/dev-preview/")),
  ...arquivos("components").filter(
    (f) => !f.startsWith("components/ios-prototype/")
  ),
  ...arquivos("lib").filter((f) => f !== "lib/mockJornada.ts"),
];

describe("o app autenticado monta a Jornada dos caminhos reais", () => {
  const PECAS: [string, string][] = [
    ["JornadaCard", "@/components/home/JornadaCard"],
    ["JornadaScreen", "@/components/jornada/JornadaScreen"],
    ["ComemoracaoHost", "@/components/jornada/celebracao/ComemoracaoHost"],
  ];

  it.each(PECAS)("app/page.tsx importa %s de %s e monta", (nome, caminho) => {
    expect(importsDe(APP)).toContain(caminho);
    expect(existsSync(join(ROOT, `${caminho.replace("@/", "")}.tsx`))).toBe(
      true
    );
    expect(APP).toMatch(new RegExp(`<${nome}\\b`));
  });

  it("o card fica no Início, entre a grade e a Agenda, e abre a tela", () => {
    const inicio = APP.indexOf('<TabPanel tab="home"');
    const fim = APP.indexOf("</TabPanel>", inicio);
    const home = APP.slice(inicio, fim);
    const card = home.indexOf("<JornadaCard");
    expect(card).toBeGreaterThan(home.indexOf("<CofreCard"));
    expect(card).toBeLessThan(home.indexOf("<SemanaSection"));
    expect(APP).toMatch(/onAbrir=\{\(\) => setJornadaAberta\(true\)\}/);
  });

  it("a comemoração só monta com usuária logada (nunca por cima do PIN)", () => {
    expect(APP).toMatch(
      /\{usuario && <ComemoracaoHost userId=\{usuario\.id\} \/>\}/
    );
  });

  it("a tela monta todas as seções e os resumos, dos arquivos da Jornada", () => {
    const secoes = [
      ["JornadaEstagio", "./JornadaEstagio"],
      ["JornadaCapitulo", "./JornadaCapitulo"],
      ["JornadaColecao", "./JornadaColecao"],
      ["JornadaDinheiro", "./JornadaDinheiro"],
      ["JornadaPilares", "./JornadaPilares"],
      ["JornadaSelos", "./JornadaSelos"],
      ["JornadaDestrava", "./JornadaDestrava"],
      // Pixel do protótipo: os resumos são botões no fim da tela que abrem
      // o resumo em stories; os ajustes são a folha da engrenagem.
      ["BotoesDosResumos", "./resumos/JornadaResumos"],
      ["JornadaRecap", "./resumos/JornadaResumos"],
      ["JornadaAjustes", "./JornadaAjustes"],
    ];
    for (const [nome, caminho] of secoes) {
      expect(importsDe(TELA), nome).toContain(caminho);
      expect(TELA, nome).toMatch(new RegExp(`<${nome}\\b`));
    }
  });

  it("card, tela, resumos e comemoração leem o MESMO hook da J11", () => {
    const usam: [string, RegExp][] = [
      [
        "components/home/JornadaCard.tsx",
        /^@\/components\/jornada\/useJornada$/,
      ],
      ["components/jornada/JornadaScreen.tsx", /^\.\/useJornada$/],
      [
        "components/jornada/celebracao/ComemoracaoHost.tsx",
        /^@\/components\/jornada\/useJornada$/,
      ],
    ];
    // Os resumos recebem o estado da tela (que lê o hook), sem um segundo
    // caminho de dados: nada de ler o servidor por fora.
    const tela = soCodigo(read("components/jornada/JornadaScreen.tsx"));
    expect(tela).toMatch(/<BotoesDosResumos\s+estado=\{estado\}/);
    expect(tela).toMatch(/<JornadaRecap\s+estado=\{estado\}/);
    const resumos = soCodigo(
      read("components/jornada/resumos/JornadaResumos.tsx")
    );
    expect(resumos).not.toMatch(/supabase|lojaDaUsuaria|transporte/);
    for (const [arquivo, caminho] of usam) {
      const imports = importsDe(soCodigo(read(arquivo)));
      expect(
        imports.some((i) => caminho.test(i)),
        arquivo
      ).toBe(true);
    }
    // E o hook fala com a loja da J11, que por padrão fala com o servidor.
    const hook = soCodigo(read("components/jornada/useJornada.ts"));
    expect(importsDe(hook)).toContain("@/lib/jornada/cliente");
    expect(soCodigo(read("lib/jornada/cliente.ts"))).toMatch(
      /const transporte = opcoes\.transporte \?\? transporteSupabase;/
    );
  });
});

describe("nenhum mock nem cópia do protótipo no app de verdade", () => {
  it("só /dev-preview usa os dados e o transporte de laboratório", () => {
    const usam = DO_APP.filter((f) =>
      /mockJornada|usarTransporteDeLaboratorio|criarTransporteJornadaLaboratorio/.test(
        soCodigo(read(f))
      )
    );
    // O cliente da J11 DEFINE o gancho (pro laboratório); ninguém mais o usa.
    expect(usam).toEqual(["lib/jornada/cliente.ts"]);
    expect(LAB).toMatch(/usarTransporteDeLaboratorio\(/);
  });

  it("nenhum arquivo do app importa o protótipo (ios-prototype ou referencias/)", () => {
    const importam = DO_APP.filter((f) =>
      importsDe(soCodigo(read(f))).some((i) =>
        /ios-prototype|jornada\/referencias|prototipo/.test(i)
      )
    );
    expect(importam).toEqual([]);
  });

  it("nenhum arquivo da Jornada carrega dado de exemplo do protótipo", () => {
    // Nomes e tabelas que só existem no protótipo aprovado
    // (docs/jornada/referencias/prototipo-sua-jornada.html).
    const doPrototipo =
      /\b(Bella|Sofia M\.|Lena|Jade)\b|GOALS\s*=|CH_SETS|var STAGES|Fundo Viagem|Curso de inglês/;
    for (const f of DA_JORNADA) {
      expect(soCodigo(read(f)), f).not.toMatch(doPrototipo);
    }
  });
});

describe("o card lê da semana uma chave que o servidor grava", () => {
  // Achado da J16: o card lia "semana_firme", que é o nome do SELO; o
  // contador da semana que a 0035 grava é "firme" (e "ritmo completo"
  // nunca aparecia). A lista sai da própria migration.
  const migration = read("supabase/migrations/0035_jornada_rpcs.sql");
  const daSemana = new Set(
    [
      ...migration.matchAll(
        /jornada_somar_periodo\(p_user, 'semana', '([a-z_]+)'/g
      ),
    ].map((m) => m[1])
  );

  it("toda chave de contadorDaSemana no card existe na semana do servidor", () => {
    expect(daSemana.size).toBeGreaterThan(0);
    const card = soCodigo(read("components/home/JornadaCard.tsx"));
    const lidas = [
      ...card.matchAll(/contadorDaSemana\(estado, "([a-z_]+)"\)/g),
    ].map((m) => m[1]);
    expect(lidas.length).toBeGreaterThan(0);
    // dias_fortes é somado em todos os períodos (a 0035 usa `t`, não 'semana').
    for (const chave of lidas.filter((c) => c !== "dias_fortes")) {
      expect(daSemana, chave).toContain(chave);
    }
    expect(migration).toMatch(
      /jornada_somar_periodo\(p_user, t, 'dias_fortes', 1\)/
    );
  });
});

describe("o laboratório espelha o app (é nele que a matriz da J16 roda)", () => {
  it.each([
    ["JornadaCard", "@/components/home/JornadaCard"],
    ["JornadaScreen", "@/components/jornada/JornadaScreen"],
    ["ComemoracaoHost", "@/components/jornada/celebracao/ComemoracaoHost"],
  ])(
    "/dev-preview/app importa %s do mesmo caminho e monta",
    (nome, caminho) => {
      expect(importsDe(LAB)).toContain(caminho);
      expect(LAB).toMatch(new RegExp(`<${nome}\\b`));
    }
  );
});
