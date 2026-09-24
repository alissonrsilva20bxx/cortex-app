import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Fiação do cache SWR do Cofre (`lib/cofre/cofreCache.ts` +
 * `components/cofre/CofreTab.tsx`). Teste de código-fonte, mesmo padrão de
 * `tests/wiring/rede-cache.test.ts` -- o projeto não roda RTL/JSX no
 * vitest, então ler os arquivos como texto pega a regressão que importa:
 * o defeito confirmado manualmente era exatamente "toda entrada no Cofre
 * depois do PIN mostra carregamento de novo", causado por `setFiles([])`
 * no efeito de trava + `setLoading(true)` incondicional no efeito de
 * busca.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("CofreTab semeia estado do cache SWR (sem spinner no remount)", () => {
  const src = read("components/cofre/CofreTab.tsx");

  it("importa o módulo de cache do Cofre", () => {
    expect(src).toMatch(/from "@\/lib\/cofre\/cofreCache"/);
  });

  it("calcula a semente síncrona no render e vincula a conta antes de ler", () => {
    expect(src).toMatch(/cofreCache\.vincularUsuario\(userId\)/);
    expect(src).toMatch(/cofreCache\.ler\(userId\)/);
  });

  it("files/loading nascem a partir da semente, não de valores fixos", () => {
    expect(src).toMatch(
      /useState<CofreFile\[\]>\(\s*\(\) => semente\.files \?\? \[\]\s*\)/
    );
    expect(src).toMatch(/useState\(\s*\(\) => semente\.files === null\s*\)/);
  });
});

describe("sair da aba / perder foco bloqueia a interface sem destruir o cache", () => {
  const src = read("components/cofre/CofreTab.tsx");

  it("o efeito de troca de `active` não apaga mais `files` (era o bug)", () => {
    const bloco = src.match(
      /useEffect\(\(\) => \{\s*setUnlocked\(\(prev\) => nextUnlockedOnActiveChange\(active, prev\)\);[\s\S]*?\}, \[active\]\);/
    )?.[0];
    expect(bloco).toBeTruthy();
    expect(bloco).not.toMatch(/setFiles\(\[\]\)/);
  });

  it("o efeito de blur/visibilitychange/pagehide (`lock`) não apaga mais `files`", () => {
    const bloco = src.match(
      /function lock\(\) \{\s*setUnlocked\(nextUnlockedOnLoseFocus\(\)\);[\s\S]*?\n {4}\}/
    )?.[0];
    expect(bloco).toBeTruthy();
    expect(bloco).not.toMatch(/setFiles\(\[\]\)/);
  });

  it("em todo o arquivo não sobra nenhum `setFiles([])` -- só `setFiles(all)` (revalidação)", () => {
    expect(src).not.toMatch(/setFiles\(\[\]\)/);
    expect(src).toMatch(/setFiles\(all\)/);
  });
});

describe("busca dos arquivos vira SWR: cache hit não liga o spinner", () => {
  const src = read("components/cofre/CofreTab.tsx");

  it("só liga `setLoading(true)` quando não há cache (`!temCache`)", () => {
    expect(src).toMatch(/const temCache = cofreCache\.ler\(userId\) !== null;/);
    expect(src).toMatch(/if \(!temCache\) setLoading\(true\);/);
    // não deve existir mais o `setLoading(true)` incondicional do bug original
    expect(src).not.toMatch(
      /if \(gateState !== "content"\) return;\s*setLoading\(true\);/
    );
  });

  it("escreve no cache com a época capturada no início do fetch (protege contra resposta atrasada)", () => {
    expect(src).toMatch(/const ep = cofreCache\.epocaAtual\(\);/);
    expect(src).toMatch(/cofreCache\.escrever\(userId, all, ep\);/);
    expect(src).toMatch(/cofreCache\.epocaAtual\(\) !== ep\) return;/);
  });

  it("erro na revalidação não apaga `files` -- só encerra o loading", () => {
    const catchBloco = src.match(
      /\.catch\(\(e\) => \{[\s\S]*?setLoading\(false\);\s*\}\);/
    )?.[0];
    expect(catchBloco).toBeTruthy();
    expect(catchBloco).not.toMatch(/setFiles/);
  });

  it("refreshTrigger continua nas deps do efeito (upload revalida sem remontar)", () => {
    expect(src).toMatch(/\}, \[userId, refreshTrigger, gateState\]\);/);
  });
});

describe("gate de PIN continua intacto (o cache não pode furar a trava)", () => {
  const src = read("components/cofre/CofreTab.tsx");

  it('gateState "hidden" e "locked" continuam retornando antes de qualquer conteúdo', () => {
    expect(src).toMatch(/if \(gateState === "hidden"\) \{\s*return null;/);
    expect(src).toMatch(/if \(gateState === "locked"\) \{/);
  });

  it("o efeito de busca só roda quando o gate é content", () => {
    expect(src).toMatch(
      /useEffect\(\(\) => \{\s*if \(gateState !== "content"\) return;/
    );
  });
});

describe("logout limpa o cache do Cofre (req 4/6)", () => {
  it("handleSignOut em app/page.tsx zera o cache do Cofre antes de sair", () => {
    const page = read("app/page.tsx");
    expect(page).toMatch(/from "@\/lib\/cofre\/cofreCache"/);
    expect(page).toMatch(
      /handleSignOut[\s\S]*?cofreCache\.limparTudo\(\);[\s\S]*?supabase\.auth\.signOut\(\)/
    );
  });
});

describe("nenhum signed URL é escrito no cache", () => {
  it("cofreCache.ts não define nem aceita campo de signed URL", () => {
    const cache = read("lib/cofre/cofreCache.ts");
    expect(cache).not.toMatch(/signedUrl/i);
  });

  it("a signed URL é sempre gerada sob demanda em openFile, nunca a partir do cache", () => {
    const src = read("components/cofre/CofreTab.tsx");
    expect(src).toMatch(
      /async function openFile\(path: string\) \{\s*const \{ data \} = await supabase\.storage\s*\.from\("cofre"\)\s*\.createSignedUrl\(path, 120\);/
    );
  });
});
