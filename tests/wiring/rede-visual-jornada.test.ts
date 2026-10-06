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

  it("RedeTab monta o FeedScreen real e passa as amigas que já carrega", () => {
    expect(redeTab).toMatch(
      /^import \{ FeedScreen \} from "\.\/FeedScreen";$/m
    );
    const tag = redeTab.match(/<FeedScreen\b[\s\S]*?\/>/);
    expect(tag).not.toBeNull();
    expect(tag![0]).toContain("friends={friends.map((f) => f.id)}");
    expect(tag![0]).toContain("amigas={friends}");
  });

  it("FeedScreen monta o RedeHeader real", () => {
    expect(feed).toMatch(/^import \{ RedeHeader \} from "\.\/RedeHeader";$/m);
    expect(semComentarios(feed)).toMatch(/<RedeHeader\s/);
  });
});

describe("J06 — as duas abas do mockup", () => {
  const src = semComentarios(feed);

  it('"Para você" e "Amigas" são as abas, com o valor e o handler de antes', () => {
    expect(src).toContain('{ id: "paraVoce", label: "Para você" }');
    expect(src).toContain('{ id: "amigas", label: "Amigas" }');
    expect(src).toContain(
      "<AbasFeed segmento={segmento} onChange={onSegmentoChange} />"
    );
  });

  it("cada aba é um tab acessível e marca a selecionada", () => {
    expect(src).toContain('role="tablist"');
    expect(src).toContain('role="tab"');
    expect(src).toContain("aria-selected={ativa}");
    expect(src).toContain("onClick={() => onChange(aba.id)}");
  });
});

describe("J06 — o botão Postar e a fileira de amigas", () => {
  const src = semComentarios(feed);

  it('"Postar" é um botão que abre o composer de antes', () => {
    expect(src).toMatch(
      /<button\s+type="button"\s+onClick=\{onPostar\}[\s\S]{0,900}Postar\s*<\/span>/
    );
    expect(src).toMatch(
      /<FileiraAmigas\s+amigas=\{montado \? amigas : \[\]\}\s+onPostar=\{onOpenComposer\}\s+onOpenAmiga=\{onOpenAutor\}\s*\/>/
    );
  });

  it("a fileira mostra as amigas reais e tocar abre o perfil", () => {
    expect(src).toContain("{amigas.map((amiga) => (");
    expect(src).toContain("onClick={() => onOpenAmiga(amiga.id)}");
    expect(src).toContain('{amiga.nome.split(" ")[0]}');
  });

  it("a fileira só entra depois de montar (não soma diferença servidor x cliente ao #130)", () => {
    expect(src).toContain("const [montado, setMontado] = useState(false);");
    expect(src).toContain("useEffect(() => setMontado(true), []);");
  });

  it("a entrada antiga do composer saiu: o Postar é o único caminho, sem duplicar", () => {
    expect(src).not.toContain("Compartilhe algo");
    // Um único lugar da tela abre o composer.
    expect(src.match(/=\{onOpenComposer\}/g)).toHaveLength(1);
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
        "key",
        "onComment",
        "onOpenAutor",
        "onOpenMenu",
        "onRenovarFoto",
        "onShare",
        "onToggleLike",
        "post",
      ].sort()
    );
  });

  it("e o PostCard passa pra foto só dado e renovação de URL, nenhum toque", () => {
    const tag = read("components/rede/PostCard.tsx").match(
      /<FeedFotos\b[\s\S]*?\/>/
    );
    expect(tag).not.toBeNull();
    const props = [...tag![0].matchAll(/\s(\w+)=\{/g)].map((m) => m[1]).sort();
    expect(props).toEqual(["autorNome", "fotos", "onRenovarFoto", "postId"]);
  });
});

describe("J06 — cache e busca do feed não entraram nos arquivos de tela", () => {
  it("FeedScreen e RedeHeader só importam tipos de lib/rede, nunca funções", () => {
    // Sem comentários: o FeedScreen cita listarFeed na documentação das props.
    for (const src of [feed, header].map(semComentarios)) {
      for (const linha of src
        .split("\n")
        .filter((l) => /from "@\/lib\/rede/.test(l))) {
        expect(linha).toMatch(/^import type /);
      }
      expect(src).not.toMatch(
        /supabase|redeCache|listarFeed|listarAmigas|fetch\(/
      );
    }
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
