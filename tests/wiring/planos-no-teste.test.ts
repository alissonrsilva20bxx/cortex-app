import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PlanosTela } from "@/components/assinatura/PlanosTela";

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

  it("teste acabado mantém o texto de antes, com os dias da conta", () => {
    const html = tela(null, 14);
    expect(html).toContain("Seus 14 dias terminaram");
    expect(html).toContain("Foi uma boa semana. Para seguir usando, escolha um plano.");
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
