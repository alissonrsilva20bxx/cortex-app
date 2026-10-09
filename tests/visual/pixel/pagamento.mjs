// Pagamento "C Transparente" (variante A, Stripe embutido) × desenho
// aprovado (docs/jornada/referencias/pagamento-transparente-stripe.html).
//
// O app roda no laboratório (/dev-preview/app) com o Stripe SIMULADO
// (lib/pagamento/laboratorio.ts: o mesmo formulário do desenho, cartão
// aprovado ou recusado) e o relógio no dia do desenho (08/10/2026):
//   - caso "dia8"  : teste acabou, paga hoje (Pagar € 30, renova 08/01);
//   - caso "antes" : teste correndo até 15/10 (Assinar · cobrança em 15/10).
// Telas 2 (Pagamento), 3 (Confirmação) e 4 (Erro), plano de 3 meses, em
// 390 (pixel contra o desenho) e 430 (prints), claro e escuro, pink-neon.
// No desenho: sem a moldura do celular, sem Apple/Google Pay (o simulado não
// tem carteira), sem o selo azul "Formulário do Stripe" (anotação do desenho)
// e com a fonte do app (o desenho não carrega fonte).
// Uso: node tests/visual/pixel/pagamento.mjs [--base-url=...] [--prints=pasta]
// Saída dos diffs em %TEMP%/w2-pixel/pagamento.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = fileURLToPath(new URL("../../../", import.meta.url)).replace(
  /[\\/]$/,
  ""
);
const tool = await import(
  pathToFileURL(`${REPO}/tests/visual/pixel/comparar.mjs`).href
);
const PW =
  "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME =
  "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const { chromium } = createRequire(PW)("playwright");
const REF = pathToFileURL(
  `${REPO}/docs/jornada/referencias/pagamento-transparente-stripe.html`
).href;
const arg = (n, d) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const BASE = arg("base-url", "http://localhost:3103");
const PRINTS = arg("prints", null);
const OUT = `${process.env.TEMP ?? "."}/w2-pixel/pagamento`;
mkdirSync(OUT, { recursive: true });
if (PRINTS) mkdirSync(PRINTS, { recursive: true });
const ALT = { 390: 844, 430: 932 };
const DIA_DO_DESENHO = new Date(2026, 9, 8, 10, 0, 0);
const SEM_MOVIMENTO =
  "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
const browser = await chromium.launch({
  executablePath: CHROME,
  // Sem suavização LCD: o Chrome escolhe LCD ou cinza por heurística de
  // camada, diferente em cada lado, e celular não usa LCD. Os dois em cinza.
  args: ["--disable-gpu", "--disable-gpu-rasterization", "--disable-lcd-text"],
});
const resultados = [];
const passo = (nome, ok, extra = "") => {
  resultados.push({ nome, ok, extra });
  console.log(`${ok ? "ok   " : "FALHA"} ${nome}${extra ? "  " + extra : ""}`);
};
const TELAS = { pagamento: 1, confirmado: 2, erro: 3 };

async function ref(w, md, caso, tela) {
  const ctx = await browser.newContext({
    viewport: { width: w + 400, height: 1200 },
    deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();
  await p.goto(REF, { waitUntil: "load" });
  await p
    .addStyleTag({
      url: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
    })
    .catch(() => {});
  await p.evaluate(
    ([md, caso, passo]) => {
      document.documentElement.setAttribute(
        "data-mode",
        md === "claro" ? "light" : "dark"
      );
      document.getElementById("wallet").checked = false;
      S.caso = caso;
      S.plano = 3;
      S.variante = "A";
      S.passo = passo;
      desenhar();
    },
    [md, caso, TELAS[tela]]
  );
  await p.addStyleTag({
    content:
      SEM_MOVIMENTO +
      `.notch,.status,.toast,.iframe-tag,.confetti{display:none!important}` +
      `#flowphone{position:fixed!important;left:0!important;top:0!important;width:${w}px!important;height:${ALT[w]}px!important;border-radius:0!important;box-shadow:none!important;z-index:999}` +
      `#flowfit .scaler{transform:none!important}`,
  });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  return { ctx, p };
}

async function app(w, md, caso, tela) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: ALT[w] },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await ctx.addInitScript((md) => {
    localStorage.setItem("jobapp-theme", "pink-neon");
    localStorage.setItem("jobapp-mode", md === "claro" ? "light" : "dark");
    localStorage.setItem("jobapp-recap-last-shown", "2026-10");
  }, md);
  await ctx.route("**/api/**", (r) => r.abort());
  await ctx.route(/supabase\.co/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.clock.setFixedTime(DIA_DO_DESENHO);
  await p.goto(`${BASE}/dev-preview/app`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await p.addStyleTag({
    content: "nextjs-portal{display:none!important}" + SEM_MOVIMENTO,
  });
  await p.waitForFunction(
    () => typeof window.__previewPagamento === "function"
  );
  await p.evaluate(
    ([caso, tela]) =>
      window.__previewPagamento({
        simulado: true,
        caso,
        plano: "3m",
        resultado: tela === "erro" ? "recusado" : "aprovado",
      }),
    [caso, tela]
  );
  await p.locator('[data-stripe="pronto"]').waitFor({ timeout: 15000 });
  if (tela !== "pagamento") {
    await p.locator("[data-pagar]").click();
    await p.locator(`[data-pagamento="${tela}"]`).waitFor({ timeout: 10000 });
  }
  await p.evaluate((md) => {
    const h = document.documentElement;
    h.setAttribute("data-theme", "pink-neon");
    if (md === "claro") h.setAttribute("data-mode", "light");
    else h.removeAttribute("data-mode");
  }, md);
  await p.evaluate(() => document.fonts.ready);
  await p.mouse.move(0, 0);
  await p.waitForTimeout(300);
  return { ctx, p };
}

const pd = await (await browser.newContext()).newPage();
async function diff(a, b) {
  return pd.evaluate(
    async ([a, b, fonte]) => {
      const medir = eval(`(${fonte})`);
      const ld = (s) =>
        new Promise((ok) => {
          const i = new Image();
          i.onload = () => ok(i);
          i.src = "data:image/png;base64," + s;
        });
      const [ia, ib] = await Promise.all([ld(a), ld(b)]);
      const px = (img) => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const x = c.getContext("2d");
        x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, img.width, img.height).data;
      };
      const r = medir({
        a: px(ia),
        b: px(ib),
        larguraA: ia.width,
        alturaA: ia.height,
        larguraB: ib.width,
        alturaB: ib.height,
      });
      const c = document.createElement("canvas");
      c.width = r.largura;
      c.height = r.altura;
      const g = c.getContext("2d");
      const out = g.createImageData(r.largura, r.altura);
      for (let p = 0; p < r.largura * r.altura; p++)
        out.data.set(
          r.mascara[p] ? [255, 0, 60, 255] : [235, 235, 235, 255],
          p * 4
        );
      g.putImageData(out, 0, 0);
      return { pct: r.difPct, img: c.toDataURL().split(",")[1] };
    },
    [a.toString("base64"), b.toString("base64"), tool.medirPixels.toString()]
  );
}

const linhas = [];
for (const w of [390, 430])
  for (const md of ["claro", "escuro"])
    for (const caso of ["dia8", "antes"])
      for (const tela of ["pagamento", "confirmado", "erro"]) {
        const suf = `${tela}-${caso}-${w}-${md}`;
        const a = await app(w, md, caso, tela);
        const pa = await a.p.screenshot({
          clip: { x: 0, y: 0, width: w, height: ALT[w] },
        });
        writeFileSync(join(OUT, `app-${suf}.png`), pa);
        if (PRINTS) writeFileSync(join(PRINTS, `${suf}.png`), pa);
        if (w === 390) {
          const r = await ref(w, md, caso, tela);
          const pr = await r.p.screenshot({
            clip: { x: 0, y: 0, width: w, height: ALT[w] },
          });
          const d = await diff(pr, pa);
          writeFileSync(join(OUT, `ref-${suf}.png`), pr);
          writeFileSync(
            join(OUT, `diff-${suf}.png`),
            Buffer.from(d.img, "base64")
          );
          console.log(`pixel ${suf}: ${d.pct.toFixed(2)}%`);
          linhas.push({ suf, pct: d.pct });
          await r.ctx.close();
        }
        await a.ctx.close();
      }
writeFileSync(join(OUT, "resumo.json"), JSON.stringify(linhas, null, 1));
await browser.close();
