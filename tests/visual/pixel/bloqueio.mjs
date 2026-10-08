// Tela de bloqueio x "2 · Cartão Cofre" aprovado
// (docs/jornada/referencias/tela-bloqueio-cartao-cofre.html), tela inteira,
// mesma métrica da ferramenta (medirPixels: pixelmatch YIQ, limiar 0,1).
// Na referência some a moldura do celular (notch, barra de status, borda
// arredondada); o app roda no laboratório (/dev-preview/app) com o PIN 1234.
// Estados: parado, digitando (2 dígitos), erro (9999) e acerto (1234), nos
// dois contextos (vault = vindo do Cofre, app = trava do app inteiro).
// Uso: node tests/visual/pixel/bloqueio.mjs <rotulo> [larguras] [modos] [temas] [contextos] [estados]
// Saída em %TEMP%/w2-pixel/bloqueio. Precisa de um next dev em PX_BASE_URL
// (padrão http://localhost:3103).
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
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
  `${REPO}/docs/jornada/referencias/tela-bloqueio-cartao-cofre.html`
).href;
const BASE = process.env.PX_BASE_URL ?? "http://localhost:3103";
const [
  rotulo = "x",
  ws = "390,430",
  ms = "light,dark",
  ts = "pink-neon",
  cs = "vault,app",
  es = "parado,digitando,erro,acerto",
] = process.argv.slice(2);
const OUT =
  process.env.PX_OUT ?? `${process.env.TEMP ?? "."}/w2-pixel/bloqueio`;
mkdirSync(OUT, { recursive: true });
const ALT = { 390: 844, 430: 932 };
const HASH_1234 = createHash("sha256").update("1234").digest("hex");
const DIGITOS = {
  parado: [],
  digitando: ["1", "2"],
  erro: ["9", "9", "9", "9"],
  acerto: ["1", "2", "3", "4"],
};
const SEM_MOVIMENTO =
  "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--disable-gpu", "--disable-gpu-rasterization"],
});

async function ref(w, md, ctxNome, estado) {
  const ctx = await browser.newContext({
    viewport: { width: w + 400, height: 3200 },
    deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();
  await p.goto(REF, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(
    (md) => document.documentElement.setAttribute("data-mode", md),
    md
  );
  await p.addStyleTag({
    content:
      SEM_MOVIMENTO +
      `.scaler{transform:none!important;margin:0!important}.fit{height:auto!important}` +
      `.phone{width:${w}px!important;height:${ALT[w]}px!important;border-radius:0!important;box-shadow:none!important}` +
      `.notch,.status,.toast{display:none!important}`,
  });
  const el = p.locator(".phone").nth(ctxNome === "vault" ? 0 : 1);
  // Erro e acerto ficam parados para o print: a referência volta ao início
  // depois de 900ms (erro) e 1700ms (acerto); só esses dois não disparam.
  await p.evaluate(() => {
    const orig = window.setTimeout.bind(window);
    window.setTimeout = (fn, ms, ...a) =>
      ms === 900 || ms === 1700 ? 0 : orig(fn, ms, ...a);
  });
  // O celular da referência fica centralizado numa coluna e cai em y
  // fracionário (357,34px): o texto rasteriza diferente do app, que começa
  // em 0. Vai para o canto (0,0), como a tela do app.
  await el.evaluate((ph) => {
    ph.style.cssText +=
      ";position:fixed!important;left:0!important;top:0!important;z-index:999";
  });
  for (const d of DIGITOS[estado]) await el.locator(`[data-k="${d}"]`).click();
  if (DIGITOS[estado].length === 4) await p.waitForTimeout(700);
  await p.mouse.move(0, 0);
  await p.waitForTimeout(150);
  return { ctx, p, el };
}

async function app(w, md, tm, ctxNome, estado) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: ALT[w] },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await ctx.addInitScript(
    ([tm, md]) => {
      try {
        localStorage.setItem("jobapp-theme", tm);
        localStorage.setItem("jobapp-mode", md);
        localStorage.setItem("jobapp-recap-last-shown", "2026-10");
      } catch {}
    },
    [tm, md]
  );
  await ctx.route("**/api/**", (r) => r.abort());
  await ctx.route(/supabase\.co/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto(`${BASE}/dev-preview/app`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await p.addStyleTag({
    content: "nextjs-portal{display:none!important}" + SEM_MOVIMENTO,
  });
  const recap = p.getByRole("button", { name: "Continuar no meu ritmo" });
  if (await recap.isVisible().catch(() => false)) {
    await recap.click();
    await p.waitForTimeout(400);
  }
  const tema = ([tm, md]) => {
    const h = document.documentElement;
    h.setAttribute("data-theme", tm);
    if (md === "light") h.setAttribute("data-mode", "light");
    else h.removeAttribute("data-mode");
  };
  await p.evaluate(tema, [tm, md]);
  // Na 1ª compilação o gancho do laboratório pode chegar depois da página.
  await p.waitForFunction(
    () => typeof window.__previewPin === "function",
    null,
    {
      timeout: 60000,
    }
  );
  if (ctxNome === "app") {
    await p.evaluate((h) => window.__previewLock(h), HASH_1234);
  } else {
    await p.evaluate((h) => window.__previewPin(h), HASH_1234);
    await p.getByRole("button", { name: "Cofre", exact: true }).first().click();
  }
  const el = p.locator(
    'main[role="dialog"][aria-labelledby="pin-screen-title"]'
  );
  await el.waitFor({ timeout: 20000 });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(tema, [tm, md]);
  // O erro (700ms) e o acerto (200ms) ficam parados na tela para o print:
  // só esses dois timers deixam de disparar, sem mexer no código do app.
  await p.evaluate(() => {
    const orig = window.setTimeout.bind(window);
    window.setTimeout = (fn, ms, ...a) =>
      ms === 200 || ms === 700 ? 0 : orig(fn, ms, ...a);
  });
  for (const d of DIGITOS[estado])
    await el.getByRole("button", { name: `Dígito ${d}` }).click();
  if (DIGITOS[estado].length === 4)
    await p.waitForFunction(() =>
      document.querySelector(
        'main[aria-labelledby="pin-screen-title"][data-estado]'
      )
    );
  // O app reaplica o tema depois de hidratar (corrida na 1ª carga): força
  // de novo logo antes do print.
  await p.evaluate(tema, [tm, md]);
  await p.mouse.move(0, 0);
  await p.waitForTimeout(300);
  return { ctx, p, el };
}

async function shot(x, w) {
  const b = await x.el.boundingBox();
  const clip = {
    x: Math.floor(b.x),
    y: Math.floor(b.y),
    width: w,
    height: ALT[w],
  };
  return x.p.screenshot({ clip });
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
      return {
        pct: r.difPct,
        tam: [ia.width, ia.height, ib.width, ib.height],
        img: c.toDataURL().split(",")[1],
      };
    },
    [a.toString("base64"), b.toString("base64"), tool.medirPixels.toString()]
  );
}
const linhas = [];
for (const w of ws.split(",").map(Number))
  for (const md of ms.split(","))
    for (const tm of ts.split(","))
      for (const cx of cs.split(","))
        for (const est of es.split(",")) {
          const suf = `${w}-${md === "light" ? "claro" : "escuro"}-${tm}-${cx}-${est}`;
          const r = await ref(w, md, cx, est);
          const a = await app(w, md, tm, cx, est);
          const [pr, pa] = [await shot(r, w), await shot(a, w)];
          const d = await diff(pr, pa);
          writeFileSync(join(OUT, `${rotulo}-ref-${suf}.png`), pr);
          writeFileSync(join(OUT, `${rotulo}-app-${suf}.png`), pa);
          writeFileSync(
            join(OUT, `${rotulo}-diff-${suf}.png`),
            Buffer.from(d.img, "base64")
          );
          console.log(
            `bloqueio ${suf}: ${d.pct.toFixed(2)}%  ref ${d.tam[0]}x${d.tam[1]} app ${d.tam[2]}x${d.tam[3]}`
          );
          linhas.push({ suf, pct: d.pct });
          await r.ctx.close();
          await a.ctx.close();
        }
writeFileSync(
  join(OUT, `${rotulo}-resumo.json`),
  JSON.stringify(linhas, null, 1)
);
await browser.close();
