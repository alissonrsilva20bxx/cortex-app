import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Desejos são de Finanças, não da Rede (R19rev #1). Com o teste acabado e
 * sem assinatura, a dona cria, edita e apaga os próprios Desejos. Só a
 * publicação no feed (Rede) pede a Rede.
 */

const criarWishlistItem = vi.fn();
const garantirPerfil = vi.fn();
vi.mock("@/lib/rede/wishlist", () => ({
  criarWishlistItem: (...a: unknown[]) => criarWishlistItem(...a),
}));
vi.mock("@/lib/rede/perfis", () => ({
  garantirPerfil: (...a: unknown[]) => garantirPerfil(...a),
}));

import { criarDesejo } from "@/lib/desejo/criarDesejo";

const ROOT = join(__dirname, "..", "..");
const ler = (f: string) => readFileSync(join(ROOT, f), "utf8");
const client = {} as never;
const input = { nome: "Cadeira", cor: "#000", valorAlvo: 500 };
const dona = { userId: "u1", nome: "Ana" };
const item = { id: "d1", nome: "Cadeira" };

beforeEach(() => {
  criarWishlistItem.mockReset();
  garantirPerfil.mockReset();
});

describe("criarDesejo: o Desejo não pede a Rede", () => {
  it("banco com a 0049: cria sem criar perfil na Rede", async () => {
    criarWishlistItem.mockResolvedValueOnce(item);
    await expect(criarDesejo(client, input, dona)).resolves.toBe(item);
    expect(garantirPerfil).not.toHaveBeenCalled();
    expect(criarWishlistItem).toHaveBeenCalledTimes(1);
  });

  it("banco ainda sem a 0049 (a chave da dona é o perfil): cria o perfil e tenta de novo", async () => {
    criarWishlistItem
      .mockRejectedValueOnce({ code: "23503" })
      .mockResolvedValueOnce(item);
    await expect(criarDesejo(client, input, dona)).resolves.toBe(item);
    expect(garantirPerfil).toHaveBeenCalledWith(client, "u1", "Ana");
    expect(criarWishlistItem).toHaveBeenCalledTimes(2);
  });

  it("outro erro não cria perfil e chega a quem chamou", async () => {
    criarWishlistItem.mockRejectedValueOnce({ code: "42501" });
    await expect(criarDesejo(client, input, dona)).rejects.toEqual({
      code: "42501",
    });
    expect(garantirPerfil).not.toHaveBeenCalled();
  });
});

describe("Finanças não trava o Desejo pela Rede", () => {
  it("o app não passa mais a Rede para o card de Desejos", () => {
    for (const f of [
      "app/page.tsx",
      "app/dev-preview/app/page.tsx",
      "components/financeiro/FinanceiroTab.tsx",
      "components/financeiro/MetasTab.tsx",
      "components/financeiro/DesejosCard.tsx",
    ]) {
      expect(ler(f)).not.toMatch(/podeCriar|onAbrirRede/);
    }
  });

  it("o card cria pelo criarDesejo, sem garantir perfil nem tela de Rede", () => {
    const card = ler("components/financeiro/DesejosCard.tsx");
    expect(card).toMatch(/criarDesejo\(\s*supabase,/);
    expect(card).not.toContain("garantirPerfil");
    expect(card).not.toMatch(/semRede|semAcesso|bloqueado/);
  });

  it("o texto não manda renovar a Rede para criar Desejos", () => {
    const textos = ler("lib/desejo/textos.ts");
    expect(textos).not.toMatch(/renove a Rede/i);
    expect(textos).not.toMatch(/Desejos fazem parte da Rede/);
  });
});
