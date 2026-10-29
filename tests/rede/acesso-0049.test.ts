import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CORTE_TRIAL_7_DIAS, diasDoTeste } from "@/lib/assinatura";

/**
 * Migration 0049: a Rede abre pelo teste ou pela assinatura, sem código.
 * O comportamento no Postgres (a tabela de casos, a RLS, o N1, a 0040 e o
 * rollback) está em tests/rede/acesso-0049-pglite.mjs; a RLS no homolog,
 * em tests/rede/rls/rede-acesso-0049.rls.test.ts. Aqui fica o que liga a
 * migration ao app e o que a deixa segura de aplicar.
 */

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");
const semComentario = (sql: string) =>
  sql
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n");
const ARQUIVO = "supabase/migrations/0049_rede_acesso_por_teste.sql";
const ROLLBACK =
  "supabase/migrations-rollback/0049_rede_acesso_por_teste.rollback.sql";
const MIGRATION = ler(ARQUIVO);
const SQL = semComentario(MIGRATION);

/** O corpo de `create or replace function <nome>` até o `$$;` final. */
function corpo(sql: string, nome: string): string {
  const inicio = sql.indexOf(`create or replace function ${nome}`);
  expect(inicio).toBeGreaterThan(-1);
  const fim = sql.indexOf("$$;", sql.indexOf("$$", inicio) + 2);
  return sql.slice(inicio, fim);
}

describe("0049: entrada na Rede pelo teste ou pela assinatura", () => {
  it("cabeçalho: escrita, não aplicada, ordem, como reverter e conferência", () => {
    expect(MIGRATION).toMatch(/ESCRITA, NÃO APLICADA/);
    expect(MIGRATION).toMatch(/ORDEM PARA APLICAR/);
    expect(MIGRATION).toMatch(/0040_assinatura_so_servidor\.sql aplicada/);
    expect(MIGRATION).toMatch(/COMO REVERTER/);
    expect(MIGRATION).toMatch(/Conferência/);
  });

  it("para com erro se a 0040 não estiver aplicada (N2)", () => {
    // O nome do gatilho tem de ser o que a 0040 cria.
    expect(ler("supabase/migrations/0040_assinatura_so_servidor.sql")).toMatch(
      /create trigger configuracoes_assinatura_so_servidor/
    );
    const guarda = SQL.slice(0, SQL.indexOf("create schema"));
    expect(guarda).toMatch(
      /t\.tgname = 'configuracoes_assinatura_so_servidor'/
    );
    expect(guarda).toMatch(/raise exception '0049: aplique antes a 0040/);
  });

  it("a regra do banco tem o corte e os dias do app", () => {
    const regra = corpo(SQL, "private.rede_usuario_e_membro_em");
    expect(regra).toMatch(/c\.assinatura_status = 'ativa'/);
    expect(regra).toMatch(/hours => 24 \*/);
    expect(regra).toMatch(/then 14\s+else 7/);
    expect(CORTE_TRIAL_7_DIAS).toBe("2026-10-09T00:00:00Z");
    expect(regra).toMatch(/timestamptz '2026-10-09 00:00:00\+00'/);
    expect(diasDoTeste("2026-10-08T23:59:59Z")).toBe(14);
    expect(diasDoTeste("2026-10-09T00:00:00Z")).toBe(7);
    // N4: o convite usado continua valendo.
    expect(regra).toMatch(/convite\.usado_por = alvo/);
  });

  it("rede_is_member() usa a regra para a própria sessão", () => {
    expect(corpo(SQL, "public.rede_is_member")).toMatch(
      /select private\.rede_usuario_e_membro\(auth\.uid\(\)\);/
    );
  });

  it("N1: conversa e denúncia olham a outra pessoa pela regra, não pelo convite", () => {
    const conversa = corpo(SQL, "public.rede_criar_conversa_1a1");
    expect(conversa).toMatch(/private\.rede_usuario_e_membro\(outro_user_id\)/);
    expect(conversa).not.toMatch(/rede_convites/);
    const denuncia = corpo(SQL, "private.rede_denuncia_alvo_valido");
    expect(denuncia).toMatch(/private\.rede_usuario_e_membro\(u\.id\)/);
    expect(denuncia).not.toMatch(/rede_convites/);
  });

  it("código e beta não são mais chamados pela sessão", () => {
    for (const f of [
      "rede_resgatar_convite\\(text, text\\)",
      "rede_gerar_convite\\(text\\)",
      "rede_aprovar_solicitacao_beta\\(uuid\\)",
    ]) {
      expect(SQL).toMatch(
        new RegExp(
          `revoke execute on function public\\.${f}\\s+from public, anon, authenticated;`
        )
      );
    }
  });

  it("a regra não fica exposta na API", () => {
    expect(SQL).toMatch(
      /revoke all on function private\.rede_usuario_e_membro\(uuid\)\s+from public, anon, authenticated;/
    );
    expect(SQL).not.toMatch(
      /grant execute on function private\.[^;]*to[^;]*authenticated/
    );
  });

  it("o rollback fica fora de supabase/migrations e volta ao convite", () => {
    expect(existsSync(join(process.cwd(), ROLLBACK))).toBe(true);
    const volta = semComentario(ler(ROLLBACK));
    expect(corpo(volta, "public.rede_is_member")).toMatch(
      /from public\.rede_convites\s+where usado_por = auth\.uid\(\)/
    );
    expect(volta).toMatch(
      /drop function if exists private\.rede_usuario_e_membro\(uuid\);/
    );
    expect(volta).toMatch(
      /grant execute on function public\.rede_resgatar_convite\(text, text\)\s+to authenticated, service_role;/
    );
    expect(MIGRATION).toContain(ROLLBACK);
  });

  it("o app não chama mais código nem beta", () => {
    const telas = [
      "components/rede/RedeGatedTab.tsx",
      "lib/rede/acessoRede.ts",
      "app/page.tsx",
    ].map(ler);
    for (const t of telas) {
      expect(t).not.toMatch(/rede_resgatar_convite|rede_solicitacoes_beta/);
    }
    expect(existsSync(join(process.cwd(), "app/api/rede/convites"))).toBe(
      false
    );
    expect(existsSync(join(process.cwd(), "app/api/rede/solicitar-beta"))).toBe(
      false
    );
  });

  it("está na ordem para aplicar, depois da 0040", () => {
    const ordem = ler("supabase/ORDEM-PARA-APLICAR.md");
    const i0040 = ordem.indexOf("`0040_assinatura_so_servidor.sql`");
    const i0049 = ordem.indexOf("`0049_rede_acesso_por_teste.sql`");
    expect(i0040).toBeGreaterThan(-1);
    expect(i0049).toBeGreaterThan(i0040);
  });
});
