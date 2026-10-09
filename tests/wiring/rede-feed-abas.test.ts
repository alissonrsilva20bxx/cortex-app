import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMockAppSeed } from "../../lib/mockAppData";
import { formatoMaisProximo, type FormatoId } from "../../lib/rede/formatoFoto";

/**
 * Rede · proposta "Três abas, fotos no formato do Instagram"
 * (feed-rede.html; proporções confirmadas em feed-proporcoes.html).
 * Teste de fiação: afirma que a ligação EXISTE (o pedaço certo, montado no
 * lugar certo, com o handler de antes). O comportamento no navegador é
 * conferido por tests/visual/pixel/rede-feed.mjs; a lógica pura, por
 * tests/lib/redeFormatoFoto.test.ts e tests/lib/redeAbasFeed.test.ts.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");
const semComentarios = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const feed = semComentarios(read("components/rede/FeedScreen.tsx"));
const post = semComentarios(read("components/rede/PostCard.tsx"));
const header = semComentarios(read("components/rede/RedeHeader.tsx"));
const fotos = semComentarios(read("components/rede/FeedFotos.tsx"));
const redeTab = read("components/rede/RedeTab.tsx");

describe("as abas presas no topo ao rolar", () => {
  it("a casa guarda a altura da faixa (sem salto) e a faixa vira fixed quando passa do topo", () => {
    expect(feed).toContain("const ALTURA_ABAS = 47;");
    expect(feed).toMatch(
      /<div ref=\{casaRef\} style=\{\{ height: ALTURA_ABAS \}\}>/
    );
    expect(feed).toMatch(/position: presa \? "fixed" : "relative",/);
    expect(feed).toMatch(/left: presa \? presa\.left : undefined,/);
    expect(feed).toMatch(/width: presa \? presa\.width : undefined,/);
    expect(feed).toMatch(/r\.top < topo/);
  });

  it("ouve a rolagem de qualquer contêiner (captura) e o redimensionamento", () => {
    expect(feed).toMatch(
      /document\.addEventListener\("scroll", medir, \{\s*capture: true,\s*passive: true,\s*\}\);/
    );
    expect(feed).toMatch(/window\.addEventListener\("resize", medir\);/);
    expect(feed).toMatch(
      /document\.removeEventListener\("scroll", medir, \{ capture: true \}\);/
    );
  });

  it("aba escondida (display: none) nunca fica presa", () => {
    expect(feed).toMatch(
      /if \(!casa\.offsetParent\) \{\s*setPresa\(null\);\s*return;\s*\}/
    );
  });

  it("presa, a faixa cobre a área do relógio (notch)", () => {
    expect(feed).toMatch(
      /paddingTop: presa \? "env\(safe-area-inset-top, 0px\)" : undefined,/
    );
    expect(feed).toMatch(/const topo = areaSeguraTopo\(\);/);
  });
});

describe("Amigas: novas desde a última visita", () => {
  it("ao abrir a aba, a visita de antes vira o corte e a de agora é gravada", () => {
    expect(feed).toMatch(
      /if \(!\(segmento === "amigas" && ativa\)\) return;\s*const anterior = lerUltimaVisitaAmigas\(usuario\.id\);\s*setCorte\(anterior\);\s*const agora = new Date\(\);\s*gravarVisitaAmigas\(usuario\.id, agora\);/
    );
  });

  // Revisão da #218: com a Rede escondida (outra aba aberta, ou o remonte
  // que a trava de PIN do app causa), a visita era gravada sem ninguém ter
  // visto a aba -- as novas caíam em "Já visto" e o número zerava.
  it("só grava a visita com a Rede na tela: o efeito depende de `ativa`", () => {
    expect(feed).toMatch(/\bativa: boolean;/);
    expect(feed).toMatch(/\}, \[segmento, ativa, usuario\.id\]\);/);
    // nenhuma outra gravação da visita fora desse efeito
    expect(feed.match(/gravarVisitaAmigas\(/g) ?? []).toHaveLength(1);
  });

  it('a flag vem do `active` do RedeTab (o mesmo que a página passa como activeTab === "rede")', () => {
    expect(redeTab).toMatch(/<FeedScreen[\s\S]*?ativa=\{active\}/);
    const gated = read("components/rede/RedeGatedTab.tsx");
    expect(gated).toMatch(/<RedeTab[\s\S]*?active=\{active\}/);
    const page = read("app/page.tsx");
    expect(page).toMatch(
      /<RedeGatedTab[\s\S]{0,120}active=\{activeTab === "rede"\}/
    );
    // o laboratório espelha a página (era o que deixava a falha invisível lá)
    const lab = read("app/dev-preview/app/page.tsx");
    expect(lab).toMatch(
      /<RedeGatedTab[\s\S]{0,300}active=\{activeTab === "rede"\}/
    );
  });

  it("o número da aba conta as novas desde a última visita, e só fora dela", () => {
    expect(feed).toMatch(
      /const novasAmigas = contarNovasDasAmigas\(posts, friends, ultimaVisita\);/
    );
    expect(feed).toMatch(
      /const numero = id === "amigas" && !ativa \? novasAmigas : 0;/
    );
  });

  it("a lista se divide em novas e já vistas pelo corte", () => {
    expect(feed).toMatch(
      /const \{ novas, vistas, dividir \} = separarNovas\(daAmigas, corte\);/
    );
    expect(feed).toContain(
      "<Divisor>Novas desde a sua última visita</Divisor>"
    );
    expect(feed).toContain("<Divisor>Já visto</Divisor>");
  });
});

describe("Descobrir: pessoas e dicas da semana", () => {
  it("mostra as sugestões reais, até 4, com o mesmo Adicionar da tela Amigas", () => {
    expect(feed).toContain("const PESSOAS_NO_DESCOBRIR = 4;");
    expect(feed).toMatch(
      /const pessoas = sugestoes\.slice\(0, PESSOAS_NO_DESCOBRIR\);/
    );
    expect(feed).toMatch(/enviado=\{sentRequests\.includes\(p\.id\)\}/);
    expect(feed).toMatch(/onAdicionar=\{\(\) => onSendRequest\(p\.id\)\}/);
    expect(feed).toMatch(/onAbrir=\{\(\) => onOpenAutor\(p\.id\)\}/);
    expect(feed).toMatch(/\{enviado \? "Pedido enviado" : "Adicionar"\}/);
    expect(feed).toMatch(/disabled=\{enviado\}/);
  });

  it("as dicas da semana vêm de dicasDaSemana(posts)", () => {
    expect(feed).toMatch(/const dicas = dicasDaSemana\(posts\);/);
    expect(feed).toContain(
      "<TituloSecao>Dicas mais curtidas da semana</TituloSecao>"
    );
  });

  it("o RedeTab entrega sugestões, pedidos enviados e o sendRequest de antes", () => {
    expect(redeTab).toMatch(/async function sendRequest\(userId: string\)/);
    const tag = redeTab.match(/<FeedScreen\b[\s\S]*?\/>/)?.[0] ?? "";
    expect(tag).toContain("onSendRequest={(id) => void sendRequest(id)}");
  });

  it("a aba lembrada aceita as 3 (redeCache)", () => {
    const cache = read("lib/rede/redeCache.ts");
    expect(cache).toMatch(/let segmento: AbaFeed = "paraVoce";/);
    expect(redeTab).toMatch(/useState<AbaFeed>\(\(\) =>/);
  });
});

describe("cabeçalho: o ícone de pessoas leva a Amigas", () => {
  it("RedeHeader monta o ícone com o número de pedidos e abre Amigas", () => {
    expect(header).toMatch(
      /\{onOpenAmigas && \(\s*<IconButton\s+onClick=\{onOpenAmigas\}\s+label="Amigas, solicitações e descobrir pessoas"\s+badge=\{pendingRequestsCount\}/
    );
    expect(feed).toMatch(
      /<RedeHeader[\s\S]*?onOpenAmigas=\{onOpenAmigas\}\s+pendingRequestsCount=\{pendingRequestsCount\}/
    );
  });
});

describe("o post no desenho da proposta", () => {
  it("cabeçalho de 44, avatar de 36, nome que abre o perfil", () => {
    expect(post).toMatch(/padding: "0 12px 0 16px", minHeight: 44/);
    expect(post).toMatch(/tamanho=\{36\}/);
    expect(post).toMatch(
      /<button\s+type="button"\s+onClick=\{\(\) => onOpenAutor\(post\.autorId\)\}/
    );
  });

  it("'· amiga' só quando a autora é amiga", () => {
    expect(post).toMatch(/\{amiga \? " · amiga" : ""\}/);
    expect(feed).toMatch(/amiga=\{friends\.includes\(post\.autorId\)\}/);
  });

  it("as ações mostram a contagem real ao lado e chamam os handlers de antes", () => {
    expect(post).toMatch(
      /count=\{post\.curtidas\}\s+active=\{post\.curtidoPorMim\}\s+onClick=\{\(\) => onToggleLike\(post\.id\)\}/
    );
    expect(post).toMatch(
      /count=\{post\.comentariosCount\}\s+onClick=\{\(\) => onComment\(post\)\}/
    );
    expect(post).toMatch(/onClick=\{\(\) => onShare\(post\)\}/);
    expect(post).toMatch(/onClick=\{\(\) => onOpenMenu\(post\)\}/);
    expect(post).toMatch(/minHeight: 44,/);
  });

  it("com foto: legenda depois das ações; sem foto: o texto maior antes delas", () => {
    expect(post).toMatch(
      /\{temFoto \? \([\s\S]*?<FeedFotos[\s\S]*?\) : \(\s*<p\s+data-post-texto=""/
    );
    expect(post).toMatch(/\{temFoto && \(\s*<p\s+data-post-legenda=""/);
  });

  it("40px entre os posts: 18 em cima, 22 embaixo e a faixa de 8 no meio", () => {
    expect(post).toMatch(/style=\{\{ padding: "18px 0 22px" \}\}/);
    expect(feed).toMatch(
      /style=\{i > 0 \? \{ borderTop: "8px solid var\(--t-sub\)" \} : undefined\}/
    );
  });
});

describe("o carrossel e as marcas do formato", () => {
  it("o quadro marca o formato escolhido (data-formato) e o carrossel (data-carrossel)", () => {
    expect(fotos).toMatch(/data-formato=\{formato\.id\}/);
    expect(fotos).toMatch(/data-carrossel=""/);
  });

  it("a 1ª foto usa o encaixe pela proporção nativa; sem ela, aparece inteira", () => {
    expect(fotos).toMatch(
      /ratioNativo == null\s*\?\s*"inteira"\s*:\s*encaixeNoQuadro\(ratioNativo, formato\.ratio\)/
    );
  });

  it("o contador e as setas são anunciados (aria-live, aria-label)", () => {
    expect(fotos).toMatch(/aria-live="polite"\s+data-contador=""/);
    expect(fotos).toMatch(/aria-roledescription="carrossel"/);
  });
});

describe("laboratório: fotos de exemplo nos 4 formatos, no teto do banco", () => {
  const seed = buildMockAppSeed();
  const linhas = seed.tables.rede_post_fotos as Array<{
    post_id: string;
    thumb_path: string;
    ordem: number;
  }>;
  const formatoDe = (thumb: string): FormatoId => {
    const [, w, h] = thumb.match(/-thumb-(\d+)x(\d+)\.jpg$/) ?? [];
    return formatoMaisProximo(Number(w) / Number(h)).id;
  };

  it("há post em cada um dos 4 formatos", () => {
    const formatos = new Set(linhas.map((l) => formatoDe(l.thumb_path)));
    expect([...formatos].sort()).toEqual(["1,91:1", "16:9", "1:1", "4:5"]);
  });

  it("no máximo 2 fotos por post, com ordem 1 e 2 (migration 0028)", () => {
    const porPost = new Map<string, number[]>();
    for (const l of linhas)
      porPost.set(l.post_id, [...(porPost.get(l.post_id) ?? []), l.ordem]);
    for (const ordens of porPost.values()) {
      expect(ordens.length).toBeLessThanOrEqual(2);
      expect(ordens.every((o) => o === 1 || o === 2)).toBe(true);
    }
    expect([...porPost.values()].some((o) => o.length === 2)).toBe(true);
  });

  it("toda foto de exemplo é um SVG local (nunca Storage de verdade)", () => {
    const arquivos = seed.cofreFiles.filter((f) =>
      f.path.includes("/posts/")
    ) as Array<{ blobUrl?: string }>;
    expect(arquivos.length).toBe(linhas.length * 2);
    for (const a of arquivos)
      expect(a.blobUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it("Descobrir tem gente sem relação nenhuma no laboratório", () => {
    const perfis = seed.tables.rede_perfis as Array<{ user_id: string }>;
    expect(perfis.map((p) => p.user_id)).toEqual(
      expect.arrayContaining(["mock-descobrir-rita", "mock-descobrir-nina"])
    );
  });
});
