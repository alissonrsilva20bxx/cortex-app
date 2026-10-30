import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * lib/database.types.ts depois da 0049 (aplicada em 29/10). A 0049 trocou a
 * FK de rede_wishlist_items.user_id: era para rede_perfis (só quem está na
 * Rede tinha Desejo), agora é para auth.users (Desejo é de Finanças). O
 * gerador do Supabase não lista FK para outro schema (como auth.users;
 * veja `configuracoes`, com `Relationships: []`), então a relação antiga
 * sai e fica vazia. A 0049 não apaga as tabelas nem as funções de convite e
 * beta (só tira o EXECUTE da sessão): elas continuam nos tipos.
 */

const tipos = readFileSync(
  join(process.cwd(), "lib/database.types.ts"),
  "utf8"
).replace(/\r\n/g, "\n");

function tabela(nome: string): string {
  const inicio = tipos.indexOf(`\n      ${nome}: {\n`);
  expect(inicio).toBeGreaterThan(-1);
  const resto = tipos.slice(inicio + 1);
  const fim = resto.search(/\n {6}[a-z_]+: \{\n|\n {4}Views: \{/);
  return resto.slice(0, fim);
}

describe("tipos do banco depois da 0049", () => {
  it("o Desejo não aponta mais para o perfil da Rede", () => {
    const desejo = tabela("rede_wishlist_items");
    expect(desejo).toMatch(/Relationships: \[\];/);
    expect(desejo).not.toMatch(/referencedRelation: "rede_perfis"/);
  });

  it("como as outras tabelas presas à conta (auth.users)", () => {
    expect(tabela("configuracoes")).toMatch(/Relationships: \[\];/);
  });

  it("convite e beta continuam no banco e nos tipos", () => {
    tabela("rede_convites");
    tabela("rede_solicitacoes_beta");
    for (const funcao of [
      "rede_resgatar_convite",
      "rede_gerar_convite",
      "rede_aprovar_solicitacao_beta",
      "rede_is_member",
      "rede_criar_conversa_1a1",
    ]) {
      expect(tipos).toMatch(new RegExp(`\\n {6}${funcao}: \\{`));
    }
  });
});
