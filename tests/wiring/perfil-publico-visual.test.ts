import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Teste de fiação (não de renderização), mesmo padrão de
 * `meu-espaco-visual.test.ts` (#139): confirma a partir do código fonte que
 * "Perfil público" (ticket #140) reusa os componentes visuais de #139 sem
 * duplicar código, sem estatísticas (decisão registrada no mapa #122), sem
 * ações exclusivas do dono, e sem inventar nenhum CTA novo (ex.: "Agende
 * comigo" -- fora do contrato, exigiria aprovação explícita separada).
 */

const ROOT = join(__dirname, "..", "..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

const screenSrc = read("components/rede/PerfilPublicoScreen.tsx");
const headerSrc = read("components/rede/ProfileIdentityHeader.tsx");
const gridSrc = read("components/rede/ProfilePostsGrid.tsx");
const viewerSrc = read("components/rede/ProfilePhotoViewer.tsx");
const reportBtnSrc = read("components/rede/ReportMenuButton.tsx");
const redeTabSrc = read("components/rede/RedeTab.tsx");

describe("PerfilPublicoScreen — reusa o header de identidade de #139 sem duplicar marcação (#140)", () => {
  it("importa e usa ProfileIdentityHeader, não reimplementa avatar/nome/bio inline", () => {
    expect(screenSrc).toContain(
      'import { ProfileIdentityHeader } from "./ProfileIdentityHeader"'
    );
    expect(screenSrc).toContain("<ProfileIdentityHeader");
    expect(screenSrc).not.toMatch(/import\s*\{\s*Avatar\s*\}/);
  });

  it("NÃO passa `stats` -- contrato só exige números explicitamente pro próprio perfil (decisão revalidada em #140)", () => {
    const callStart = screenSrc.indexOf("<ProfileIdentityHeader");
    const callEnd = screenSrc.indexOf("/>", callStart);
    const call = screenSrc.slice(callStart, callEnd);
    expect(call).not.toContain("stats=");
  });

  it("NÃO passa avatar editável -- nunca em avatar de outra pessoa, nem no preview do próprio", () => {
    const callStart = screenSrc.indexOf("<ProfileIdentityHeader");
    const callEnd = screenSrc.indexOf("/>", callStart);
    const call = screenSrc.slice(callStart, callEnd);
    expect(call).not.toContain("avatarEditable");
    expect(call).not.toContain("onEditAvatar");
  });
});

describe("PerfilPublicoScreen — LiveLinks discretos entre bio e ações (regra não-negociável do mapa #122)", () => {
  it("header de identidade vem antes do preview de LiveLinks, que vem antes da linha de ações", () => {
    const headerIdx = screenSrc.indexOf("<ProfileIdentityHeader");
    const linksIdx = screenSrc.indexOf("<LiveLinksPreview");
    // A linha de ações (Conversar/Adicionar/Solicitação enviada) é o
    // primeiro ponto de decisão depois do header -- usa "isFriend ?" como
    // âncora porque não há um rótulo fixo único como em MeuEspacoScreen.
    const actionsIdx = screenSrc.indexOf("isFriend ?");
    expect(headerIdx).toBeGreaterThan(-1);
    expect(linksIdx).toBeGreaterThan(-1);
    expect(actionsIdx).toBeGreaterThan(-1);
    expect(linksIdx).toBeGreaterThan(headerIdx);
    expect(linksIdx).toBeLessThan(actionsIdx);
  });

  it("antes desta ticket a seção vinha DEPOIS das ações -- confirma que não sobrou nenhum rótulo de seção 'LiveLinks' (discreto, sem cabeçalho)", () => {
    expect(screenSrc).not.toMatch(/section-label[^>]*>\s*LiveLinks/);
  });
});

describe("PerfilPublicoScreen — sem ações exclusivas do dono do perfil (#140)", () => {
  it("não tem Editar perfil, Publicar, nem o menu de três pontos 'Ferramentas do perfil'", () => {
    expect(screenSrc).not.toContain("Editar perfil");
    expect(screenSrc).not.toMatch(/onClick=\{onPublish\}/);
    expect(screenSrc).not.toContain("Ferramentas do perfil");
  });
});

describe("PerfilPublicoScreen — grade de publicações reusa ProfilePostsGrid sem modificação (#140)", () => {
  it("importa ProfilePostsGrid, não renderiza mais PostCard nem lista vertical", () => {
    expect(screenSrc).toContain(
      'import { ProfilePostsGrid } from "./ProfilePostsGrid"'
    );
    expect(screenSrc).toContain("<ProfilePostsGrid");
    expect(screenSrc).not.toMatch(/import.*\bPostCard\b|<PostCard/);
  });

  it("ProfilePostsGrid ganhou onReportPost nesta ticket, mas continua genérico (nada específico de 'Meu espaço')", () => {
    expect(gridSrc).not.toMatch(/Meu espaço|meuEspaco|MeuEspaco/);
  });

  it("mensagem de vazio distingue preview do próprio (2ª pessoa) de perfil de terceiro (3ª pessoa), amarrada ao ramo certo da ternária", () => {
    // Achado do review de Spec: checar só que as duas strings existem no
    // arquivo não prova qual delas está em qual ramo -- a ternária
    // invertida (isMe ? "Nenhuma publicação..." : "Você ainda não...")
    // passaria do mesmo jeito. Ancora no texto exato da prop pra travar a
    // associação real.
    expect(screenSrc).toMatch(
      /emptyMessage=\{\s*isMe\s*\?\s*"Você ainda não publicou nada\."\s*:\s*"Nenhuma publicação ainda\."\s*\}/
    );
  });
});

describe("PerfilPublicoScreen — nenhum CTA novo tipo 'Agende comigo' (fora do contrato, #140)", () => {
  it("não introduz nenhuma ação de agendar/contratar que não existisse antes", () => {
    const codeOnly = screenSrc
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    expect(codeOnly).not.toMatch(/agend[ae]|contratar/i);
  });
});

describe("PerfilPublicoScreen — props de curtir/comentar/compartilhar/menu removidas (não usadas mais, mesmo tratamento de #139)", () => {
  it("Props não declara mais onToggleLike/onComment/onShare/onOpenMenu", () => {
    const propsBlockEnd = screenSrc.indexOf(
      "export function PerfilPublicoScreen"
    );
    const propsBlock = screenSrc.slice(0, propsBlockEnd);
    expect(propsBlock).not.toMatch(
      /onToggleLike|onComment\b|onShare\b|onOpenMenu/
    );
  });

  it("continua recebendo onRenovarFoto (a grade e o visualizador cuidam do resto)", () => {
    expect(screenSrc).toContain(
      "onRenovarFoto: (path: string) => Promise<string | null>;"
    );
  });
});

describe("PerfilPublicoScreen — permissões e dados de terceiros inalterados (#140)", () => {
  it("RedeTab continua controlando LiveLinks de terceiros (sempre vazio até ticket dedicada), inalterado por #140", () => {
    expect(redeTabSrc).toMatch(
      /const livelinksExibidos = profile\.isMe \? liveLinks : \[\];/
    );
  });

  it("bloqueio continua exigindo confirmação dedicada antes de agir", () => {
    expect(screenSrc).toMatch(/title=\{`Bloquear \$\{nome\}\?`\}/);
  });
});

/**
 * "Denunciar publicação" restaurada só pra perfil de terceiros (achado do
 * review de Standards de #140 em cima de #139: a grade/visualizador do
 * perfil excluem curtir/comentar/compartilhar de propósito, mas denunciar
 * é moderação/segurança, categoricamente diferente -- não pode
 * desaparecer só porque o post saiu da paginação do feed). Decisão do
 * usuário 2026-09-23: restaurar só essa ação, via "..." discreto,
 * reusando integralmente o fluxo/callback/confirmação/serviço/feedback
 * já usados pelo PostCard -- nunca duplicar API nem regra nova.
 */
describe("Denunciar publicação — terceiro vê, dono nunca vê (#140)", () => {
  it("PerfilPublicoScreen só repassa onReportPost à grade quando NÃO é o próprio perfil", () => {
    expect(screenSrc).toMatch(
      /onReportPost=\{isMe \? undefined : onReportPost\}/
    );
  });

  it('MeuEspacoScreen (próprio perfil, #139) nunca passa onReportPost -- sem isso, o "..." nunca poderia aparecer, mesmo por engano', () => {
    const meuEspacoSrc = read("components/rede/MeuEspacoScreen.tsx");
    expect(meuEspacoSrc).not.toContain("onReportPost");
  });

  it('ProfilePhotoViewer só renderiza o "..." quando onReportPost está presente -- ausente (própria conta) = nunca aparece', () => {
    expect(viewerSrc).toMatch(/\{onReportPost && \(\s*<ReportMenuButton/);
  });

  it('célula sem foto da grade só ganha o "..." quando onReportPost está presente', () => {
    expect(gridSrc).toMatch(
      /\{onReportPost && \(\s*<div className="absolute[\s\S]*?<ReportMenuButton/
    );
  });
});

describe("Denunciar publicação — ação recebe o ID correto do post (#140)", () => {
  it("ProfilePhotoViewer chama onReportPost com o id do post ABERTO no momento, não um id fixo", () => {
    expect(viewerSrc).toMatch(/onReport=\{\(\) => onReportPost\(post\.id\)\}/);
  });

  it("célula sem foto chama onReportPost com o id do post DAQUELA célula, não um id fixo ou de outra célula", () => {
    expect(gridSrc).toMatch(/onReport=\{\(\) => onReportPost\(post\.id\)\}/);
  });
});

describe("Denunciar publicação — cancelamento não denuncia (#140)", () => {
  it("ReportMenuButton só chama onReport a partir do onSelect da opção -- fechar o sheet (onClose) nunca dispara denúncia", () => {
    expect(reportBtnSrc).toMatch(/onClose=\{\(\) => setOpen\(false\)\}/);
    // onReport só pode aparecer 1x no arquivo -- dentro do onSelect da
    // única opção. Se aparecesse de novo em onClose (ou em qualquer outro
    // lugar), fechar o menu sem escolher nada também denunciaria.
    const ocorrencias = reportBtnSrc.match(/\bonReport\b/g) ?? [];
    // 1 na prop da interface, 1 na desestruturação, 1 no onSelect = 3.
    expect(ocorrencias.length).toBe(3);
    expect(reportBtnSrc).toMatch(/onSelect: onReport,/);
  });

  it("o sheet oferece só UMA opção (Denunciar publicação) -- sem Cancelar redundante, sem Editar/Excluir do PostCard", () => {
    const optionsBlock = reportBtnSrc.slice(
      reportBtnSrc.indexOf("options={["),
      reportBtnSrc.indexOf("]}", reportBtnSrc.indexOf("options={["))
    );
    const chaves = optionsBlock.match(/key:\s*"[^"]+"/g) ?? [];
    expect(chaves).toEqual(['key: "denunciar"']);
  });
});

describe("Denunciar publicação — reusa integralmente o fluxo real do PostCard, sem duplicar API (#140)", () => {
  it("RedeTab liga onReportPost ao MESMO setReportTarget que o menu do PostCard já usa -- mesma confirmação, mesmo serviço, mesmo feedback", () => {
    expect(redeTabSrc).toMatch(
      /onReportPost=\{\(postId\) =>\s*setReportTarget\(\{ tipo: "post", id: postId \}\)\s*\}/
    );
    // O menu "Publicação" já existente usa exatamente essa mesma chamada
    // pro post de terceiro -- confirma que é o MESMO alvo, não um paralelo.
    expect(redeTabSrc).toMatch(
      /setReportTarget\(\{ tipo: "post", id: menuPost\.id \}\)/
    );
  });

  it("nenhum serviço/tabela/API novo -- ReportMenuButton não chama Supabase nem fetch, só repassa o clique", () => {
    // Filtra comentários -- o próprio arquivo CITA criarDenuncia na
    // documentação (pra explicar que reusa o fluxo real), o que faria
    // esta checagem falhar por um motivo errado se lesse a prosa.
    const codeOnly = reportBtnSrc
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    expect(codeOnly).not.toMatch(/supabase|fetch\(|criarDenuncia/i);
  });
});

describe("Denunciar publicação — cobertura de posts com zero, uma e duas fotos (#140)", () => {
  it('post SEM foto: "..." vive na própria célula da grade (não há visualizador pra abrir)', () => {
    const semFotoBlock = gridSrc.slice(
      gridSrc.indexOf("if (!foto) {"),
      gridSrc.indexOf("  }", gridSrc.indexOf("if (!foto) {"))
    );
    expect(semFotoBlock).toContain("ReportMenuButton");
  });

  it('post COM foto (1 ou 2): "..." vive no cabeçalho do ProfilePhotoViewer, fora de qualquer condicional de fotos.length -- aparece igual com 1 ou 2 fotos', () => {
    const headerStart = viewerSrc.indexOf(
      'className="flex items-center justify-end gap-2 shrink-0"'
    );
    const headerEnd = viewerSrc.indexOf('<div className="relative flex-1');
    expect(headerStart).toBeGreaterThan(-1);
    expect(headerEnd).toBeGreaterThan(headerStart);
    const headerBlock = viewerSrc.slice(headerStart, headerEnd);
    expect(headerBlock).toContain("ReportMenuButton");
    // O cabeçalho em si não deve conter nenhuma checagem de fotos.length
    // -- confirma que o "..." não é condicional ao número de fotos (só a
    // trilha de bolinhas/setas de navegação, fora deste bloco, é).
    expect(headerBlock).not.toMatch(/fotos\.length/);
  });
});

describe("Denunciar publicação — menu acessível por toque e teclado (#140)", () => {
  it('o gatilho "..." é um <button> nativo (foco/Enter/Espaço funcionam de graça), não uma div com onClick', () => {
    const trigger = reportBtnSrc.slice(
      reportBtnSrc.indexOf("<button"),
      reportBtnSrc.indexOf("</button>")
    );
    expect(trigger).toContain('type="button"');
    expect(trigger).toContain("aria-label=");
  });

  it("a opção dentro do sheet também é um <button> nativo (herdado de OptionsSheet, não tocado)", () => {
    const optionsSheetSrc = read("components/rede/OptionsSheet.tsx");
    expect(optionsSheetSrc).toMatch(/<button[\s\S]*?onSelect\(\)/);
  });
});

describe("Denunciar publicação — fechar o menu não perde a posição da grade (#140)", () => {
  it("ReportMenuButton tem estado próprio (open/setOpen), isolado do estado de scroll/visualizador da grade", () => {
    expect(reportBtnSrc).toContain("useState(false)");
    expect(reportBtnSrc).not.toMatch(
      /viewerPostId|window\.history|scrollTo|lastTriggerRef/
    );
  });

  it('abrir o "..." não empurra entrada de histórico nenhuma -- só o visualizador de foto faz isso (chave própria, já testada em #139)', () => {
    expect(reportBtnSrc).not.toContain("pushState");
  });
});
