import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Teste de fiação (não de renderização), mesmo padrão de
 * `cofre-visual.test.ts`/`pinscreen-visual.test.ts`: confirma a partir
 * do código fonte que "Meu espaço" (Rede, ticket #139) migrou pro visual
 * aprovado (/dev-preview/ios, tela "alexsilva") sem inventar dado, sem
 * remover função, e reposicionando (não removendo) os recursos privados
 * pro menu de ferramentas do perfil.
 */

const ROOT = join(__dirname, "..", "..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

const screenSrc = read("components/rede/MeuEspacoScreen.tsx");
const gridSrc = read("components/rede/ProfilePostsGrid.tsx");
const viewerSrc = read("components/rede/ProfilePhotoViewer.tsx");
const feedFotosSrc = read("components/rede/FeedFotos.tsx");
const redeTabSrc = read("components/rede/RedeTab.tsx");
const perfisSrc = read("lib/rede/perfis.ts");
const ajustesTabSrc = read("components/ajustes/AjustesTab.tsx");

describe("MeuEspacoScreen — bio vem de campo real, não é schema novo (#139)", () => {
  it("bio já existe em rede_perfis, não é uma migration desta ticket", () => {
    expect(perfisSrc).toContain("bio: string");
  });

  it("RedeTab passa a bio real do perfil carregado, nunca um texto fixo", () => {
    expect(redeTabSrc).toMatch(/bio=\{perfil\?\.bio\s*\?\?\s*""\}/);
  });

  it("MeuEspacoScreen só renderiza a bio quando existe (sem placeholder ilustrativo)", () => {
    expect(screenSrc).toMatch(/\{bio\s*&&\s*\(/);
  });
});

describe("MeuEspacoScreen — estatísticas 100% reais (#139)", () => {
  it("contagens vêm de props reais (meusPosts.length/friendsCount/clientesCount), nunca fixas", () => {
    expect(screenSrc).toContain("{meusPosts.length}");
    expect(screenSrc).toContain("{friendsCount}");
    expect(screenSrc).toContain("{clientesCount}");
  });

  it("RedeTab alimenta essas props com dado real (posts filtrados/friends/clientes carregados)", () => {
    expect(redeTabSrc).toMatch(
      /meusPosts=\{posts\.filter\(\(p\) => p\.autorId === usuario\.id\)\}/
    );
    expect(redeTabSrc).toContain("friendsCount={friends.length}");
    expect(redeTabSrc).toContain("clientesCount={clientes.length}");
  });
});

describe("MeuEspacoScreen — LiveLinks discretos entre bio e ações (regra não-negociável do mapa #122)", () => {
  it("usa o preview discreto (LiveLinksPreview), não o editor pesado, no corpo principal", () => {
    const bioIdx = screenSrc.indexOf("{bio &&");
    const actionsIdx = screenSrc.indexOf('label="Editar perfil"');
    const linksIdx = screenSrc.indexOf("<LiveLinksPreview");
    expect(bioIdx).toBeGreaterThan(-1);
    expect(actionsIdx).toBeGreaterThan(-1);
    expect(linksIdx).toBeGreaterThan(-1);
    expect(linksIdx).toBeGreaterThan(bioIdx);
    expect(linksIdx).toBeLessThan(actionsIdx);
  });

  it("gerenciamento completo (adicionar/editar/excluir/reordenar) continua existindo, só moveu pro menu de ferramentas", () => {
    expect(screenSrc).toContain("<LiveLinksEditor");
    expect(screenSrc).toContain("onMove={onMoveLiveLink}");
    expect(screenSrc).toContain("onEdit={onEditLiveLink}");
    expect(screenSrc).toContain("onDelete={onDeleteLiveLink}");
    expect(screenSrc).toContain("onAdd={onAddLiveLink}");
  });
});

describe("MeuEspacoScreen — ações Editar perfil / Publicar / Compartilhar apontam pros fluxos reais (#139)", () => {
  it("Editar perfil chama o handler real (ProfileEditForm, já existente)", () => {
    expect(screenSrc).toContain("onClick={onEditProfile}");
  });

  it("Publicar reusa o mesmo composer real que o FAB já abre — sem fluxo de publicação paralelo", () => {
    expect(screenSrc).toContain("onClick={onPublish}");
    expect(redeTabSrc).toMatch(/onPublish=\{\(\) => setComposerOpen\(true\)\}/);
  });

  it("Compartilhar chama o handler real de compartilhamento de perfil", () => {
    expect(screenSrc).toContain("onClick={onShareProfile}");
    expect(redeTabSrc).toContain("onShareProfile={shareProfile}");
  });
});

describe("MeuEspacoScreen — menu de ferramentas preserva as 6 funções exigidas pelo contrato (#139)", () => {
  it("lista as 6 entradas do contrato (ver como perfil público, Desejos, Clientes, LiveLinks, privacidade, bloqueados)", () => {
    for (const label of [
      "Ver como perfil público",
      "Desejos",
      "Clientes privados",
      "Gerenciar LiveLinks",
      "Privacidade das publicações",
      "Pessoas bloqueadas",
    ]) {
      expect(screenSrc).toContain(`"${label}"`);
    }
  });

  it("cada entrada aponta pro handler/tela real já existente (RedeTab), nenhum fluxo novo", () => {
    expect(screenSrc).toContain("onSelect: onOpenPerfilPublico");
    expect(screenSrc).toContain("onSelect: onOpenWishlist");
    expect(screenSrc).toContain("onSelect: onOpenClientes");
    expect(screenSrc).toContain("onSelect: onOpenBloqueados");
  });

  it("privacidade padrão continua o mesmo SegmentedControl/handler real, só dentro de um sheet", () => {
    expect(screenSrc).toContain("<SegmentedControl<Privacidade>");
    expect(screenSrc).toContain("onChange={onChangeDefaultPrivacidade}");
  });

  it("usa o menu com seta de navegação (chevron opt-in), não o padrão de ação imediata", () => {
    expect(screenSrc).toMatch(/<OptionsSheet[\s\S]*?chevron[\s\S]*?\/>/);
  });
});

describe("ProfilePostsGrid — grade real, dado real (#139)", () => {
  it("usa os posts reais recebidos via props, nunca um array fixo", () => {
    expect(gridSrc).toContain("posts.map((post) =>");
    expect(gridSrc).not.toMatch(/const\s+posts\s*=\s*\[/);
  });

  it("não implementa aba de publicações marcadas (proibido pelo contrato) — checa JSX/código, não a prosa dos comentários", () => {
    const codeOnly = (src: string) =>
      src
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
    expect(codeOnly(screenSrc)).not.toMatch(/marcad[ao]s?/i);
    expect(codeOnly(gridSrc)).not.toMatch(/marcad[ao]s?/i);
  });

  it("miniatura da grade renova pela thumbPath (não pela path da foto principal)", () => {
    expect(gridSrc).toContain("onRenovarFoto(foto.thumbPath)");
  });

  it("trava contra loop de renovação (no máximo 1 tentativa por célula)", () => {
    expect(gridSrc).toContain("tentouRenovar");
  });

  it("célula sem foto mostra o texto real, mas não é clicável (nenhum destino novo inventado pra ela)", () => {
    expect(gridSrc).toMatch(/if \(!foto\) \{[\s\S]*?<div[\s\S]*?\}/);
    // A ausência de foto cai no ramo <div> (não-interativo); só o ramo
    // com foto usa <button onClick={...}>.
    const semFotoBlock = gridSrc.slice(
      gridSrc.indexOf("if (!foto) {"),
      gridSrc.indexOf("return (", gridSrc.indexOf("if (!foto) {") + 200)
    );
    expect(semFotoBlock).not.toMatch(/onClick/);
  });

  it("abre o visualizador dedicado (não importa/renderiza mais o PostCard inline)", () => {
    expect(gridSrc).toContain(
      'import { ProfilePhotoViewer } from "./ProfilePhotoViewer"'
    );
    expect(gridSrc).toContain("<ProfilePhotoViewer");
    expect(gridSrc).not.toMatch(/import.*PostCard|<PostCard/);
  });
});

describe("ProfilePostsGrid — histórico do navegador e foco (#139, requisitos do usuário 2026-09-22)", () => {
  it("empurra uma entrada de histórico SEM mudar a URL (2º argumento vazio) -- popstate nunca navega a página", () => {
    // Achado do review de Spec: checar só "pushState(" existe não prova
    // que a URL fica intacta -- um 2º argumento não-vazio faria o Voltar
    // navegar a página de verdade, não só fechar o visualizador.
    expect(gridSrc).toMatch(
      /window\.history\.pushState\(\s*\{[\s\S]*?\},\s*""\s*\)/
    );
  });

  it("Voltar do navegador fecha o visualizador antes de sair da tela (popstate), mas só quando a PRÓPRIA chave saiu do estado", () => {
    expect(gridSrc).toContain('window.addEventListener("popstate"');
    // Achado do review de Padrões: TabPanel mantém abas montadas, então
    // um popstate de OUTRA aba (ex.: Ajustes) também dispara este
    // listener -- sem checar a própria chave, fecharia o visualizador
    // por engano num popstate que não tinha nada a ver com ele.
    expect(gridSrc).toMatch(
      /function onPopState\(\)\s*\{\s*if \(!window\.history\.state\?\.\[HISTORY_KEY\]\) setViewerPostId\(null\);/
    );
  });

  it("fechar pelo X também consome a entrada de histórico empurrada (history.back), sem duplicar estado", () => {
    expect(gridSrc).toMatch(
      /function closeViewer\(\)[\s\S]*?history\.back\(\)/
    );
  });

  it("restaura o foco na célula que abriu o visualizador, ao fechar", () => {
    expect(gridSrc).toContain("lastTriggerRef");
    expect(gridSrc).toMatch(/lastTriggerRef\.current\?\.focus\(\)/);
  });

  it("as chaves de histórico do visualizador e de Ajustes não colidem (TabPanel mantém as duas abas montadas)", () => {
    expect(gridSrc).toContain('"jobappPhotoViewer"');
    expect(ajustesTabSrc).toContain("jobappSettingsPage");
  });

  it("AjustesTab também só fecha sua sub-página quando a PRÓPRIA chave saiu do estado -- mesma correção, mesmo motivo (achado do review de Padrões desta ticket, bug pré-existente exposto por um 2º consumidor do padrão coexistir montado)", () => {
    expect(ajustesTabSrc).toMatch(
      /const handleHistoryBack = \(\) => \{\s*if \(!window\.history\.state\?\.jobappSettingsPage\) setActivePage\(null\);/
    );
  });
});

describe("ProfilePhotoViewer — reusa PhotoStage real (FeedFotos.tsx), não duplica a lógica de mídia (#139)", () => {
  it("PhotoStage agora é exportado especificamente pra este reuso", () => {
    expect(feedFotosSrc).toContain("export function PhotoStage(");
  });

  it("importa e usa o PhotoStage real -- mesma assinatura/renovação/crossfade/retry do feed", () => {
    expect(viewerSrc).toMatch(
      /import\s*\{[^}]*\bPhotoStage\b[^}]*\}\s*from\s*"\.\/FeedFotos"/
    );
    expect(viewerSrc).toContain("<PhotoStage");
  });

  it("também reusa prefereMovimentoReduzido exportado, não reescreve a mesma checagem de matchMedia", () => {
    expect(viewerSrc).toMatch(
      /import\s*\{[^}]*\bprefereMovimentoReduzido\b[^}]*\}\s*from\s*"\.\/FeedFotos"/
    );
    expect(feedFotosSrc).toContain("export function prefereMovimentoReduzido");
    expect(viewerSrc).not.toMatch(/window\.matchMedia\?\.\(/);
  });

  it("não reimplementa assinatura de URL nem chama Supabase Storage diretamente", () => {
    expect(viewerSrc).not.toMatch(/createSignedUrl|supabase\.storage/);
  });
});

describe("ProfilePhotoViewer — requisitos funcionais do visualizador (#139, decisão do usuário 2026-09-22)", () => {
  it("é um overlay dentro do app (portal), nunca window.open", () => {
    expect(viewerSrc).toContain("createPortal(");
    expect(viewerSrc).not.toMatch(/window\.open\(/);
  });

  it("carrega a foto principal (renderPrincipal) só quando o post é passado -- nunca antes de abrir", () => {
    expect(viewerSrc).toContain("renderPrincipal");
    expect(viewerSrc).toMatch(/if \(!mounted \|\| !post/);
  });

  it("as até 2 fotos usam renderPrincipal incondicional -- preload automático da 2ª sem lógica extra", () => {
    const stageBlock = viewerSrc.slice(
      viewerSrc.indexOf("{fotos.map((foto) =>"),
      viewerSrc.indexOf("))}", viewerSrc.indexOf("{fotos.map((foto) =>"))
    );
    expect(stageBlock).toContain("renderPrincipal");
    expect(stageBlock).not.toMatch(/renderPrincipal=\{/); // sempre true, não condicional
  });

  it("bloqueia o scroll do fundo enquanto aberto, e restaura o valor CAPTURADO antes (não um valor fixo)", () => {
    // Achado do review de Spec: checar só "= previous" não prova que
    // `previous` veio de ler o overflow ANTES de sobrescrever -- sem essa
    // captura, um "overflow = \"\"" hardcoded quebraria páginas com
    // overflow customizado, mas passaria num teste que só procurasse o
    // nome da variável.
    expect(viewerSrc).toMatch(
      /const previous = document\.body\.style\.overflow;/
    );
    expect(viewerSrc).toMatch(/document\.body\.style\.overflow = "hidden"/);
    expect(viewerSrc).toMatch(/document\.body\.style\.overflow = previous;/);
  });

  it("Escape fecha o visualizador", () => {
    expect(viewerSrc).toMatch(/e\.key === "Escape"/);
    expect(viewerSrc).toContain("onCloseRef.current()");
  });

  it("botão fechar explícito existe e chama onClose", () => {
    expect(viewerSrc).toMatch(/aria-label="Fechar"/);
    expect(viewerSrc).toContain("onClick={onClose}");
  });

  it("post com 2 fotos permite navegar entre elas (setas + índice por scroll)", () => {
    expect(viewerSrc).toContain("fotos.length > 1");
    expect(viewerSrc).toMatch(/aria-label="Foto anterior"/);
    expect(viewerSrc).toMatch(/aria-label="Próxima foto"/);
  });

  it("estado de erro/retry vem do PhotoStage reusado -- não reimplementado aqui", () => {
    expect(viewerSrc).not.toMatch(/Recarregar a foto/);
  });

  it("não adiciona curtir/comentar/compartilhar -- só a foto (nenhuma ação nova por semelhança com Instagram)", () => {
    // Filtra comentários -- o próprio arquivo EXPLICA por que essas ações
    // não existem aqui, o que citaria as palavras só pra negá-las.
    const codeOnly = viewerSrc
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    expect(codeOnly).not.toMatch(
      /onToggleLike|onComment\b|onShare\b|curtida|Heart\b|MessageCircle\b/
    );
  });

  it("não cria nenhuma tabela/API/storage nova -- só reusa lib/rede/feed.ts (FeedPost/FotoPost) e onRenovarFoto já existente", () => {
    expect(viewerSrc).not.toMatch(/\.from\(["'`]rede_/);
    expect(viewerSrc).not.toMatch(/\/api\/rede\//);
  });
});

describe("MeuEspacoScreen — menu de 3 pontos no cabeçalho (não infla a BottomNav nem cria header próprio)", () => {
  it("usa o ScreenHeader compartilhado com a prop action, mesmo padrão de outras telas da Rede", () => {
    expect(screenSrc).toMatch(/<ScreenHeader[\s\S]*?action=\{/);
  });
});
