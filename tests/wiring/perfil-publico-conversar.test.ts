import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * "Iniciar conversa" no perfil público de outra pessoa.
 *
 * Teste de fiação (não de renderização), mesmo padrão de
 * `perfil-publico-visual.test.ts` (#140) -- este repo não tem infra de
 * render de componentes React (`vitest.config.ts` roda em `environment:
 * "node"`, sem jsdom/testing-library), então o comportamento de UI é
 * verificado a partir do código-fonte real, não de um DOM simulado.
 *
 * Escopo desta ticket: só o botão "Conversar" no perfil público. A
 * criação/reuso da conversa em si (`abrirConversa1a1` -> RPC
 * `rede_criar_conversa_1a1`) e sua garantia de unicidade sob concorrência
 * JÁ EXISTIAM antes desta ticket e já são cobertas por:
 *   - tests/rede/concurrency/conversas.concurrency.test.ts (RD-19): duas
 *     tentativas simultâneas do MESMO par colapsam numa única conversa --
 *     prova via Postgres real, na camada de serviço que a UI de fato usa.
 *   - tests/rede/rls/messaging.rls.test.ts: bloqueio impede a RPC de criar
 *     conversa (`conversa bloqueada`, 42501).
 * Nenhum dos dois é duplicado aqui -- só se referencia.
 */

const ROOT = join(__dirname, "..", "..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

const screenSrc = read("components/rede/PerfilPublicoScreen.tsx");
const redeTabSrc = read("components/rede/RedeTab.tsx");
const mensagensSrc = read("lib/rede/mensagens.ts");

describe("PerfilPublicoScreen — botão Conversar não depende mais de amizade", () => {
  it("renderiza 'Conversar' fora da ternária isFriend/requestSent (antes só amigas o viam)", () => {
    // Âncora: o bloco `{onOpenChat && (<button ...>Conversar</button>)}`
    // precisa vir ANTES da ternária `isFriend ? (chip) : mostrarPedido ? ... :
    // ...`, e essa ternária não pode mais conter o texto "Conversar" --
    // sem isso, o gate por amizade reapareceria por regressão.
    const chatBlockIdx = screenSrc.indexOf("{onOpenChat && (");
    const ternaryIdx = screenSrc.indexOf("{isFriend ? (");
    expect(chatBlockIdx).toBeGreaterThan(-1);
    expect(ternaryIdx).toBeGreaterThan(-1);
    expect(chatBlockIdx).toBeLessThan(ternaryIdx);

    const ternaryBlock = screenSrc.slice(
      ternaryIdx,
      screenSrc.indexOf("{onBlock && (", ternaryIdx)
    );
    expect(ternaryBlock).not.toContain("Conversar");
  });

  it("continua ausente no próprio perfil (todo o bloco de ações vive sob `!isMe`)", () => {
    const meBlockStart = screenSrc.indexOf("{!isMe && (");
    const chatBlockIdx = screenSrc.indexOf("{onOpenChat && (");
    expect(meBlockStart).toBeGreaterThan(-1);
    expect(chatBlockIdx).toBeGreaterThan(meBlockStart);
  });

  it("continua dentro do branch !loading && !error -- perfil indisponível/bloqueado (RLS já filtra, migration 0017) nunca mostra o botão", () => {
    const errorBranchIdx = screenSrc.indexOf(") : error ? (");
    const chatBlockIdx = screenSrc.indexOf("{onOpenChat && (");
    expect(errorBranchIdx).toBeGreaterThan(-1);
    expect(chatBlockIdx).toBeGreaterThan(errorBranchIdx);
  });

  it("rótulo acessível claro ('Iniciar conversa') além do texto visível ('Conversar')", () => {
    const chatBlockEnd = screenSrc.indexOf(
      "Conversar",
      screenSrc.indexOf("{onOpenChat && (")
    );
    const chatBlock = screenSrc.slice(
      screenSrc.indexOf("{onOpenChat && ("),
      chatBlockEnd + "Conversar".length
    );
    expect(chatBlock).toContain('aria-label="Iniciar conversa"');
  });
});

describe("PerfilPublicoScreen — estado de carregamento do botão Conversar", () => {
  it("prop chatOpening desabilita o botão e troca o ícone por spinner (mesmo padrão do botão de enviar em ChatThreadScreen)", () => {
    expect(screenSrc).toContain("chatOpening?: boolean;");
    expect(screenSrc).toContain("chatOpening = false");
    expect(screenSrc).toMatch(/disabled=\{chatOpening\}/);
    expect(screenSrc).toMatch(
      /\{chatOpening \? \(\s*<Loader2[^/]*\/>\s*\) : \(\s*<MessageCircle/
    );
  });

  it("RedeTab repassa o estado real de 'abrindo conversa com ESTE userId', não um boolean genérico", () => {
    expect(redeTabSrc).toMatch(
      /chatOpening=\{openingChatUserIds\.has\(screen\.userId\)\}/
    );
  });
});

describe("RedeTab.openChatWithUser — reusa conversa existente sem chamar a RPC de novo", () => {
  it("verifica `conversations` local ANTES de abrir/criar -- só chama abrirConversa1a1 se não achar", () => {
    const fnStart = redeTabSrc.indexOf("async function openChatWithUser");
    const fnEnd = redeTabSrc.indexOf("\n  }\n", fnStart);
    const fn = redeTabSrc.slice(fnStart, fnEnd);
    const existingIdx = fn.indexOf("conversations.find");
    const rpcIdx = fn.indexOf("abrirConversa1a1(supabase");
    expect(existingIdx).toBeGreaterThan(-1);
    expect(rpcIdx).toBeGreaterThan(-1);
    expect(existingIdx).toBeLessThan(rpcIdx);
    // O early return do caminho "já existe" precisa vir antes da chamada à
    // RPC no código-fonte (garante que são ramos mutuamente exclusivos).
    expect(fn.indexOf("openChatThread(existing.id)")).toBeLessThan(rpcIdx);
  });

  it("não reimplementa a criação da conversa -- delega inteiramente pra abrirConversa1a1 (lib/rede/mensagens.ts), sem RPC/tabela nova", () => {
    expect(redeTabSrc).toMatch(/\babrirConversa1a1\b/);
    expect(mensagensSrc).toContain('client.rpc("rede_criar_conversa_1a1"');
    // Nenhum novo `.from("rede_conversas")` de escrita direta em RedeTab --
    // toda escrita passa pela RPC (que tem o advisory lock).
    expect(redeTabSrc).not.toMatch(/\.from\("rede_conversas"\)\s*\.insert/);
  });
});

describe("RedeTab.openChatWithUser — toque duplo/chamada concorrente não duplica (client-side)", () => {
  it("guarda por userId (Set), não um boolean global -- não trava silenciosamente abrir conversa com OUTRA pessoa em paralelo", () => {
    expect(redeTabSrc).toContain(
      "const [openingChatUserIds, setOpeningChatUserIds] = useState<Set<string>>"
    );
    const fnStart = redeTabSrc.indexOf("async function openChatWithUser");
    const fnEnd = redeTabSrc.indexOf("\n  }\n", fnStart);
    const fn = redeTabSrc.slice(fnStart, fnEnd);
    expect(fn).toMatch(/if \(openingChatUserIds\.has\(userId\)\) \{\s*return;/);
  });

  it("marca o userId como 'abrindo' ANTES do await da RPC (fecha a janela de corrida de um segundo clique síncrono)", () => {
    const fnStart = redeTabSrc.indexOf("async function openChatWithUser");
    const fnEnd = redeTabSrc.indexOf("\n  }\n", fnStart);
    const fn = redeTabSrc.slice(fnStart, fnEnd);
    const setBeforeIdx = fn.indexOf(
      "setOpeningChatUserIds((prev) => new Set(prev).add(userId))"
    );
    const rpcIdx = fn.indexOf("abrirConversa1a1(supabase");
    expect(setBeforeIdx).toBeGreaterThan(-1);
    expect(setBeforeIdx).toBeLessThan(rpcIdx);
  });

  it("libera a guarda em `finally` -- sucesso OU erro sempre re-habilitam o botão (senão um erro travaria o botão pra sempre)", () => {
    const fnStart = redeTabSrc.indexOf("async function openChatWithUser");
    const fnEnd = redeTabSrc.indexOf("\n  }\n", fnStart);
    const fn = redeTabSrc.slice(fnStart, fnEnd);
    const finallyIdx = fn.indexOf("} finally {");
    expect(finallyIdx).toBeGreaterThan(-1);
    const finallyBlock = fn.slice(finallyIdx);
    expect(finallyBlock).toMatch(/next\.delete\(userId\)/);
  });

  it("duplicação real (múltiplas conversas na MESMA linha do banco) é garantia de servidor, provada em tests/rede/concurrency/conversas.concurrency.test.ts (RD-19) -- não reimplementada aqui", () => {
    // Só confirma que a ticket não introduziu um caminho de escrita
    // paralelo que pudesse escapar dessa garantia (já checado acima:
    // nenhum insert direto em rede_conversas a partir de RedeTab).
    expect(redeTabSrc).toContain("abrirConversa1a1(supabase, {");
  });
});

describe("RedeTab.openChatWithUser — falha visível, com possibilidade de nova tentativa", () => {
  it("erro é logado e vira toast (mesmo padrão de sendRequest/blockUser/etc.), nunca engolido em silêncio", () => {
    const fnStart = redeTabSrc.indexOf("async function openChatWithUser");
    const fnEnd = redeTabSrc.indexOf("\n  }\n", fnStart);
    const fn = redeTabSrc.slice(fnStart, fnEnd);
    expect(fn).toContain('console.error("[RedeTab abrir conversa]", e);');
    expect(fn).toMatch(/toast\.error\(".*Tente novamente\.?"\)/);
  });

  it("o catch não faz push de navegação nem insere conversa otimista -- só falha visivelmente, sem navegar pra um estado quebrado", () => {
    const fnStart = redeTabSrc.indexOf("async function openChatWithUser");
    const catchIdx = redeTabSrc.indexOf("} catch (e) {", fnStart);
    const finallyIdx = redeTabSrc.indexOf("} finally {", catchIdx);
    const catchBlock = redeTabSrc.slice(catchIdx, finallyIdx);
    expect(catchBlock).not.toContain("push(");
    expect(catchBlock).not.toContain("setConversations");
  });
});

describe("RedeTab — navegação chega à thread correta", () => {
  it("push usa o conversaId retornado pela RPC (não um id fixo/da conversa errada)", () => {
    const fnStart = redeTabSrc.indexOf("async function openChatWithUser");
    const fnEnd = redeTabSrc.indexOf("\n  }\n", fnStart);
    const fn = redeTabSrc.slice(fnStart, fnEnd);
    expect(fn).toMatch(
      /push\(\{ type: "chatThread", conversationId: conversaId \}\)/
    );
  });

  it("caminho de conversa já existente navega pelo id ENCONTRADO (existing.id), não por um novo", () => {
    const fnStart = redeTabSrc.indexOf("async function openChatWithUser");
    const fnEnd = redeTabSrc.indexOf("\n  }\n", fnStart);
    const fn = redeTabSrc.slice(fnStart, fnEnd);
    expect(fn).toContain("openChatThread(existing.id);");
  });
});
