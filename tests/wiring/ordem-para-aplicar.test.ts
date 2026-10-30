import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * supabase/ORDEM-PARA-APLICAR.md é o roteiro do capitão no SQL Editor.
 * Toda migration da 0040 em diante tem de estar nele, na ordem do número
 * (a 0048 faltava). A 0049 foi aplicada no banco real em 29/10, e a
 * conferência dela olha a versão final (FK, policy e grant), não só os
 * nomes das funções (R19rev3, BAIXA).
 */

const ordem = readFileSync(
  join(process.cwd(), "supabase/ORDEM-PARA-APLICAR.md"),
  "utf8"
).replace(/\r\n/g, "\n");

const migrations = readdirSync(join(process.cwd(), "supabase/migrations"))
  .filter((nome) => /^\d{4}_.*\.sql$/.test(nome))
  .filter((nome) => Number(nome.slice(0, 4)) >= 40)
  .sort();

/** O trecho do item da migration: do título "### N. `arquivo`" ao próximo. */
function secao(arquivo: string): string {
  const item = ordem
    .split(/\n(?=##+ )/)
    .find((b) => b.startsWith("### ") && b.split("\n")[0].includes(arquivo));
  expect(item, arquivo).toBeDefined();
  return item ?? "";
}

describe("ORDEM-PARA-APLICAR", () => {
  it("toda migration da 0040 em diante está na lista, na ordem do número", () => {
    expect(migrations).toContain("0048_jornada_desfazer_descanso.sql");
    const posicoes = migrations.map((nome) => ordem.indexOf(`\`${nome}\``));
    for (const [i, pos] of posicoes.entries())
      expect(pos, migrations[i]).toBeGreaterThan(-1);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });

  it("a 0048 diz como conferir e como desfazer", () => {
    const s = secao("0048_jornada_desfazer_descanso.sql");
    expect(s).toMatch(/jornada_desfazer_descanso/);
    expect(s).toMatch(
      /drop function if exists public\.jornada_desfazer_descanso\(text, integer\)/
    );
  });

  it("a 0049 está marcada como APLICADA em 29/10, com a pós-checagem", () => {
    const s = secao("0049_rede_acesso_por_teste.sql");
    expect(s).toMatch(/APLICADA em 29\/10\/2026/);
    expect(s).toMatch(/rede_wishlist_items_user_id_fkey/);
    expect(s).toMatch(/convalidated/);
    expect(s).toMatch(/rede_wishlist_items: owner insert/);
    expect(s).toMatch(
      /has_function_privilege\('authenticated', 'public\.rede_resgatar_convite\(text, text\)', 'execute'\)/
    );
  });

  it("a 0049 não é dada como aplicada só pelos nomes das funções", () => {
    expect(secao("0049_rede_acesso_por_teste.sql")).not.toMatch(
      /Se voltar 2 linhas, já está/
    );
  });
});
