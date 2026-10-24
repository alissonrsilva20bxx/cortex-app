import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACOES_DA_DICA } from "@/lib/jornada/estado";

/**
 * Missão da dica (migration 0047): a curtida numa dica credita a autora
 * por um gatilho em rede_curtidas. O app não muda, então funciona igual com
 * e sem a migration aplicada. O comportamento no Postgres (os dois
 * caminhos) está em tests/jornada/dica-curtida-0047-pglite.mjs; aqui fica
 * o que liga a migration ao app e o que a deixa segura de aplicar.
 */

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");
const MIGRATION = ler("supabase/migrations/0047_jornada_dica_curtida.sql");
const SQL = MIGRATION.split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n");

describe("0047: curtida em dica conta Sua dica ajudou", () => {
  it("cabeçalho: escrita, não aplicada, como desfazer e conferência", () => {
    expect(MIGRATION).toMatch(/ESCRITA, NÃO APLICADA/);
    expect(MIGRATION).toMatch(/Como desfazer:/);
    expect(MIGRATION).toMatch(
      /--\s+drop trigger if exists rede_curtidas_credita_dica on public\.rede_curtidas;/
    );
    expect(MIGRATION).toMatch(/Conferência/);
    expect(MIGRATION).toMatch(/tgname = 'rede_curtidas_credita_dica'/);
  });

  it("o gatilho fica na tabela que o app usa para curtir", () => {
    expect(SQL).toMatch(
      /create trigger rede_curtidas_credita_dica\s+after insert on public\.rede_curtidas\s+for each row execute function private\.jornada_dica_curtida\(\);/
    );
    // Se o alternarCurtida deixar de gravar em rede_curtidas, o gatilho
    // para de contar sem ninguém ver.
    const feed = ler("lib/rede/feed.ts");
    const curtir = feed.slice(feed.indexOf("export async function alternarCurtida"));
    expect(curtir).toMatch(/\.from\("rede_curtidas"\)\s*\.upsert\(/);
  });

  it("credita só dica_ajudou, a ação que a missão ativa lê", () => {
    expect(ACOES_DA_DICA).toContain("dica_ajudou");
    expect(SQL).toMatch(
      /perform private\.jornada_creditar_dica\(new\.post_id, 'dica_ajudou'\)/
    );
    expect(SQL).not.toMatch(/dica_protegeu/);
    // A trinca da 0036 que tem a missão "Sua dica ajudar 3 vezes".
    expect(ler("supabase/migrations/0036_jornada_prototipo.sql")).toMatch(
      /\(2, 3, 'dica_ajudou', 3\)/
    );
  });

  it("só dica de outra pessoa, uma vez por pessoa", () => {
    expect(SQL).toMatch(/p\.categoria = 'dica'/);
    expect(SQL).toMatch(/v_autora = new\.user_id/);
    expect(SQL).toMatch(
      /primary key \(post_id, user_id\)[\s\S]*on conflict do nothing;\s+if found then/
    );
  });

  it("a curtida nunca quebra por causa da Jornada", () => {
    expect(SQL).toMatch(/exception when others then\s+raise warning/);
    expect(SQL).toMatch(/return null;\s+end;\s+\$\$;/);
  });

  it("interno e seguro: definer com search_path vazio, sem acesso do cliente", () => {
    expect(SQL).toMatch(/security definer\s+set search_path = ''/);
    expect(SQL).toMatch(
      /revoke all on function private\.jornada_dica_curtida\(\)\s+from public, anon, authenticated, service_role;/
    );
    expect(SQL).toMatch(
      /revoke all on table private\.jornada_dica_creditos\s+from public, anon, authenticated, service_role;/
    );
    expect(SQL).toMatch(/enable row level security/);
    expect(SQL).not.toMatch(/\bgrant\b/);
  });

  it("pode rodar duas vezes sem erro", () => {
    expect(SQL).toMatch(/create table if not exists private\.jornada_dica_creditos/);
    expect(SQL).toMatch(/create or replace function private\.jornada_dica_curtida/);
    expect(SQL).toMatch(/drop trigger if exists rede_curtidas_credita_dica/);
  });

  it("está na ordem para aplicar", () => {
    expect(ler("supabase/ORDEM-PARA-APLICAR.md")).toMatch(
      /`0047_jornada_dica_curtida\.sql`/
    );
  });
});
