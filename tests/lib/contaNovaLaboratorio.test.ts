import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aplicarContaNova,
  buildMockAppSeed,
  MOCK_APP_USER_ID,
} from "@/lib/mockAppData";

/**
 * `?conta=nova` do laboratório (R21): a pessoa que acabou de criar a conta,
 * para ver os estados vazios de cada tela sem banco. Nada dela; o teste
 * grátis começa hoje; as publicações das outras continuam na Rede.
 */
describe("conta nova no laboratório", () => {
  const t = aplicarContaNova(buildMockAppSeed());
  const uid = MOCK_APP_USER_ID;

  it("nenhum dado da pessoa", () => {
    for (const tabela of [
      "jobs",
      "metas",
      "despesas",
      "receitas_avulsas",
      "objetivos",
      "notas",
      "rede_wishlist",
      "rede_clientes",
      "rede_livelinks",
      "rede_amizades",
      "rede_conversas",
      "rede_mensagens",
    ])
      expect(t.tables[tabela] ?? [], tabela).toEqual([]);
    expect(t.cofreFiles).toEqual([]);
    expect(t.tables.rede_perfis.some((p) => p.user_id === uid)).toBe(false);
    expect(t.tables.rede_posts.some((p) => p.autor_id === uid)).toBe(false);
    expect(t.tables.rede_curtidas.some((c) => c.user_id === uid)).toBe(false);
  });

  it("o teste grátis começa hoje", () => {
    const [cfg] = t.tables.configuracoes;
    expect(cfg.assinatura_status).toBe("trial");
    const inicio = new Date(String(cfg.trial_started_at)).getTime();
    expect(Math.abs(Date.now() - inicio)).toBeLessThan(60_000);
  });

  it("as publicações das outras continuam", () => {
    expect(t.tables.rede_posts.length).toBeGreaterThan(0);
  });

  it("o laboratório liga o ?conta=nova, com a Jornada da conta nova", () => {
    const pagina = readFileSync(
      join(process.cwd(), "app/dev-preview/app/page.tsx"),
      "utf8"
    );
    expect(pagina).toMatch(/get\("conta"\) === "nova"/);
    expect(pagina).toMatch(/contaNova \? aplicarContaNova\(/);
    expect(pagina).toMatch(/jornadaParam === "nova" \|\| contaNova/);
  });
});
