import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Jornada J06 (#156) — a Rede no visual do mockup aprovado
 * (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html), mexendo só
 * em RedeTab, RedeHeader e FeedScreen. Teste de fiação: lê o fonte e afirma
 * que a ligação EXISTE (import do caminho real + montagem + handler certo),
 * que o feed não ganhou visualizador de foto e que nada de cache/busca
 * entrou no FeedScreen. Cada guarda foi validada apagando ou trocando a
 * fiação (ver o PR).
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

/** Fonte sem comentários. */
function semComentarios(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const feed = read("components/rede/FeedScreen.tsx");
const header = read("components/rede/RedeHeader.tsx");
const redeTab = read("components/rede/RedeTab.tsx");

describe("J06 — os componentes reais da Rede estão montados", () => {
  for (const pagina of ["app/page.tsx", "app/dev-preview/app/page.tsx"]) {
    it(`${pagina}: importa RedeGatedTab do caminho real e monta no painel da Rede`, () => {
      const src = read(pagina);
      expect(src).toMatch(
        /^import \{ RedeGatedTab \} from "@\/components\/rede\/RedeGatedTab";$/m
      );
      const start = src.indexOf('<TabPanel tab="rede"');
      const painel = src.slice(start, src.indexOf("</TabPanel>", start));
      expect(painel).toMatch(/<RedeGatedTab\s/);
    });
  }

  it("RedeGatedTab monta o RedeTab real", () => {
    const src = read("components/rede/RedeGatedTab.tsx");
    expect(src).toMatch(/^import \{ RedeTab \} from "\.\/RedeTab";$/m);
    expect(src).toMatch(/<RedeTab\s/);
  });

  it("RedeTab monta o FeedScreen real e passa as amigas e as sugestões que já carrega", () => {
    expect(redeTab).toMatch(
      /^import \{ FeedScreen \} from "\.\/FeedScreen";$/m
    );
    const tag = redeTab.match(/<FeedScreen\b[\s\S]*?\/>/);
    expect(tag).not.toBeNull();
    expect(tag![0]).toContain("friends={friends.map((f) => f.id)}");
    // Descobrir (proposta "Três abas"): as mesmas sugestões e o mesmo
    // "Adicionar" da tela Amigas.
    expect(tag![0]).toContain("sugestoes={sugestoes}");
    expect(tag![0]).toContain("sentRequests={sentRequests}");
    expect(tag![0]).toContain("onSendRequest={(id) => void sendRequest(id)}");
    // A fileira estilo stories saiu: nem as amigas para ela, nem o Postar.
    expect(tag![0]).not.toContain("amigas={friends}");
    expect(tag![0]).not.toContain("onOpenComposer");
  });

  it("FeedScreen monta o RedeHeader real", () => {
    expect(feed).toMatch(/^import \{ RedeHeader \} from "\.\/RedeHeader";$/m);
    expect(semComentarios(feed)).toMatch(/<RedeHeader\s/);
  });
});

describe('Proposta "Três abas" — as 3 abas no lugar da fileira de stories', () => {
  const src = semComentarios(feed);

  it("Para você, Amigas e Descobrir vêm de ABAS_FEED, com o valor e o handler de antes", () => {
    const abas = read("lib/rede/abasFeed.ts");
    expect(abas).toContain('{ id: "paraVoce", rotulo: "Para você" }');
    expect(abas).toContain('{ id: "amigas", rotulo: "Amigas" }');
    expect(abas).toContain('{ id: "descobrir", rotulo: "Descobrir" }');
    expect(src).toContain("{ABAS_FEED.map(({ id, rotulo }) => {");
    expect(src).toMatch(
      /<Abas3\s+aba=\{segmento\}\s+novasAmigas=\{novasAmigas\}\s+onChange=\{onSegmentoChange\}\s*\/>/
    );
  });

  it("cada aba é um tab acessível e marca a selecionada", () => {
    expect(src).toContain('role="tablist"');
    expect(src).toContain('role="tab"');
    expect(src).toContain("aria-selected={ativa}");
    expect(src).toContain("onClick={() => onChange(id)}");
  });

  it("a fileira de amigas estilo stories e o Postar dela saíram do feed", () => {
    expect(src).not.toMatch(/FileiraAmigas|onOpenComposer|onPostar/);
    expect(src).not.toMatch(/>\s*Postar\s*</);
    // O "Postar" fica no "+" da barra (o sinal `postarSignal` do RedeTab).
    expect(redeTab).toMatch(/setComposerOpen\(true\)/);
  });
});

describe("J06 — foto do feed continua sem visualizador (decisão de 2026-09-10)", () => {
  it("FeedScreen não importa nem passa nenhum visualizador de foto", () => {
    expect(feed).not.toMatch(
      /ProfilePhotoViewer|FotoViewer|onAbrirViewer|onOpenFoto|abrirFoto|Lightbox/i
    );
  });

  it("o PostCard que o FeedScreen monta recebe só os handlers de antes", () => {
    const tag = semComentarios(feed).match(/<PostCard\b[\s\S]*?\/>/);
    expect(tag).not.toBeNull();
    const props = [...tag![0].matchAll(/\s(\w+)=\{/g)].map((m) => m[1]).sort();
    expect(props).toEqual(
      [
        // `amiga` é DADO (a autora é amiga: "· amiga" na linha do tempo).
        "amiga",
        "onComment",
        "onOpenAutor",
        "onOpenMenu",
        "onRenovarFoto",
        "onShare",
        "onToggleLike",
        "post",
      ].sort()
    );
    // O que esta guarda protege: nenhum handler NOVO entra no post.
    expect(props.filter((n) => n.startsWith("on")).sort()).toEqual([
      "onComment",
      "onOpenAutor",
      "onOpenMenu",
      "onRenovarFoto",
      "onShare",
      "onToggleLike",
    ]);
  });

  it("e o PostCard passa pra foto só dado e renovação de URL, nenhum toque", () => {
    const tag = read("components/rede/PostCard.tsx").match(
      /<FeedFotos\b[\s\S]*?\/>/
    );
    expect(tag).not.toBeNull();
    // Prop com chaves (`x={...}`) ou com texto fixo (`tom="var(--t-sub)"`).
    const props = [...tag![0].matchAll(/\s(\w+)=[{"]/g)]
      .map((m) => m[1])
      .sort();
    // `tom` é dado (a cor do espaço da foto), não toque.
    expect(props).toEqual([
      "autorNome",
      "fotos",
      "onRenovarFoto",
      "postId",
      "tom",
    ]);
    // O que esta guarda protege: a foto do feed NÃO é interativa.
    expect(props.filter((n) => n.startsWith("on"))).toEqual(["onRenovarFoto"]);
  });
});

describe("J06 — cache e busca do feed não entraram nos arquivos de tela", () => {
  it("FeedScreen e RedeHeader só importam tipos de lib/rede, nunca funções", () => {
    // Sem comentários: o FeedScreen cita listarFeed na documentação das props.
    for (const src of [feed, header].map(semComentarios)) {
      for (const linha of src
        .split("\n")
        .filter((l) => /from "@\/lib\/rede/.test(l))) {
        // A única exceção é a lógica pura das abas (abasFeed), que não
        // busca nada: ela mesma só importa tipos (conferido abaixo).
        if (linha.includes('"@/lib/rede/abasFeed"')) continue;
        expect(linha).toMatch(/^import type /);
      }
      expect(src).not.toMatch(
        /supabase|redeCache|listarFeed|listarAmigas|fetch\(/
      );
    }
    const abas = semComentarios(read("lib/rede/abasFeed.ts"));
    for (const linha of abas.split("\n").filter((l) => /^import /.test(l)))
      expect(linha).toMatch(/^import type /);
    expect(abas).not.toMatch(/supabase|redeCache|listarFeed|fetch\(/);
  });
});

describe("J06 — nada do mockup no código", () => {
  const DO_MOCKUP = [
    "Amiga 1",
    "Amiga 2",
    "Juliana",
    "12 curtidas",
    "Fechei a agenda",
    "há 3h",
    "Miguel",
  ];
  for (const [nome, src] of [
    ["FeedScreen.tsx", feed],
    ["RedeHeader.tsx", header],
  ] as const) {
    it(`${nome} não traz nenhum valor do mockup`, () => {
      for (const v of DO_MOCKUP) expect(src, v).not.toContain(v);
    });
  }
});
