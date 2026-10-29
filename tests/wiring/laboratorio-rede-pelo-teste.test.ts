import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMockAppSeed } from "@/lib/mockAppData";
import { regraAcessoRede } from "@/lib/rede/acessoRede";

/**
 * O laboratório (/dev-preview/app) entra na Rede como uma conta nova: pelo
 * teste grátis, sem convite. `?teste=acabou` mostra a renovação da Rede,
 * com o botão "Ver planos" ligado à escolha de plano, como no app.
 */

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");

function acessoDaSemente(testeAcabou: boolean) {
  const { tables } = buildMockAppSeed({ testeAcabou });
  const config = tables.configuracoes[0] as {
    assinatura_status: string;
    trial_started_at: string;
  };
  return regraAcessoRede({
    assinaturaStatus: config.assinatura_status,
    trialStartedAt: config.trial_started_at,
    temConvite: tables.rede_convites.length > 0,
  });
}

describe("laboratório: a Rede entra pelo teste grátis", () => {
  it("a semente não tem convite e entra pelo teste", () => {
    expect(buildMockAppSeed().tables.rede_convites).toEqual([]);
    expect(acessoDaSemente(false)).toMatchObject({
      liberado: true,
      por: "teste",
    });
  });

  it("?teste=acabou: sem teste e sem assinatura, a Rede fecha", () => {
    expect(acessoDaSemente(true)).toEqual({ liberado: false });
    const lab = ler("app/dev-preview/app/page.tsx");
    expect(lab).toMatch(/get\("teste"\) === "acabou"/);
    expect(lab).toMatch(
      /buildMockAppSeed\(\{ objetivosCount, testeAcabou \}\)/
    );
  });

  it("a Rede do laboratório abre a escolha de plano, como o app", () => {
    const lab = ler("app/dev-preview/app/page.tsx");
    const rede = lab.slice(lab.indexOf("<RedeGatedTab"));
    const props = rede.slice(0, rede.indexOf("/>"));
    expect(props).toMatch(
      /onVerPlanos=\{\(\) => setAbrirPlanos\(\(n\) => n \+ 1\)\}/
    );
    expect(props).toMatch(/recarregarSinal=\{releituraAssinatura\}/);
  });

  it("sem sessão de teste do portão de código no laboratório", () => {
    const lab = ler("app/dev-preview/app/page.tsx");
    expect(lab).not.toMatch(/enableDevPreviewGateSession|devPreviewSession/);
    expect(lab).not.toMatch(/Solicitar beta|resgatar código/);
  });
});
