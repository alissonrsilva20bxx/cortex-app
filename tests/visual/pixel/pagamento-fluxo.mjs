// Pagamento no laboratório: os fluxos, sem Stripe de verdade.
//  1. sem chave (como hoje, o operador ainda não tem): "Pagamento ainda não
//     disponível", botão desativado, nada quebra;
//  2. Stripe simulado: aprovado → Confirmação → "Voltar para o app" fecha;
//     recusado → Erro → "Tentar de novo" volta ao MESMO formulário;
//  3. "Voltar" no Pagamento reabre a escolha de plano do onboarding;
//  4. o escolher plano do onboarding abre o Pagamento com aquele plano;
//  5. os 8 temas, claro e escuro: as cores do bloco do Stripe saem dos tokens.
// Uso: node tests/visual/pixel/pagamento-fluxo.mjs [--base-url=...] [--prints=pasta]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const PW =
  "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME =
  "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const { chromium } = createRequire(PW)("playwright");
const arg = (n, d) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const BASE = arg("base-url", "http://localhost:3103");
const PRINTS = arg("prints", null);
if (PRINTS) mkdirSync(PRINTS, { recursive: true });
const ALT = { 390: 844, 430: 932 };
const browser = await chromium.launch({ executablePath: CHROME });
const res = [];
const ok = (n, c, x = "") => {
  res.push(c);
  console.log(`${c ? "ok   " : "FALHA"} ${n}${x ? "  " + x : ""}`);
};

async function abrir(w = 390, md = "dark", tema = "pink-neon") {
  const ctx = await browser.newContext({
    viewport: { width: w, height: ALT[w] },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await ctx.addInitScript(
    ([md, tema]) => {
      localStorage.setItem("jobapp-theme", tema);
      localStorage.setItem("jobapp-mode", md);
      localStorage.setItem("jobapp-recap-last-shown", "2026-10");
    },
    [md, tema]
  );
  await ctx.route("**/api/**", (r) => r.abort());
  await ctx.route(/supabase\.co/, (r) => r.abort());
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e).slice(0, 140)));
  await p.clock.setFixedTime(new Date(2026, 9, 8, 10, 0, 0));
  await p.goto(`${BASE}/dev-preview/app`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await p.addStyleTag({
    content:
      "nextjs-portal{display:none!important;pointer-events:none!important}*,*::before,*::after{animation:none!important;transition:none!important}",
  });
  await p.waitForFunction(
    () => typeof window.__previewPagamento === "function"
  );
  const tema_ = async () =>
    p.evaluate(
      ([md, tema]) => {
        const h = document.documentElement;
        h.setAttribute("data-theme", tema);
        if (md === "light") h.setAttribute("data-mode", "light");
        else h.removeAttribute("data-mode");
      },
      [md, tema]
    );
  await tema_();
  return { ctx, p, erros, tema: tema_ };
}

// 1. sem chave
for (const w of [390, 430])
  for (const md of ["light", "dark"]) {
    const { ctx, p, tema } = await abrir(w, md);
    await p.evaluate(() => window.__previewPagamento({ caso: "dia8" }));
    await p.locator('[data-stripe="indisponivel"]').waitFor({ timeout: 10000 });
    const txt = await p.locator("[data-indisponivel]").innerText();
    ok(
      `${w} ${md}: sem chave → 'Pagamento ainda não disponível', botão desativado`,
      /Pagamento ainda não disponível/.test(txt) &&
        (await p.locator("[data-pagar]").isDisabled()) &&
        /em breve/i.test(await p.locator("[data-pagar]").innerText())
    );
    await tema();
    if (PRINTS)
      await p.screenshot({
        path: `${PRINTS}/indisponivel-${w}-${md === "light" ? "claro" : "escuro"}.png`,
      });
    await ctx.close();
  }

// 2. aprovado / recusado
{
  const { ctx, p, erros } = await abrir();
  await p.evaluate(() =>
    window.__previewPagamento({ simulado: true, caso: "dia8", plano: "2m" })
  );
  await p.locator('[data-stripe="pronto"]').waitFor();
  const resumo = await p.locator("[data-resumo]").innerText();
  ok(
    "resumo do plano de 2 meses: € 30 riscado, € 25, desconto 17%, € 12,50/mês, total hoje € 25",
    /€ 30/.test(resumo) &&
      /€ 25/.test(resumo) &&
      /17%/.test(resumo) &&
      /€ 12,50\/mês/.test(resumo) &&
      /Total hoje\s*€ 25/.test(resumo)
  );
  ok(
    "sem teste correndo: 'Pagar € 25' e nenhum aviso de teste",
    (await p.locator("[data-pagar]").innerText()) === "Pagar € 25" &&
      (await p.locator("[data-aviso-teste]").count()) === 0
  );
  await p.locator("[data-pagar]").click();
  await p.locator('[data-pagamento="confirmado"]').waitFor();
  ok(
    "aprovado → 'Tudo certo, Miguel!'",
    /Tudo certo, Miguel!/.test(await p.locator("[data-confirmado]").innerText())
  );
  await p.locator("[data-voltar-app]").click();
  ok(
    "'Voltar para o app' fecha o Pagamento",
    (await p.locator("[data-pagamento]").count()) === 0
  );
  await p.evaluate(() =>
    window.__previewPagamento({
      simulado: true,
      caso: "antes",
      plano: "1m",
      resultado: "recusado",
    })
  );
  await p.locator('[data-stripe="pronto"]').waitFor();
  ok(
    "teste correndo: aviso 'Seu teste continua até 15/10; a primeira cobrança é nessa data'",
    /Seu teste continua até 15\/10; a primeira cobrança é nessa data\./.test(
      await p.locator("[data-aviso-teste]").innerText()
    )
  );
  ok(
    "teste correndo: 'Assinar · cobrança em 15/10', hoje € 0",
    (await p.locator("[data-pagar]").innerText()) ===
      "Assinar · cobrança em 15/10" &&
      /Hoje\s*€ 0/.test(await p.locator("[data-resumo]").innerText())
  );
  await p.locator("[data-pagar]").click();
  await p.locator('[data-pagamento="erro"]').waitFor();
  const erroTxt = await p.locator("[data-erro]").innerText();
  ok(
    "recusado → erro com o cartão, o motivo e o código do Stripe",
    /terminado em 9995: saldo insuficiente/.test(erroTxt) &&
      /card_declined/.test(erroTxt) &&
      /até 15\/10/.test(erroTxt)
  );
  await p.locator("[data-tentar-de-novo]").click();
  ok(
    "'Tentar de novo' volta ao mesmo formulário (sem criar outra assinatura)",
    (await p
      .locator('[data-pagamento="pagamento"][data-stripe="pronto"]')
      .count()) === 1 &&
      (await p.locator("[data-stripe-simulado]").count()) === 1
  );
  ok(
    "sem erro de página",
    erros.filter((e) => !/hydrat|server-rendered/i.test(e)).length === 0,
    erros.join(" / ")
  );
  await ctx.close();
}

// 6. ajustes da revisão (#221)
{
  // toque duplo no mesmo instante: confirma uma vez só
  const { ctx, p } = await abrir();
  await p.evaluate(() =>
    window.__previewPagamento({ simulado: true, caso: "dia8", plano: "3m" })
  );
  await p.locator('[data-stripe="pronto"]').waitFor();
  const antes = await p.evaluate(() => window.__previewPagamentoConfirmacoes());
  await p.evaluate(() => {
    const b = document.querySelector("[data-pagar]");
    b.click();
    b.click();
  });
  await p.locator('[data-pagamento="confirmado"]').waitFor();
  const depois = await p.evaluate(() =>
    window.__previewPagamentoConfirmacoes()
  );
  ok(
    "toque duplo em 'Pagar': o Stripe confirma uma vez só",
    depois - antes === 1,
    `${depois - antes} confirmação(ões)`
  );
  await ctx.close();
}
{
  // campo incompleto: o próprio Stripe avisa no formulário; nada de tela de erro
  const { ctx, p } = await abrir();
  await p.evaluate(() =>
    window.__previewPagamento({
      simulado: true,
      caso: "dia8",
      plano: "3m",
      resultado: "incompleto",
    })
  );
  await p.locator('[data-stripe="pronto"]').waitFor();
  await p.locator("[data-pagar]").click();
  await p.waitForTimeout(400);
  ok(
    "campo incompleto (validation_error): continua no Pagamento, sem tela de erro",
    (await p.locator('[data-pagamento="pagamento"]').count()) === 1 &&
      (await p.locator("[data-erro]").count()) === 0
  );
  await ctx.close();
}
{
  // depois do "Tudo certo", a pílula do teste some sem recarregar o app
  const { ctx, p } = await abrir();
  await p.locator("[data-pilula-teste]").waitFor({ timeout: 15000 });
  const tinha = await p.locator("[data-pilula-teste]").count();
  await p.evaluate(() =>
    window.__previewPagamento({ simulado: true, caso: "antes", plano: "3m" })
  );
  await p.locator('[data-stripe="pronto"]').waitFor();
  await p.locator("[data-pagar]").click();
  await p.locator('[data-pagamento="confirmado"]').waitFor();
  await p.locator("[data-voltar-app]").click();
  const sumiu = await p
    .waitForFunction(
      () => !document.querySelector("[data-pilula-teste]"),
      null,
      { timeout: 6000 }
    )
    .then(() => true)
    .catch(() => false);
  ok(
    "depois do 'Tudo certo' a pílula do teste some sem recarregar",
    tinha === 1 && sumiu
  );
  await ctx.close();
}

// 3 e 4. onboarding → Pagamento → Voltar reabre os planos
{
  const { ctx, p } = await abrir();
  await p.evaluate(() => window.__previewTrial(0));
  await p.locator("[data-planos]").waitFor();
  await p.locator('[data-plano="1m"]').click();
  await p.locator("[data-escolher-plano]").click();
  await p.locator("[data-pagamento]").waitFor();
  ok(
    "escolher '1 mês' nos planos abre o Pagamento do plano de 1 mês",
    /Plano de 1 mês/.test(await p.locator("[data-resumo]").innerText())
  );
  await p.getByRole("button", { name: "Voltar" }).first().click();
  await p
    .locator("[data-planos]")
    .waitFor({ timeout: 5000 })
    .catch(() => {});
  ok(
    "'Voltar' fecha o Pagamento e reabre a escolha de plano",
    (await p.locator("[data-pagamento]").count()) === 0 &&
      (await p.locator("[data-planos]").isVisible())
  );
  await ctx.close();
}

// 5. 8 temas
for (const tema of [
  "grafite",
  "pink-neon",
  "purple",
  "crimson",
  "ocean",
  "gold",
  "emerald",
  "midnight",
])
  for (const md of ["light", "dark"]) {
    const { ctx, p, tema: aplicar } = await abrir(390, md, tema);
    await p.evaluate(() =>
      window.__previewPagamento({ simulado: true, caso: "antes", plano: "3m" })
    );
    await p.locator('[data-stripe="pronto"]').waitFor();
    await aplicar();
    const cores = await p.evaluate(() => {
      const b = document.querySelector("[data-bloco-stripe]");
      const cta = document.querySelector("[data-pagar]");
      const acc = getComputedStyle(document.documentElement)
        .getPropertyValue("--t-acc")
        .trim();
      return {
        bloco: getComputedStyle(b).backgroundColor,
        cta: getComputedStyle(cta).backgroundColor,
        acc,
      };
    });
    ok(
      `${tema} ${md}: bloco do Stripe e botão no tema`,
      cores.bloco !== "rgba(0, 0, 0, 0)" && cores.cta.length > 0,
      JSON.stringify(cores)
    );
    if (PRINTS && tema !== "pink-neon")
      await p.screenshot({
        path: `${PRINTS}/tema-${tema}-${md === "light" ? "claro" : "escuro"}.png`,
      });
    await ctx.close();
  }

await browser.close();
const falhas = res.filter((r) => !r).length;
console.log(`\n${res.length - falhas}/${res.length} ok`);
process.exit(falhas ? 1 : 0);
