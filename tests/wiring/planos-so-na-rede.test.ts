import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { abrePlanosSozinho } from "@/lib/assinatura";
import type { RedeAcessoTour } from "@/lib/appTour";

/**
 * R19rev #2: com o teste acabado, a tela dos planos abria sozinha (uma vez
 * por dia) em qualquer aba, cobrindo Início, Finanças e Agenda, e também
 * para quem entrou por convite (N4) e segue com a Rede. Agora ela só abre
 * sozinha na aba Rede, com a Rede fechada pela regra de acesso. Fora da
 * Rede, os planos só abrem por toque (Ajustes).
 */

const vencida = (
  naRede: boolean,
  redeAcesso: RedeAcessoTour,
  podeMostrar = true
) => abrePlanosSozinho({ podeMostrar, naRede, redeAcesso, status: "vencida" });

describe("abrePlanosSozinho", () => {
  it("teste acabou, sem assinatura nem convite: abre só ao abrir a Rede", () => {
    expect(vencida(true, "bloqueado")).toBe(true);
  });

  it("teste acabou: Início, Finanças e Agenda nunca abrem os planos sozinhos", () => {
    // Fora da Rede, o RedeGatedTab pode já ter dito "bloqueado" (a usuária
    // passou pela Rede antes): mesmo assim nada abre.
    for (const acesso of ["pendente", "bloqueado", "liberado"] as const) {
      expect(vencida(false, acesso)).toBe(false);
    }
  });

  it("N4 (convite usado) com o teste acabado: a Rede está liberada, nunca abre sozinha", () => {
    expect(vencida(true, "liberado")).toBe(false);
    expect(vencida(false, "liberado")).toBe(false);
  });

  it("enquanto a Rede ainda confere o acesso, não abre", () => {
    expect(vencida(true, "pendente")).toBe(false);
  });

  it("no teste ou com assinatura, nunca abre sozinha", () => {
    for (const status of ["trial", "ativa", null, undefined] as const) {
      expect(
        abrePlanosSozinho({
          podeMostrar: true,
          naRede: true,
          redeAcesso: "bloqueado",
          status,
        })
      ).toBe(false);
    }
  });

  it("com tour ou dados ainda carregando (podeMostrar falso), não abre", () => {
    expect(vencida(true, "bloqueado", false)).toBe(false);
  });
});

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("AssinaturaNoApp só abre os planos sozinha pela regra", () => {
  const noApp = ler("components/assinatura/AssinaturaNoApp.tsx");

  it("o efeito do fim do teste usa abrePlanosSozinho", () => {
    expect(noApp).toMatch(
      /if \(\s*!abrePlanosSozinho\(\{\s*podeMostrar: podeMostrarPlanos,\s*naRede,\s*redeAcesso,\s*status: efetivo\?\.status,?\s*\}\)\s*\)\s*return;/
    );
    expect(noApp).not.toMatch(
      /if \(!podeMostrarPlanos \|\| efetivo\?\.status !== "vencida"\) return;/
    );
  });

  for (const pagina of ["app/page.tsx", "app/dev-preview/app/page.tsx"]) {
    it(`${pagina}: passa a aba Rede e o acesso dela`, () => {
      const bloco = ler(pagina).match(/<AssinaturaNoApp[\s\S]*?\/>/)?.[0];
      expect(bloco).toBeTruthy();
      expect(bloco).toMatch(/naRede=\{activeTab === "rede"\}/);
      expect(bloco).toMatch(/redeAcesso=\{redeAcesso\}/);
    });
  }
});
