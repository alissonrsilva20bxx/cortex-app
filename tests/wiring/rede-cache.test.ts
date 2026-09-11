import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Fiação do cache SWR da Rede (`lib/rede/redeCache.ts` +
 * `redeCachePersist.ts`). Teste de código-fonte, mesmo padrão dos
 * `*-visual.test.ts` -- o projeto não roda RTL/JSX no vitest, então ler os
 * arquivos como texto pega a regressão que importa: semeadura do cache
 * removida, skeleton voltando com dados em tela, mutação sem write-through,
 * limpeza no logout sumindo, restauração de rolagem mexendo em outra aba.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("RedeTab semeia estado do cache (sem skeleton no remount)", () => {
  const src = read("components/rede/RedeTab.tsx");

  it("importa os dois módulos de cache", () => {
    expect(src).toMatch(/from "@\/lib\/rede\/redeCache"/);
    expect(src).toMatch(/from "@\/lib\/rede\/redeCachePersist"/);
  });

  it("calcula a semente no 1º render e vincula a conta antes de ler", () => {
    expect(src).toMatch(/redeCache\.vincularUsuario\(usuario\.id\)/);
    expect(src).toMatch(/redeCache\.lerFeed\(usuario\.id\)/);
    // cold start: cai no localStorage
    expect(src).toMatch(/redeCachePersist\.carregar\(usuario\.id\)/);
  });

  it("feedLoading só nasce true em cache miss (não com semente)", () => {
    expect(src).toMatch(/useState\(\(\) => semente\.feed === null\)/);
    expect(src).toMatch(
      /useState<FeedPost\[\]>\(\s*\(\) => semente\.feed\?\.posts \?\? \[\]\s*\)/
    );
  });

  it("a busca do feed vira refresh: reconcilia e não liga o skeleton com semente", () => {
    expect(src).toMatch(/redeCache\.reconciliarFeed\(/);
    expect(src).toMatch(/const temSemente = semente\.feed !== null/);
    // falha de rede com feed cacheado: não vira erro duro (req 4)
    expect(src).toMatch(
      /if \(temSemente\) \{\s*setFeedLoading\(false\);\s*return;/
    );
  });

  it("perfil, amigas, conversas e notificações também são semeados", () => {
    expect(src).toMatch(/semente\.perfil\?\.perfil \?\? null/);
    expect(src).toMatch(/semente\.amigas\?\.friends \?\? \[\]/);
    expect(src).toMatch(/\(\) => semente\.conversas \?\? \[\]/);
    expect(src).toMatch(/\(\) => semente\.notificacoes \?\? \[\]/);
  });
});

describe("write-through nas mutações (req 6)", () => {
  const src = read("components/rede/RedeTab.tsx");

  it("aplicarPosts espelha setPosts no cache em memória", () => {
    expect(src).toMatch(
      /const aplicarPosts = useCallback\(\s*\(updater[\s\S]*?redeCache\.mutarFeed\(usuario\.id, updater\)/
    );
  });

  it("excluir tomba o post (não ressuscita) e re-persiste", () => {
    expect(src).toMatch(/redeCache\.marcarExcluido\(postId\)/);
  });

  it("curtir marca like pendente e o remove no finally", () => {
    expect(src).toMatch(/likesPendentes\.current\.add\(id\)/);
    expect(src).toMatch(/likesPendentes\.current\.delete\(id\)/);
  });

  it("editar perfil/avatar sincroniza cache do perfil + posts do autor + invalida o feed", () => {
    expect(src).toMatch(/function sincronizarPerfilNoCache/);
    expect(src).toMatch(/redeCache\.invalidarFeed\(usuario\.id\)/);
    // as 3 chamadas de perfil passam pelo sincronizador (não setPerfil cru)
    expect(src).toMatch(/sincronizarPerfilNoCache\(updated\)/);
    expect(src).not.toMatch(/setPerfil\(updated\)/);
  });

  it("publicar e excluir re-gravam a camada persistida", () => {
    const salvar = src.match(/redeCachePersist\.salvar\(/g) ?? [];
    // perfil-effect + feed-refresh + publish + delete + sincronizarPerfil
    expect(salvar.length).toBeGreaterThanOrEqual(5);
  });
});

describe("restauração de rolagem só quando a Rede está ativa (req 1 e 2)", () => {
  const src = read("components/rede/RedeTab.tsx");

  it("grava a rolagem só enquanto active && no feed", () => {
    expect(src).toMatch(/if \(!active \|\| screen\.type !== "feed"\) return;/);
    expect(src).toMatch(/redeCache\.lembrarScroll\(window\.scrollY\)/);
  });

  it("restaura uma vez por mount, com active e conteúdo pronto, via layout effect", () => {
    expect(src).toMatch(/const scrollRestaurado = useRef\(false\)/);
    expect(src).toMatch(/useIsomorphicLayoutEffect/);
    expect(src).toMatch(/if \(posts\.length === 0\) return;/);
    expect(src).toMatch(/window\.scrollTo\(0, y\)/);
  });

  it('app/page.tsx passa active={activeTab === "rede"} pro RedeGatedTab', () => {
    const page = read("app/page.tsx");
    expect(page).toMatch(/active=\{activeTab === "rede"\}/);
  });
});

describe("acesso: cache é apresentação, nunca autorização (req 3)", () => {
  const src = read("components/rede/RedeGatedTab.tsx");

  it("renderiza o Feed na hora com acesso lembrado, mas ainda revalida", () => {
    expect(src).toMatch(/redeCache\.acessoLembrado\(usuario\.id\)/);
    expect(src).toContain("verificarAcessoConvite(supabase, usuario.id)");
  });

  it("resultado indeterminado (offline/5xx/sessão) NÃO rebaixa nem limpa (req 4)", () => {
    expect(src).toMatch(
      /if \(resultado\.indeterminado\) \{[\s\S]*?setVerificandoAcesso\(false\);\s*return;/
    );
  });

  it("resposta conclusiva de 'sem convite' descarta memória + localStorage (req 3)", () => {
    expect(src).toMatch(
      /redeCache\.limparTudo\(\);\s*redeCachePersist\.limpar\(usuario\.id\)/
    );
  });

  it("revalida quando a aba volta a ficar visível (revogação com o PWA em 2º plano)", () => {
    expect(src).toMatch(/addEventListener\("visibilitychange"/);
    expect(src).toMatch(/document\.visibilityState !== "visible"/);
  });

  it("acesso.ts classifica pelo status: só 200+vazio é conclusivo, o resto é indeterminado", () => {
    const ac = read("lib/rede/acesso.ts");
    // offline real chega como status 0 numa promise RESOLVIDA, não rejeitada
    expect(ac).toMatch(/status === 0.*return "transporte"/);
    expect(ac).toMatch(/status >= 500.*return "servidor"/);
    expect(ac).toMatch(/status === 401 \|\| status === 403.*return "sessao"/);
    // o único ramo que devolve unlocked:false SEM indeterminado além do 4xx
    // é o 200 + data vazio
    expect(ac).toMatch(/return \{ unlocked: !!\(data && data\.length > 0\) \}/);
  });
});

describe("proteção por época barra setState tardio da conta anterior (req 2)", () => {
  const src = read("components/rede/RedeTab.tsx");

  it("cada resposta em voo checa a época antes de tocar estado OU cache", () => {
    expect(src).toMatch(
      /const epocaValida = useCallback\(\s*\(ep: number\) => redeCache\.epocaAtual\(\) === ep/
    );
    // usado nos 5 fetches (feed .then/.catch, perfil x2, amigas, conversas,
    // notificações) + loadMorePosts
    const usos = src.match(/!epocaValida\(ep\)/g) ?? [];
    expect(usos.length).toBeGreaterThanOrEqual(7);
  });
});

describe("logout limpa o cache da Rede (req 4/6)", () => {
  it("handleSignOut zera memória e localStorage antes de sair", () => {
    const page = read("app/page.tsx");
    expect(page).toMatch(
      /handleSignOut[\s\S]*?redeCache\.limparTudo\(\);\s*redeCachePersist\.limpar\(\);[\s\S]*?supabase\.auth\.signOut\(\)/
    );
  });
});

describe("FeedScreen: skeleton só em cache miss", () => {
  const src = read("components/rede/FeedScreen.tsx");

  it("skeleton exige loading && posts vazio; erro não cobre conteúdo cacheado", () => {
    expect(src).toMatch(/loading && posts\.length === 0 \? \(/);
    expect(src).toMatch(/error && posts\.length === 0 \? \(/);
  });

  it("segmento (Para você / Amigas) vem por prop do RedeTab, não é estado local", () => {
    expect(src).not.toMatch(/useState<Segmento>/);
    expect(src).toMatch(/onChange=\{onSegmentoChange\}/);
  });
});

describe("redeCachePersist não guarda o que não deve (req 7)", () => {
  const src = read("lib/rede/redeCachePersist.ts");

  it("o Payload persistido tem só v/userId/ts/feed/perfil", () => {
    const payload = src.match(/interface Payload \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(payload).toMatch(/\bfeed:/);
    expect(payload).toMatch(/\bperfil:/);
    expect(payload).not.toMatch(/conversas|mensagens|notificac|token/i);
    expect(payload).not.toMatch(/thumbUrl|signedUrl/);
  });

  it("despe as URLs assinadas das fotos, mantém só path + dimensões", () => {
    expect(src).toMatch(/function despirFoto/);
    expect(src).toMatch(/thumbUrl: "",\s*url: ""/);
  });

  it("valida versão, TTL e userId ao carregar", () => {
    expect(src).toMatch(/p\.v !== VERSAO \|\| p\.userId !== userId/);
    expect(src).toMatch(/Date\.now\(\) - p\.ts > TTL_MS/);
  });
});
