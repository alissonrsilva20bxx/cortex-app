import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Fiação do Pagamento "C Transparente" (Stripe embutido). O comportamento
 * das rotas e do webhook é executado em tests/pagamento/*; aqui, a ligação
 * entre as peças e as regras que não podem voltar atrás.
 */
const ROOT = join(__dirname, "..", "..");
const ler = (...p: string[]) =>
  readFileSync(join(ROOT, ...p), "utf-8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'])\/\/.*$/gm, "$1");

const tela = ler("components", "pagamento", "PagamentoTela.tsx");
const cliente = ler("lib", "pagamento", "cliente.ts");
const page = ler("app", "page.tsx");
const lab = ler("app", "dev-preview", "app", "page.tsx");
const middleware = ler("middleware.ts");
const webhook = ler("app", "api", "pagamento", "webhook", "route.ts");
const rota = ler("app", "api", "pagamento", "assinatura", "route.ts");
const stripeApi = ler("lib", "pagamento", "stripeApi.ts");

describe("ligado ao onEscolherPlano do onboarding", () => {
  it("escolher um plano abre o Pagamento com ele", () => {
    expect(page).toMatch(
      /const escolherPlano: OnEscolherPlano = \(plano\) => \{[\s\S]{0,120}setPlanoNoPagamento\(plano\);/
    );
    expect(page).toMatch(/<PagamentoTela\s+plano=\{planoNoPagamento\}/);
    expect(page).toMatch(/onEscolherPlano=\{escolherPlano\}/);
  });

  it("Voltar no Pagamento reabre a escolha de plano", () => {
    expect(page).toMatch(
      /onVoltar=\{\(\) => \{\s*setPlanoNoPagamento\(null\);\s*setReabrirPlanos\(\(n\) => n \+ 1\);/
    );
    expect(page).toMatch(/abrirPlanosSinal=\{reabrirPlanos\}/);
  });

  it("o laboratório espelha a página", () => {
    expect(lab).toMatch(/setPlanoNoPagamento\(plano\);/);
    expect(lab).toMatch(/<PagamentoTela/);
  });
});

describe("sem chave do Stripe: 'pagamento ainda não disponível', sem quebrar", () => {
  it("a chave publicável vem só da variável de ambiente", () => {
    expect(cliente).toMatch(
      /export const CHAVE_PUBLICAVEL =\s*process\.env\.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \?\? "";/
    );
  });

  it("sem chave a tela não chama o servidor nem carrega o Stripe", () => {
    expect(tela).toMatch(
      /const chave = adaptador\.chave\(\);\s*if \(!chave\) \{\s*setEstado\("indisponivel"\);\s*return;/
    );
    expect(tela).toContain("Pagamento ainda não disponível");
    expect(tela).toMatch(/disabled=\{estado !== "pronto" \|\| pagando\}/);
  });

  it("o servidor também responde 'indisponível' sem a chave secreta", () => {
    expect(rota).toMatch(
      /const chave = process\.env\.STRIPE_SECRET_KEY;\s*if \(!chave\) \{[\s\S]{0,120}indisponivel: true/
    );
  });
});

describe("regras do desenho", () => {
  it("teste correndo: o aviso 'Seu teste continua até DD/MM; a primeira cobrança é nessa data'", () => {
    expect(tela).toMatch(
      /Seu teste continua até <b>\{formatarDDMM\(inicio\)\}<\/b>; a primeira\s+cobrança é nessa data\./
    );
    expect(tela).toMatch(/const aviso = fimDoTeste \? \(/);
  });

  it("botão: 'Pagar € X' hoje, ou 'Assinar · cobrança em DD/MM' no teste", () => {
    expect(tela).toMatch(
      /`Assinar · cobrança em \$\{formatarDDMM\(inicio\)\}`/
    );
    expect(tela).toMatch(/`Pagar \$\{formatarEuro\(plano\.preco\)\}`/);
  });

  it("sem teste grátis na tela de pagamento", () => {
    expect(tela).not.toMatch(/grátis|gratis|free/i);
  });

  it("sem Pix: só cartão, no servidor e no formulário", () => {
    expect(stripeApi).toMatch(/payment_method_types: \["card"\]/);
    expect(tela).toMatch(/paymentMethodOrder: \["card"\]/);
    for (const s of [tela, cliente, stripeApi, rota])
      expect(s).not.toMatch(/pix/i);
  });

  it("preços em euro vindos dos planos do onboarding (sem números soltos)", () => {
    expect(tela).toMatch(/from "@\/lib\/planos"/);
    expect(stripeApi).toMatch(/currency: "eur"/);
    expect(tela).not.toMatch(/€ ?(15|25|30|45)\b/);
  });
});

describe("o cartão nunca passa pelo nosso servidor", () => {
  it("nenhum campo de cartão nosso: o formulário é o Payment Element do Stripe", () => {
    expect(tela).not.toMatch(/<input\b/);
    expect(tela).toMatch(/elements\.create\("payment"/);
    expect(tela).toMatch(/pe\.mount\(alvoRef\.current\)/);
  });

  it("o Stripe.js vem do domínio do Stripe", () => {
    expect(cliente).toMatch(/s\.src = "https:\/\/js\.stripe\.com\/v3";/);
  });

  it("confirma no aparelho: PaymentIntent (paga hoje) ou SetupIntent (cobra no fim do teste)", () => {
    expect(tela).toMatch(
      /s\.inicio\.tipo === "setup"\s*\?\s*await s\.stripe\.confirmSetup\(opcoes\)\s*:\s*await s\.stripe\.confirmPayment\(opcoes\)/
    );
  });

  it("a rota só recebe o plano; nada de cartão no corpo", () => {
    expect(cliente).toMatch(/body: JSON\.stringify\(\{ plano: plano\.id \}\)/);
    expect(rota).not.toMatch(/card|cartao|cartão|number|cvc/i);
  });
});

describe("webhook e middleware", () => {
  it("confere a assinatura do Stripe ANTES de ler o evento", () => {
    const i = webhook.indexOf("verificarAssinaturaDoStripe(");
    const j = webhook.indexOf("JSON.parse(corpo)");
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
    expect(webhook).toMatch(/request\.headers\.get\("stripe-signature"\)/);
    expect(webhook).toMatch(/const corpo = await request\.text\(\);/);
  });

  it("só o webhook (service role) muda assinatura_status", () => {
    expect(webhook).toMatch(
      /getSupabaseAdmin\(\)\s*\.from\("configuracoes"\)\s*\.update\(\{ assinatura_status:/
    );
    expect(tela).not.toMatch(/assinatura_status/);
    expect(rota).not.toMatch(/\.update\(/);
  });

  it("o Stripe chega ao webhook sem sessão (fora do redirect para /login)", () => {
    expect(middleware).toMatch(/path === "\/api\/pagamento\/webhook" \|\|/);
    expect(middleware).toMatch(/path === "\/api\/pagamento\/assinatura" \|\|/);
  });

  it("a migration que tira assinatura_status do alcance da usuária está escrita (não aplicada)", () => {
    const p = join(
      ROOT,
      "supabase",
      "migrations",
      "0040_assinatura_so_servidor.sql"
    );
    expect(existsSync(p)).toBe(true);
    const sql = readFileSync(p, "utf-8");
    expect(sql).toMatch(/ESCRITA, NÃO APLICADA/);
    expect(sql).toMatch(/new\.assinatura_status := old\.assinatura_status;/);
    expect(sql).toMatch(/papel in \('authenticated', 'anon'\)/);
    // sem JWT a configuração vem vazia: ''::jsonb derrubaria a escrita
    expect(sql).toMatch(
      /nullif\(current_setting\('request\.jwt\.claims', true\), ''\)::jsonb/
    );
  });
});
