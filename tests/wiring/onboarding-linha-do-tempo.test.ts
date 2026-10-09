import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Onboarding "Linha do tempo" (desenho em
 * docs/jornada/referencias/onboarding-linha-do-tempo.html): três telas de
 * boas-vindas com o teste de 7 dias, a pílula do contador no Início e a
 * escolha de plano no fim do teste, com `onEscolherPlano` como porta do
 * Pagamento. Inspeção de código-fonte (o vitest roda em "node", sem DOM),
 * como os outros testes de fiação.
 */
const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const flow = ler("components/onboarding/OnboardingFlow.tsx");
const pagina = ler("app/page.tsx");
const lab = ler("app/dev-preview/app/page.tsx");
const noApp = ler("components/assinatura/AssinaturaNoApp.tsx");
const planos = ler("components/assinatura/PlanosTela.tsx");
const pilula = ler("components/assinatura/PilulaTeste.tsx");
const css = ler("components/onboarding/linhaDoTempo.module.css");

describe("OnboardingFlow: as três telas da linha do tempo", () => {
  it("abre pelas três telas antes de meta/atendimento/PIN", () => {
    expect(flow).toMatch(
      /const INTRO: Step\[\] = \["boasVindas", "incluso", "linha"\]/
    );
    expect(flow).toMatch(
      /if \(introPasso < INTRO\.length\) step = INTRO\[introPasso\]/
    );
  });

  it("cada CTA avança uma tela", () => {
    expect(flow).toMatch(
      /onAvancar=\{\(\) => setIntroPasso\(\(n\) => n \+ 1\)\}/
    );
    expect((flow.match(/onClick=\{onAvancar\}/g) ?? []).length).toBe(3);
  });

  it("Pular encerra o onboarding (onComplete), como o 'pular' de antes", () => {
    expect(flow).toMatch(/onPular=\{onComplete\}/);
    expect(flow).toMatch(/onClick=\{onPular\}\s*data-onboarding-pular/);
  });

  it("os textos usam TRIAL_DIAS e o menor preço, sem número solto", () => {
    expect(flow).toMatch(/Começar meus \{TRIAL_DIAS\} dias/);
    expect(flow).toMatch(/Dia \{TRIAL_DIAS - 2\}/);
    expect(flow).toMatch(/formatarEuro\(menorPrecoPorMes\(\)\)/);
  });

  it("a boas-vindas antiga saiu", () => {
    expect(flow).not.toMatch(/Bom te ver|welcomeDismissed/);
  });
});

describe("AssinaturaNoApp nas duas páginas", () => {
  for (const [nome, src] of [
    ["app/page.tsx", pagina],
    ["dev-preview", lab],
  ] as const) {
    it(`${nome}: monta com o estado do Início e a porta do Pagamento`, () => {
      expect(src).toMatch(
        /<AssinaturaNoApp[\s\S]*?onEscolherPlano=\{escolherPlano\}/
      );
      expect(src).toMatch(
        /noInicio=\{\s*activeTab === "home" && !tourOpen && !jornadaAberta && !fabOpen\s*\}/
      );
      expect(src).toMatch(/podeMostrarPlanos=\{dataLoaded && !tourOpen\}/);
    });

    it(`${nome}: escolherPlano guarda a escolha e leva aos Ajustes`, () => {
      const corpo = src.match(
        /const escolherPlano: OnEscolherPlano = \(plano\) => \{[\s\S]*?\n {2}\};/
      )?.[0];
      expect(corpo).toBeTruthy();
      expect(corpo).toMatch(/guardarPlanoEscolhido\(usuario\.id, plano\)/);
      expect(corpo).toMatch(/handleTabChange\("ajustes"\)/);
    });
  }

  it("lê trial_started_at e assinatura_status e calcula com computeAssinatura", () => {
    expect(noApp).toMatch(/select\("trial_started_at, assinatura_status"\)/);
    expect(noApp).toMatch(/computeAssinatura\(/);
  });

  it("pílula só no Início, só no teste e some com os planos abertos", () => {
    expect(noApp).toMatch(/const pilula = estadoDaPilula\(efetivo\)/);
    expect(noApp).toMatch(/\{pilula && noInicio && !planosAbertos && \(/);
  });

  it("teste vencido abre os planos sozinho uma vez por dia", () => {
    expect(noApp).toMatch(
      /if \(!podeMostrarPlanos \|\| efetivo\?\.status !== "vencida"\) return;/
    );
    expect(noApp).toMatch(
      /localStorage\.getItem\(chavePlanosVistos\(userId\)\) === hoje\(\)\) return;/
    );
  });

  it("'Ver planos' do último dia abre a escolha; escolher fecha e chama a porta", () => {
    expect(noApp).toMatch(/onVerPlanos=\{\(\) => setPlanosAbertos\(true\)\}/);
    expect(noApp).toMatch(
      /onEscolherPlano=\{\(plano\) => \{\s*setPlanosAbertos\(false\);\s*onEscolherPlano\(plano\);/
    );
    expect(noApp).toMatch(/onAgoraNao=\{\(\) => setPlanosAbertos\(false\)\}/);
  });
});

describe("PlanosTela e PilulaTeste", () => {
  it("o CTA chama onEscolherPlano com o plano marcado", () => {
    expect(planos).toMatch(/useState<PlanoId>\(PLANO_PADRAO\)/);
    expect(planos).toMatch(/onClick=\{\(\) => setMarcado\(p\.id\)\}/);
    expect(planos).toMatch(
      /onClick=\{\(\) => onEscolherPlano\(plano\)\}\s*data-escolher-plano/
    );
  });

  it("selo 'preço por tempo limitado' só nos planos com preço cheio", () => {
    expect(planos).toMatch(
      /\{p\.cheio != null && \(\s*<span className=\{styles\.lim\}>[\s\S]*?preço por tempo limitado/
    );
  });

  it("a pílula fica acima da barra e do botão +", () => {
    expect(pilula).toMatch(
      /const BOTTOM = BOTTOM_NAV_OFFSET \+ BOTTOM_NAV_FAB_SIZE \+ 14;/
    );
    expect(pilula).toMatch(/"--ob-pilula-bottom": `\$\{BOTTOM\}px`/);
  });
});

describe("tema: só tokens", () => {
  it("o CSS usa os tokens do tema, sem a cor fixa do desenho", () => {
    expect(css).toMatch(/var\(--t-acc\)/);
    expect(css).toMatch(/:global\(\[data-mode="light"\]\)/);
    // O "J" (.bigj) é o ícone do app, marca fixa em todos os temas.
    const semIcone = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\.bigj[^{]*\{[^}]*\}/g, "");
    expect(semIcone.toLowerCase()).not.toMatch(/#d6105c|#ff2d78|255, 45, 120/);
    expect(css).toMatch(/\.bigj b \{[^}]*color: #ff2d78/);
  });
});
