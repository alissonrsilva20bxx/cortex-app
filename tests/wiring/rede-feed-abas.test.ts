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
    expect(feed).toContain("const ALTURA_ABAS = 64;");
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

  it("presa, a faixa cobre a área do relógio (notch); a pílula para logo abaixo dela", () => {
    expect(feed).toMatch(
      /paddingTop: presa \? "env\(safe-area-inset-top, 0px\)" : undefined,/
    );
    expect(feed).toMatch(/const topo = areaSeguraTopo\(\) \+ deslocamento;/);
    expect(feed).toMatch(/useAbasPresas\(ALTURA_ABAS \+ 6\)/);
  });

  it("modelo Doca: trilho com o fundo da aba ativa deslizando até ela", () => {
    expect(feed).toMatch(/data-indicador-aba=""/);
    expect(feed).toMatch(/transform: `translateX\(\$\{indice \* 100\}%\)`/);
    expect(feed).toMatch(
      /const indice = Math\.max\(\s*0,\s*ABAS_FEED\.findIndex\(\(a\) => a\.id === aba\)\s*\);/
    );
  });
});

describe("Amigas: novas desde a última visita", () => {
  it("ao abrir a aba, a visita de antes vira o corte e a de agora é gravada", () => {
    expect(feed).toMatch(
      /if \(!\(segmento === "amigas" && ativa\)\) return;\s*const anterior = lerUltimaVisitaAmigas\(usuario\.id\);\s*setCorte\(anterior\);\s*setPilulaFechada\(false\);\s*const agora = new Date\(\);\s*gravarVisitaAmigas\(usuario\.id, agora\);/
    );
  });

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
      "<Divisor marca>Novas desde a sua última visita</Divisor>"
    );
    expect(feed).toContain("<Divisor>Já visto</Divisor>");
  });

  it('pílula "N novas": só na aba Amigas, conta as das amigas desde o corte e leva até o divisor', () => {
    expect(feed).toMatch(
      /const nPilula = dividir\s*\?\s*contarNovasDasAmigas\(daAmigas, friends, corte\)\s*:\s*0;/
    );
    expect(feed).toMatch(
      /\{nPilula > 0 && !pilulaFechada && \(\s*<PilulaNovas n=\{nPilula\} onIr=\{irParaNovas\} \/>/
    );
    // só um lugar monta a pílula, e é dentro do ramo da aba Amigas
    expect(feed.match(/<PilulaNovas /g) ?? []).toHaveLength(1);
    const ramoAmigas = feed.slice(
      feed.indexOf('} else if (segmento === "amigas") {'),
      feed.indexOf('} else if (segmento === "descobrir") {')
    );
    expect(ramoAmigas).toContain("<PilulaNovas ");
    expect(feed).toMatch(/data-novas=\{marca \? "" : undefined\}/);
    expect(feed).toMatch(
      /function irParaNovas\(\) \{\s*setPilulaFechada\(true\);\s*const alvo = document\.querySelector<HTMLElement>\("\[data-novas\]"\);/
    );
  });
});

describe('Descobrir: "O melhor da semana" (só dicas)', () => {
  it("as dicas vêm de dicasDaSemana(posts), numeradas, sem tabela nova", () => {
    expect(feed).toMatch(/const dicas = dicasDaSemana\(posts\);/);
    expect(feed).toContain("O melhor da semana");
    expect(feed).toContain("As dicas mais curtidas dos últimos 7 dias");
    expect(feed).toMatch(/lista\(soPosts\(dicas\), true\)/);
  });

  it("as pessoas para conhecer saíram do Descobrir (repetiam a tela Amigas)", () => {
    expect(feed).not.toMatch(/Pessoas para conhecer|CartaoPessoa|sugestoes/);
    expect(feed).not.toMatch(/onSendRequest|sentRequests/);
    // ...e continuam na tela Amigas, com o mesmo "Adicionar".
    const tagAmigas = redeTab.match(/<AmigasScreen\b[\s\S]*?\/>/)?.[0] ?? "";
    expect(tagAmigas).toContain("sugestoes={sugestoes}");
    expect(tagAmigas).toContain("onSendRequest={sendRequest}");
  });

  it("a aba lembrada aceita as 3 (redeCache)", () => {
    const cache = read("lib/rede/redeCache.ts");
    expect(cache).toMatch(/let segmento: AbaFeed = "paraVoce";/);
    expect(redeTab).toMatch(/useState<AbaFeed>\(\(\) =>/);
  });
});

describe("modelo Doca: o topo de toda tela e a barra da Rede", () => {
  const topo = semComentarios(read("components/rede/RedeTopo.tsx"));
  const doca = semComentarios(read("components/rede/DocaBar.tsx"));

  it("o cabeçalho do Feed é casinha, título e os atalhos (lupa, sino, foto)", () => {
    expect(header).toMatch(/<BotaoSairDaRede \/>/);
    expect(header).toMatch(/<AtalhosTopo \/>/);
    expect(feed).toMatch(/<RedeHeader \/>/);
    expect(topo).toMatch(/label="Buscar" onClick=\{topo\.onBuscar\}/);
    expect(topo).toMatch(
      /label="Notificações"\s+onClick=\{topo\.onNotificacoes\}/
    );
    expect(topo).toMatch(/data-tour="rede-perfil"/);
    expect(topo).toMatch(/onClick=\{topo\.onMeuEspaco\}/);
  });

  it("a foto da usuária está no cabeçalho de toda subtela e na conversa aberta", () => {
    const sh = read("components/rede/ScreenHeader.tsx");
    expect(sh).toMatch(
      /\{raiz \? <AtalhosTopo semBusca=\{!!action\} \/> : <BotaoFotoPerfil \/>\}/
    );
    expect(read("components/rede/ChatThreadScreen.tsx")).toMatch(
      /<BotaoFotoPerfil \/>/
    );
  });

  it("o RedeTab monta o contexto com os handlers reais (busca, notificações, Meu espaço)", () => {
    expect(redeTab).toMatch(/<RedeTopoContext\.Provider value=\{topo\}>/);
    expect(redeTab).toMatch(/onBuscar: \(\) => push\(\{ type: "busca" \}\),/);
    expect(redeTab).toMatch(
      /onNotificacoes: \(\) => \{\s*revalidarSocial\(\);\s*setNotifSheetOpen\(true\);\s*\},/
    );
    expect(redeTab).toMatch(/: irPelaDoca\("meuEspaco"\),/);
  });

  it("a barra tem Feed, Conversas, Publicar, Amigas e Eu, com os números reais", () => {
    expect(doca).toMatch(/item\("feed", "Feed"/);
    expect(doca).toMatch(
      /item\("chatList", "Conversas", <IconeConversas \/>, naoLidas\)/
    );
    expect(doca).toMatch(
      /item\("amigas", "Amigas", <IconeAmigas \/>, pedidos\)/
    );
    expect(doca).toMatch(/item\(\s*"meuEspaco",\s*"Eu",/);
    expect(doca).toMatch(/aria-label="Publicar"/);
    const tag = redeTab.match(/<DocaBar\b[\s\S]*?\/>/)?.[0] ?? "";
    expect(tag).toContain("naoLidas={unreadChats}");
    expect(tag).toContain("pedidos={requests.length}");
    expect(tag).toContain("onIr={irPelaDoca}");
    expect(tag).toContain("onPublicar={() => setComposerOpen(true)}");
    // some na conversa aberta (ela tem o próprio campo embaixo)
    expect(redeTab).toMatch(
      /\{barraDoca && screen\.type !== "chatThread" && \(\s*<DocaBar/
    );
  });

  it("a página troca a barra do app pela da Rede só com a Rede liberada na tela", () => {
    for (const pagina of ["app/page.tsx", "app/dev-preview/app/page.tsx"]) {
      const src = read(pagina);
      expect(src).toMatch(
        /const redeDocaNaTela =\s*activeTab === "rede" && redeAcesso === "liberado" && !tourOpen;/
      );
      expect(src).toMatch(/onSairDaRede=\{\(\) => handleTabChange\("home"\)\}/);
      expect(src).toMatch(/barraDoca=\{!tourOpen\}/);
    }
  });
});

describe("o post no desenho do modelo Doca", () => {
  it("cartão com a autora (avatar de 44 e nome que abrem o perfil)", () => {
    expect(post).toMatch(/borderRadius: 22,/);
    expect(post).toMatch(
      /tamanho=\{44\}\s+onClick=\{\(\) => onOpenAutor\(post\.autorId\)\}/
    );
    expect(post).toMatch(
      /<button\s+type="button"\s+onClick=\{\(\) => onOpenAutor\(post\.autorId\)\}/
    );
  });

  it("'· amiga' só quando a autora é amiga", () => {
    expect(post).toMatch(/\{amiga \? " · amiga" : ""\}/);
    expect(feed).toMatch(/amiga=\{friends\.includes\(post\.autorId\)\}/);
  });

  it("as ações mostram a contagem real ao lado e chamam os handlers de antes", () => {
    expect(post).toMatch(/onClick=\{curtir\}/);
    expect(post).toMatch(/onToggleLike\(post\.id\);/);
    expect(post).toMatch(/\{post\.curtidas\}/);
    expect(post).toMatch(/onClick=\{\(\) => onComment\(post\)\}/);
    expect(post).toMatch(/\{post\.comentariosCount\}/);
    expect(post).toMatch(/onClick=\{\(\) => onShare\(post\)\}/);
    expect(post).toMatch(/onClick=\{\(\) => onOpenMenu\(post\)\}/);
    expect(post).toMatch(/minHeight: 44,/);
  });

  it("o par de fotos vai para o leque; uma foto, para o FeedFotos", () => {
    expect(post).toMatch(/\{nFotos >= 2 \? \(\s*<LequeFotos/);
    expect(post).toMatch(/\) : nFotos === 1 \? \(/);
    const leque = semComentarios(read("components/rede/LequeFotos.tsx"));
    expect(leque).toMatch(/aria-expanded=\{aberto\}/);
    expect(leque).toMatch(/<PhotoStage/);
    expect(leque).not.toMatch(/Antes|Depois/);
  });

  it("curtir solta partículas (só ao curtir, nunca ao descurtir)", () => {
    expect(post).toMatch(
      /\{festa > 0 && post\.curtidoPorMim && <Particulas key=\{festa\} \/>\}/
    );
    expect(post).toMatch(/if \(!post\.curtidoPorMim\) \{\s*setFesta/);
    const css = read("components/rede/doca.module.css");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.particulas,/
    );
  });

  it("12px entre os cartões", () => {
    expect(feed).toMatch(/style=\{\{ gap: 12, padding: "0 14px" \}\}/);
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
