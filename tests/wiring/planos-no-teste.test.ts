import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PlanosTela } from "@/components/assinatura/PlanosTela";
import { AvisoTeste } from "@/components/assinatura/AvisoTeste";
import { TEXTOS_PLANOS } from "@/lib/textosPlanos";

/**
 * R17 M4 + R17rev N6: "Ver planos" no meio do teste (Ajustes, aviso dos 2
 * dias, pílula do último dia) abria "Seus 7 dias terminaram. ... Para seguir
 * usando, escolha um plano." com dias de teste ainda sobrando. A tela agora
 * recebe quantos dias faltam; `null` = o teste acabou (texto de sempre).
 */
function tela(faltam: number | null, diasDoTeste = 7): string {
  return renderToStaticMarkup(
    createElement(PlanosTela, {
      resumo: { atendimentos: 0, registrado: null },
      diasDoTeste,
      faltam,
      onEscolherPlano: () => {},
      onAgoraNao: () => {},
    })
  );
}

describe("PlanosTela durante o teste", () => {
  it("com 4 dias de teste, diz quantos faltam e não diz que terminou", () => {
    const html = tela(4);
    expect(html).toContain("Faltam 4 dias do seu teste");
    expect(html).not.toContain("terminaram");
    expect(html).not.toContain("Para seguir usando");
  });

  it("no último dia, singular", () => {
    const html = tela(1);
    expect(html).toContain("Falta 1 dia do seu teste");
    expect(html).not.toContain("Faltam 1");
    expect(html).not.toContain("Para seguir usando");
  });

  it("teste acabado fala da Rede (só ela para; capitão, 27/10), com os dias da conta", () => {
    const html = tela(null, 14);
    expect(html).toContain("Seus 14 dias terminaram");
    expect(html).toContain("Para seguir com a Rede, renove");
    expect(html).toContain("O resto do app continua liberado.");
    expect(html).not.toContain("Para seguir usando");
  });
});

describe("Depois do teste só a Rede para: nenhum texto diz que o app inteiro para", () => {
  it("o aviso dos 2 dias fala da Rede", () => {
    const html = renderToStaticMarkup(
      createElement(AvisoTeste, {
        faltam: 2,
        onVerPlanos: () => {},
        onFechar: () => {},
      })
    );
    expect(html).toContain("Rede");
    expect(html).toContain("O resto do app continua liberado.");
    expect(html).not.toContain("plano para continuar");
  });

  it("as boas-vindas (O teste termina) falam da Rede, com o menor preço por mês", () => {
    const fluxo = readFileSync(
      join(process.cwd(), "components/onboarding/OnboardingFlow.tsx"),
      "utf8"
    );
    expect(fluxo).not.toContain("Para continuar, você escolhe um plano");
    expect(fluxo).toMatch(
      /TEXTOS_PLANOS\.onboardingFim\(\s*formatMoeda\(menorPrecoPorMes\(moeda\), "auto"\)\s*\)/
    );
    expect(TEXTOS_PLANOS.onboardingFim("15 €")).toBe(
      "Para seguir com a Rede, você escolhe um plano, a partir de 15 € por mês."
    );
  });
});

describe("AssinaturaNoApp: as 3 entradas (Ajustes, aviso, pílula) abrem a mesma tela com os dias que faltam", () => {
  const noApp = readFileSync(
    join(process.cwd(), "components/assinatura/AssinaturaNoApp.tsx"),
    "utf8"
  );

  it("passa os dias da pílula (null fora do teste) para a PlanosTela", () => {
    expect(noApp).toMatch(
      /<PlanosTela[\s\S]{0,200}faltam=\{pilula\?\.faltam \?\? null\}/
    );
  });
});
