import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Desfazer o descanso de hoje (migration 0048): o app chama a RPC e, sem
 * ela aplicada, desfaz só no aparelho (tests/jornada/descanso-dia-
 * selecionado.test.ts). O comportamento no Postgres (os dois caminhos) está
 * em tests/jornada/desfazer-descanso-0048-pglite.mjs; aqui fica o que liga a
 * migration ao app e o que a deixa segura de aplicar.
 */

const ler = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf-8").replace(/\r\n/g, "\n");
const MIGRATION = ler("supabase/migrations/0048_jornada_desfazer_descanso.sql");
const SQL = MIGRATION.split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n");

describe("0048: desfazer o descanso de hoje", () => {
  it("cabeçalho: escrita, não aplicada, como desfazer e conferência", () => {
    expect(MIGRATION).toMatch(/ESCRITA, NÃO APLICADA/);
    expect(MIGRATION).toMatch(/Como desfazer:/);
    expect(MIGRATION).toMatch(
      /--\s+drop function if exists public\.jornada_desfazer_descanso\(text, integer\);/
    );
    expect(MIGRATION).toMatch(/Conferência/);
  });

  it("o app chama a RPC com o nome e os parâmetros da migration", () => {
    expect(SQL).toMatch(
      /create or replace function public\.jornada_desfazer_descanso\(\s*p_fuso text default null,\s*p_deslocamento_min integer default null\s*\)/
    );
    const servidor = ler("lib/jornada/servidor.ts");
    expect(servidor).toMatch(
      /chamar\(client, "jornada_desfazer_descanso", \{\s*p_fuso: fuso,\s*p_deslocamento_min: deslocamentoMin,\s*\}\)/
    );
    expect(ler("lib/jornada/cliente.ts")).toMatch(
      /desfazerDescanso: \(fuso, deslocamentoMin\) =>\s*desfazerDescansoNoServidor\(supabase, fuso, deslocamentoMin\)/
    );
  });

  it("só a usuária da sessão, só o descanso, só hoje", () => {
    expect(SQL).toMatch(/v_uid uuid := auth\.uid\(\);/);
    expect(SQL).toMatch(/security definer\s+set search_path = ''/);
    expect(SQL).toMatch(/a\.acao = 'descanso'/);
    expect(SQL).toMatch(/v_dia = v_hoje and coalesce\(v_ganhos, 0\) > 0/);
    expect(SQL).toMatch(/d\.marca = 'descanso'/);
    expect(SQL).toMatch(
      /revoke all on function public\.jornada_desfazer_descanso\(text, integer\)\s+from public, anon, authenticated, service_role;\s+grant execute on function public\.jornada_desfazer_descanso\(text, integer\)\s+to authenticated;/
    );
  });

  it("nada de tabela, coluna ou lista de dias nova (sem diário)", () => {
    expect(SQL).not.toMatch(/create table|alter table|add column/i);
  });
});
