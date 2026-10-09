// Tela de bloqueio · as 3 regras de segurança, no navegador (laboratório).
//   1. "Esqueci o PIN": confirmar a conta (senha do laboratório "senha123")
//      e criar um PIN novo, digitado duas vezes;
//   2. Ajustes: desligar o PIN pede a conta antes;
//   3. limite de tentativas: 5 erros = 1 min, depois 2 min; a espera
//      sobrevive a recarregar a página.
// Roda contra um `next dev` no ar (/dev-preview/app). Toda chamada ao
// Supabase é interceptada no próprio navegador: `configuracoes` recebe uma
// resposta falsa e o resto é abortado; nada sai para o serviço de verdade.
// Uso: node tests/visual/pixel/bloqueio-seguranca.mjs [--base-url=...] [--prints=pasta]
// Falha (código 1) se algum passo não fizer o que deve.
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
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
const sha = (s) => createHash("sha256").update(s).digest("hex");
const ALT = { 390: 844, 430: 932 };
const browser = await chromium.launch({ executablePath: CHROME });
const resultados = [];
const passo = (nome, ok, extra = "") => {
  resultados.push(ok);
  console.log(`${ok ? "ok   " : "FALHA"} ${nome}${extra ? "  " + extra : ""}`);
};

async function abrir(w, md, { pinAtivo = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: ALT[w] },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await ctx.addInitScript((md) => {
    localStorage.setItem("jobapp-recap-last-shown", "2026-10");
    localStorage.setItem("jobapp-theme", "pink-neon");
    localStorage.setItem("jobapp-mode", md);
  }, md);
  await ctx.route("**/api/**", (r) => r.abort());
  const atualizacoes = [];
  await ctx.route(/supabase\.co/, (r) => {
    const req = r.request();
    if (!/\/rest\/v1\/configuracoes/.test(req.url())) return r.abort();
    if (req.method() === "GET")
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tema: null,
          pin_hash: pinAtivo ? sha("1234") : null,
          trial_started_at: null,
          assinatura_status: null,
        }),
      });
    atualizacoes.push({ metodo: req.method(), corpo: req.postData() });
    return r.fulfill({ status: 204, body: "" });
  });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/dev-preview/app`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await p.addStyleTag({
    content:
      "nextjs-portal{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important}",
  });
  await p.waitForFunction(() => typeof window.__previewLock === "function");
  await p.evaluate((md) => {
    const h = document.documentElement;
    h.setAttribute("data-theme", "pink-neon");
    if (md === "light") h.setAttribute("data-mode", "light");
    else h.removeAttribute("data-mode");
  }, md);
  return { ctx, p, atualizacoes };
}

const trava = (p) => p.locator('main[aria-labelledby="pin-screen-title"]');
async function digitar(p, pin) {
  for (const d of pin)
    await trava(p)
      .getByRole("button", { name: `Dígito ${d}` })
      .click();
}
const msg = (p) => p.locator("[data-pin-mensagem]").innerText();
const titulo = (p) => p.locator("#pin-screen-title").innerText();
async function print(p, nome) {
  if (!PRINTS) return;
  await p.mouse.move(0, 0);
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${PRINTS}/${nome}.png` });
}

for (const w of [390, 430])
  for (const md of ["light", "dark"]) {
    const suf = `${w}-${md === "light" ? "claro" : "escuro"}`;
    console.log(`\n== ${suf}`);

    // ── Regra 1: Esqueci o PIN → conta → PIN novo ─────────────────────
    {
      const { ctx, p } = await abrir(w, md);
      await p.evaluate((h) => window.__previewLock(h), sha("1234"));
      await trava(p).waitFor();
      await p.locator("[data-pin-esqueci]").click();
      const reauth = p.locator('[data-reauth="esqueci-pin"]');
      await reauth.waitFor();
      passo(
        `${suf} Esqueci abre a confirmação (senha e Google)`,
        (await reauth.locator("[data-reauth-senha]").isVisible()) &&
          (await reauth.locator("[data-reauth-google]").isVisible())
      );
      await print(p, `esqueci-1-confirmar-conta-${suf}`);
      await reauth.locator("[data-reauth-senha]").fill("errada");
      await reauth.locator("[data-reauth-confirmar]").click();
      await p.locator("[data-reauth-erro]").waitFor();
      passo(
        `${suf} senha errada não passa`,
        (await titulo(p)) !== "Crie um PIN novo" && (await reauth.isVisible())
      );
      await reauth.locator("[data-reauth-senha]").fill("senha123");
      await reauth.locator("[data-reauth-confirmar]").click();
      await p.waitForFunction(
        () =>
          document.querySelector("#pin-screen-title")?.textContent ===
          "Crie um PIN novo"
      );
      passo(`${suf} senha certa leva ao PIN novo`, true, await msg(p));
      await print(p, `esqueci-2-pin-novo-${suf}`);
      await digitar(p, "5678");
      const pediuDeNovo = await p
        .waitForFunction(
          () =>
            document.querySelector("#pin-screen-title")?.textContent ===
            "Confirme o PIN novo",
          null,
          { timeout: 5000 }
        )
        .then(() => true)
        .catch(() => false);
      passo(`${suf} pede o PIN novo de novo`, pediuDeNovo);
      await digitar(p, "5679");
      await p.waitForTimeout(150);
      passo(
        `${suf} PINs diferentes: avisa e recomeça`,
        /não são iguais/.test(await msg(p))
      );
      await print(p, `esqueci-3-pins-diferentes-${suf}`);
      await p.waitForTimeout(900);
      passo(
        `${suf} recomeçou no PIN novo`,
        (await titulo(p)) === "Crie um PIN novo"
      );
      await digitar(p, "5678");
      await digitar(p, "5678");
      await trava(p).waitFor({ state: "detached", timeout: 5000 });
      passo(`${suf} PIN novo salvo e app liberado`, true);
      // a trava agora pede o PIN NOVO; o antigo não abre
      await p.evaluate(() => window.__previewLock());
      await trava(p).waitFor();
      await digitar(p, "1234");
      await p.waitForTimeout(150);
      passo(
        `${suf} o PIN antigo não abre mais`,
        /não confere/.test(await msg(p))
      );
      await p.waitForTimeout(900);
      await digitar(p, "5678");
      await trava(p).waitFor({ state: "detached", timeout: 5000 });
      passo(`${suf} o PIN novo abre`, true);
      await ctx.close();
    }

    // ── Regra 3: limite de tentativas ─────────────────────────────────
    {
      const { ctx, p } = await abrir(w, md);
      await p.clock.install();
      await p.evaluate((h) => window.__previewLock(h), sha("1234"));
      await trava(p).waitFor();
      for (let i = 1; i <= 4; i++) {
        await digitar(p, "9999");
        await p.clock.runFor(800);
      }
      passo(
        `${suf} 4 erros: ainda pode digitar`,
        await trava(p).getByRole("button", { name: "Dígito 1" }).isEnabled()
      );
      await digitar(p, "9999");
      await p.clock.runFor(800);
      const m5 = await msg(p);
      passo(
        `${suf} 5º erro: espera de 1 minuto, teclado travado`,
        /Tente de novo em 1:00|Tente de novo em 0:59/.test(m5) &&
          !(await trava(p)
            .getByRole("button", { name: "Dígito 1" })
            .isEnabled()),
        m5
      );
      await print(p, `tentativas-1-espera-1min-${suf}`);
      passo(
        `${suf} na espera o Esqueci o PIN continua lá`,
        await p.locator("[data-pin-esqueci]").isVisible()
      );
      // recarregar não zera
      await p.reload({ waitUntil: "networkidle" });
      await p.addStyleTag({
        content: "nextjs-portal{display:none!important}",
      });
      await p.waitForFunction(() => typeof window.__previewLock === "function");
      await p.evaluate((h) => window.__previewLock(h), sha("1234"));
      await trava(p).waitFor();
      passo(
        `${suf} recarregar a página não zera a espera`,
        /Muitas tentativas/.test(await msg(p)),
        await msg(p)
      );
      await p.clock.runFor(61_000);
      passo(
        `${suf} passou 1 minuto: libera o teclado`,
        await trava(p).getByRole("button", { name: "Dígito 1" }).isEnabled()
      );
      await digitar(p, "9999");
      await p.clock.runFor(800);
      const m6 = await msg(p);
      passo(`${suf} errou de novo: 2 minutos`, /em 2:00|em 1:59/.test(m6), m6);
      await print(p, `tentativas-2-espera-2min-${suf}`);
      await p.clock.runFor(121_000);
      await digitar(p, "1234");
      await trava(p).waitFor({ state: "detached", timeout: 5000 });
      const resto = await p.evaluate(() =>
        Object.keys(localStorage).filter((k) => k.startsWith("pin:tentativas:"))
      );
      passo(`${suf} acertar zera o contador`, resto.length === 0);
      await ctx.close();
    }

    // ── Regra 2: Ajustes › desligar o PIN pede a conta ────────────────
    // O laboratório guarda `configuracoes` em memória: o PIN é ligado pela
    // própria tela (o 1º PIN não pede a conta) e o resto é conferido nela.
    {
      const { ctx, p } = await abrir(w, md);
      await p.getByRole("button", { name: "Abrir Ajustes" }).first().click();
      await p.getByText("Segurança e PIN").first().click();
      await p.getByText("Ativar PIN").first().click();
      // PinSetup (folha de baixo): 4 dígitos, duas vezes.
      for (let vez = 0; vez < 2; vez++)
        for (const d of "1234") {
          await p
            .getByRole("dialog", { name: /^(Definir|Confirmar) PIN$/ })
            .getByRole("button", { name: d, exact: true })
            .click();
          await p.waitForTimeout(60);
        }
      const ligou = await p
        .getByText("Toque para desativar")
        .waitFor({ timeout: 10000 })
        .then(() => true)
        .catch(() => false);
      passo(`${suf} criar o 1º PIN não pede a conta`, ligou);
      if (!ligou) {
        await ctx.close();
        continue;
      }
      await p.getByText("Toque para desativar").click();
      const sheet = p.locator('[data-reauth="desligar-pin"]');
      await sheet.waitFor();
      await print(p, `ajustes-1-desligar-pede-conta-${suf}`);
      await sheet.locator("[data-reauth-senha]").fill("errada");
      await sheet.locator("[data-reauth-confirmar]").click();
      await p.locator("[data-reauth-erro]").waitFor();
      passo(
        `${suf} senha errada não desliga`,
        await p.getByText("Toque para desativar").isVisible()
      );
      await sheet.locator("[data-reauth-senha]").fill("senha123");
      await sheet.locator("[data-reauth-confirmar]").click();
      const desligou = await p
        .getByText("Ativar PIN")
        .first()
        .waitFor({ timeout: 10000 })
        .then(() => true)
        .catch(() => false);
      passo(`${suf} senha certa desliga o PIN`, desligou);
      await ctx.close();
    }
  }

await browser.close();
const falhas = resultados.filter((r) => !r).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} ok`);
process.exit(falhas ? 1 : 0);
