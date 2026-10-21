import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CASCA_PADDING_FIM,
  espacoExtraParaPilulaPx,
  PILULA_TESTE_ALTURA,
  PILULA_TESTE_BOTTOM,
  PILULA_TESTE_FOLGA,
} from "@/lib/bottomNavCompactStyle";

/**
 * A pílula "Faltam N dias de teste" flutua por cima do conteúdo do Início e
 * não pode cobrir botão: o fim da tela tem espaço para o último botão
 * rolar até ficar livre dela. Não renderiza (sem DOM no Vitest): confere a
 * conta do espaço e a fiação pelo código como texto.
 */

const ler = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf-8");

describe("espaço do fim do Início para a pílula do teste", () => {
  it("o topo da pílula, mais a folga, cabe no que a casca e o espaço extra deixam", () => {
    const topoDaPilula = PILULA_TESTE_BOTTOM + PILULA_TESTE_ALTURA;
    expect(CASCA_PADDING_FIM + espacoExtraParaPilulaPx()).toBeGreaterThanOrEqual(
      topoDaPilula + PILULA_TESTE_FOLGA
    );
  });

  it("a pílula usa a mesma distância do fundo que a conta", () => {
    expect(ler("components/assinatura/PilulaTeste.tsx")).toContain(
      'import { PILULA_TESTE_BOTTOM as BOTTOM } from "@/lib/bottomNavCompactStyle"'
    );
  });

  it("a altura da conta é a do CSS da pílula", () => {
    expect(ler("components/onboarding/linhaDoTempo.module.css")).toMatch(
      /\.trial \{[^}]*height: 44px;/
    );
    expect(PILULA_TESTE_ALTURA).toBe(44);
  });

  it("a casca deixa mesmo o que a conta supõe (pb-40 = 160px)", () => {
    expect(CASCA_PADDING_FIM).toBe(160);
    expect(ler("app/page.tsx")).toContain("no-scrollbar pb-40 px-4");
  });

  it("o espaço soma a área segura do iPhone, que também sobe a pílula", () => {
    expect(ler("components/assinatura/EspacoDaPilula.tsx")).toContain(
      "env(safe-area-inset-bottom, 0px)"
    );
    expect(ler("components/onboarding/linhaDoTempo.module.css")).toContain(
      "env(safe-area-inset-bottom, 0px)"
    );
  });

  it.each(["app/page.tsx", "app/dev-preview/app/page.tsx"])(
    "%s põe o espaço no fim do Início, depois do convite de instalação",
    (arq) => {
      const src = ler(arq);
      const banner = src.indexOf("<InstallBanner />");
      const espaco = src.indexOf("<EspacoDaPilula />");
      expect(banner).toBeGreaterThan(0);
      expect(espaco).toBeGreaterThan(banner);
    }
  );
});
