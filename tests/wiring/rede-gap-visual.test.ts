import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIA_META } from "../../lib/rede/feed";

/**
 * T11 (issue #38) — itens P0/P1 das Seções 6.3–6.11 (Rede) do checklist de
 * paridade funcional sem cobertura automatizada até então. Os serviços
 * (`lib/rede/**`) e RLS já têm cobertura forte em `tests/rede/**`; este
 * arquivo cobre o CONTRATO de componente (o que a tela realmente faz),
 * mesmo padrão de inspeção de código-fonte já usado em
 * `bottomsheet-focus-trap.test.ts` e `rede-gate-code-entry-independence.test.ts`.
 *
 * IDs: §6.1-P1-1, §6.3-P0-1, §6.3-P1-1, §6.4-P0-1, §6.5-P0-1, §6.5-P0-2,
 * §6.6-P1-1, §6.7-P0-1, §6.7-P0-2, §6.7-P0-3, §6.7-P1-2, §6.8-P0-1,
 * §6.8-P0-2, §6.9-P0-1, §6.10-P1-1 (parte), §6.11-P0-1.
 */

const ROOT = join(__dirname, "..", "..");
function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

const redeTab = read("components/rede/RedeTab.tsx");
const feedScreen = read("components/rede/FeedScreen.tsx");

function listSourceFiles(relDir: string): string[] {
  const dir = join(ROOT, relDir);
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const rel = join(relDir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

describe("§6.1-P1-1 — override ?vitrine=1 continua existindo para forçar apresentação para QA", () => {
  it("RedeGatedTab lê o parâmetro vitrine da URL", () => {
    const src = read("components/rede/RedeGatedTab.tsx");
    expect(src).toMatch(
      /new URLSearchParams\(window\.location\.search\)\.get\("vitrine"\) === "1"/
    );
  });
});

describe("§6.3-P0-1 — filtro real por amizade no feed (autorId === usuario.id || friends.includes(autorId))", () => {
  it("FeedScreen filtra por autoria própria ou lista real de amigas, não mostra tudo sem filtro", () => {
    expect(feedScreen).toMatch(
      /\(p\) => p\.autorId === usuario\.id \|\| friends\.includes\(p\.autorId\)/
    );
  });
});

describe("§6.3-P1-1 — bloco 'Novo pedido de amizade' condicional a pendingRequestsCount > 0", () => {
  it("só aparece quando há pelo menos 1 solicitação pendente, não sempre", () => {
    expect(feedScreen).toMatch(/if \(pendingRequestsCount > 0\) \{/);
  });
});

describe("§6.4-P0-1 — composer oferece exatamente as 5 categorias reais, sem opção livre", () => {
  it("CATEGORIA_META (fonte do composer) tem exatamente as 5 chaves do enum, nenhuma a mais", () => {
    // "geral" adicionada na migration 0025 -- opção neutra/default do
    // composer, pra quem não quer classificar a publicação nas outras 4.
    expect(Object.keys(CATEGORIA_META).sort()).toEqual(
      ["conquista", "desabafo", "dica", "duvida", "geral"].sort()
    );
  });

  it("PostComposer deriva as opções de CATEGORIA_META (fechado), não aceita texto livre de categoria", () => {
    const src = read("components/rede/PostComposer.tsx");
    expect(src).toMatch(
      /const CATEGORIA_OPTIONS = \(Object\.keys\(CATEGORIA_META\) as Categoria\[\]\)\.map\(/
    );
    expect(src).not.toMatch(/categoria.*<input/i);
  });
});

describe("§6.5-P0-1 — curtir tem estado otimista com reversão em erro (RedeTab.toggleLike)", () => {
  it("atualiza a UI antes da resposta do servidor e reverte se alternarCurtida falhar", () => {
    expect(redeTab).toMatch(/async function toggleLike\(id: string\) \{/);
    expect(redeTab).toMatch(/curtidoPorMim: !p\.curtidoPorMim/);
    expect(redeTab).toMatch(
      /await alternarCurtida\(supabase, \{ postId: id \}\);/
    );
    expect(redeTab).toMatch(
      /Reverte a atualização otimista se a chamada real falhar/
    );
  });
});

describe("§6.5-P0-2 — comentar tem estados reais de loading/vazio (CommentsSheet)", () => {
  it("CommentsSheet recebe loading como prop e mostra estado vazio explícito", () => {
    const src = read("components/rede/CommentsSheet.tsx");
    expect(src).toMatch(/loading: boolean;/);
    expect(src).toMatch(/Nenhum comentário ainda/);
  });
});

describe("§6.6-P1-1 — busca separa Pessoas (real) x Assuntos (client-side)", () => {
  it("RedeTab liga a busca de pessoas do SearchScreen à função assíncrona real buscarPessoas", () => {
    expect(redeTab).toMatch(
      /onSearchPessoas=\{\(q\) => buscarPessoas\(supabase, q\)\}/
    );
  });
});

describe("§6.7-P0-3 — CRUD de LiveLinks limita a 5 (client-side; ver issue #61 para o gap de reforço server-side)", () => {
  it("LIVELINKS_MAX é 5 e o botão de adicionar só aparece abaixo do limite", () => {
    const src = read("components/rede/LiveLinksSection.tsx");
    expect(src).toMatch(/export const LIVELINKS_MAX = 5;/);
    expect(src).toMatch(/sorted\.length < LIVELINKS_MAX/);
  });
});

describe("§6.7-P0-1 — LiveLinks de terceiros SEMPRE vazios até ticket 09 (isMe ? liveLinks : [])", () => {
  it("RedeTab só passa liveLinks reais quando profile.isMe, senão array vazio", () => {
    expect(redeTab).toMatch(
      /const livelinksExibidos = profile\.isMe \? liveLinks : \[\];/
    );
  });
});

describe("§6.7-P0-2 — bloqueio a partir do Perfil Público exige confirmação dedicada", () => {
  it("PerfilPublicoScreen mostra confirmação 'Bloquear {nome}?' antes de bloquear", () => {
    const src = read("components/rede/PerfilPublicoScreen.tsx");
    expect(src).toMatch(/title=\{`Bloquear \$\{nome\}\?`\}/);
  });
});

describe('§6.7-P1-2 — "Compartilhar perfil" continua no-op (toast, sem clipboard real), sem piorar', () => {
  it("RedeTab.shareProfile() só mostra um toast de sucesso, nenhuma chamada de clipboard", () => {
    expect(redeTab).toMatch(
      /function shareProfile\(\) \{\s*\r?\n\s*toast\.success\("Link do perfil copiado!"\);\s*\r?\n\s*\}/
    );
    expect(redeTab).not.toMatch(/navigator\.clipboard/);
  });

  it('a string quebrada "share-profile" do laboratório não sobreviveu em nenhuma tela migrada', () => {
    const offenders = [
      ...listSourceFiles("components"),
      ...listSourceFiles("lib"),
      ...listSourceFiles("app"),
    ].filter((relPath) => read(relPath).includes("share-profile"));
    expect(offenders).toEqual([]);
  });
});

describe("§6.8-P0-1 — bloqueio faz limpeza em cascata do estado local (RedeTab.blockUser)", () => {
  it("blockUser persiste via bloquearUsuario e limpa friends/requests/sugestoes/sentRequests/conversations", () => {
    expect(redeTab).toMatch(/async function blockUser\(userId: string\) \{/);
    expect(redeTab).toMatch(
      /await bloquearUsuario\(supabase, \{ bloqueadoId: userId \}\);/
    );
    expect(redeTab).toMatch(
      /setFriends\(\(prev\) => prev\.filter\(\(f\) => f\.id !== userId\)\)/
    );
    expect(redeTab).toMatch(
      /setRequests\(\(prev\) => prev\.filter\(\(r\) => r\.pessoa\.id !== userId\)\)/
    );
    expect(redeTab).toMatch(
      /setSugestoes\(\(prev\) => prev\.filter\(\(s\) => s\.id !== userId\)\)/
    );
    expect(redeTab).toMatch(
      /setSentRequests\(\(prev\) => prev\.filter\(\(id\) => id !== userId\)\)/
    );
    expect(redeTab).toMatch(
      /setConversations\(\(prev\) => prev\.filter\(\(c\) => c\.outroUserId !== userId\)\)/
    );
  });
});

describe("§6.8-P0-2 — AmigasScreen real com 3 sub-abas e contador dinâmico de solicitações", () => {
  it("tem as 3 sub-abas (Minhas amigas/Solicitações/Descobrir) e o contador reage ao número real de pedidos", () => {
    const src = read("components/rede/AmigasScreen.tsx");
    expect(src).toContain('{ id: "amigas", label: "Minhas amigas" }');
    expect(src).toMatch(
      /label: `Solicitações\$\{requests\.length \? ` \(\$\{requests\.length\}\)` : ""\}`/
    );
    expect(src).toContain('{ id: "descobrir", label: "Descobrir" }');
  });
});

describe("§6.9-P0-1 — menu de chat real tem Denunciar e Bloquear (não um sheet genérico)", () => {
  it("o OptionsSheet 'Opções da conversa' oferece denunciar (usuário) e bloquear com confirmação dedicada", () => {
    expect(redeTab).toMatch(/title="Opções da conversa"/);
    expect(redeTab).toMatch(/label: "Denunciar",[\s\S]{0,300}tipo: "usuario"/);
    expect(redeTab).toMatch(
      /label: "Bloquear",[\s\S]{0,300}setChatBlockConfirm/
    );
  });

  it("ShareToChatSheet (compartilhar post como mensagem) existe como componente próprio", () => {
    const src = read("components/rede/ShareToChatSheet.tsx");
    expect(src).toMatch(/export function ShareToChatSheet/);
  });
});

describe("§6.11-P0-1 — denúncia usa o picker real de 4 motivos batendo com o enum do banco", () => {
  it("os 4 motivos (Spam/Assédio/Conteúdo impróprio/Outro) estão todos presentes", () => {
    expect(redeTab).toContain('label: "Spam"');
    expect(redeTab).toContain('label: "Assédio"');
    expect(redeTab).toContain('label: "Conteúdo impróprio"');
    expect(redeTab).toMatch(/label: "Outro motivo"/);
  });
});
