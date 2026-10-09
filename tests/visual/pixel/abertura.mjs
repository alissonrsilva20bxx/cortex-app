// Abertura "Rota das metas" (proposta 2, docs/jornada/referencias/
// abertura-rota-das-metas.html, cópia do motion-atlas.html aprovado).
//   pixel  : o app (/login, que nasce na abertura já no HTML do servidor)
//            contra o desenho em 390×844, claro e escuro, com o tempo das
//            animações congelado no mesmo instante (Web Animations API);
//   prints : quadros-chave 0, 1, 2, 3 e 4 s em 390 e 430, claro e escuro;
//   flash  : grava os quadros desde o início do carregamento (screencast do
//            Chrome) e mede o brilho de cada um: no escuro, nenhum quadro
//            claro; no claro, nenhum quadro preto.
// Uso: node tests/visual/pixel/abertura.mjs [--base-url=...] [--prints=pasta]
// Saída dos diffs em %TEMP%/w2-pixel/abertura. Falha (código 1) se algo
// não bater.
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
  `${REPO}/docs/jornada/referencias/abertura-rota-das-metas.html`
).href;
const arg = (n, d) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const BASE = arg("base-url", "http://localhost:3103");
const PRINTS = arg("prints", null);
const OUT = `${process.env.TEMP ?? "."}/w2-pixel/abertura`;
mkdirSync(OUT, { recursive: true });
if (PRINTS) mkdirSync(PRINTS, { recursive: true });
const ALT = { 390: 844, 430: 932 };
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--disable-gpu", "--disable-gpu-rasterization"],
});
const resultados = [];
const passo = (nome, ok, extra = "") => {
  resultados.push(ok);
  console.log(`${ok ? "ok   " : "FALHA"} ${nome}${extra ? "  " + extra : ""}`);
};

/** Congela todas as animações da página no instante `t` (s). */
async function congelar(p, t, seletor = null) {
  await p.evaluate(
    ([t, seletor]) => {
      const raiz = seletor ? document.querySelector(seletor) : document;
      const anims = seletor
        ? raiz.getAnimations({ subtree: true })
        : document.getAnimations();
      for (const a of anims) {
        a.pause();
        a.currentTime = t * 1000;
      }
    },
    [t, seletor]
  );
}

// Os temporizadores de 50 ms ou mais não disparam (o quadro parado do
// movimento reduzido já sai uns 200 ms depois da hidratação): a abertura não sai sozinha
// enquanto o quadro é fotografado (o tempo da cena é o das animações).
const SEM_SAIDA = () => {
  const orig = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms, ...a) =>
    typeof ms === "number" && ms >= 50 ? 0 : orig(fn, ms, ...a);
};

async function app(w, md, { reduzir = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: ALT[w] },
    deviceScaleFactor: 2,
    reducedMotion: reduzir ? "reduce" : "no-preference",
  });
  await ctx.addInitScript((md) => {
    localStorage.setItem("jobapp-theme", "pink-neon");
    localStorage.setItem("jobapp-mode", md);
  }, md);
  await ctx.addInitScript(SEM_SAIDA);
  await ctx.route("**/api/**", (r) => r.abort());
  await ctx.route(/supabase\.co/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 180000 });
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await p.locator('[data-abertura="rota-das-metas"]').waitFor();
  await p.evaluate(() => document.fonts.ready);
  return { ctx, p };
}

async function ref(md, { reduzir = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 790, height: 1000 },
    deviceScaleFactor: 2,
    reducedMotion: reduzir ? "reduce" : "no-preference",
  });
  const p = await ctx.newPage();
  await p.goto(REF, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate((md) => {
    document.querySelectorAll(".phone").forEach((f) => (f.dataset.md = md));
    const ph = document.querySelector('.card[data-id="2"] .phone');
    ph.style.cssText +=
      ";position:fixed!important;left:0!important;top:0!important;transform:none!important;border-radius:0!important;box-shadow:none!important;z-index:999";
    const sc = ph.querySelector(".scene");
    sc.classList.remove("done");
    sc.classList.add("play");
  }, md);
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
const clip = (w) => ({ x: 0, y: 0, width: w, height: ALT[w] });

// ── (a) pixel contra o desenho, 390 ─────────────────────────────────────
const TEMPOS = [0, 1, 2, 3, 3.6];
for (const md of ["claro", "escuro"]) {
  const modo = md === "claro" ? "light" : "dark";
  const a = await app(390, modo);
  const r = await ref(md);
  for (const t of TEMPOS) {
    await congelar(a.p, t);
    await congelar(r.p, t, '.card[data-id="2"] .scene');
    await a.p.waitForTimeout(150);
    await r.p.waitForTimeout(150);
    const [pa, pr] = [
      await a.p.screenshot({ clip: clip(390) }),
      await r.p.screenshot({ clip: clip(390) }),
    ];
    const d = await diff(pr, pa);
    const suf = `390-${md}-${String(t).replace(".", "_")}s`;
    writeFileSync(join(OUT, `app-${suf}.png`), pa);
    writeFileSync(join(OUT, `ref-${suf}.png`), pr);
    writeFileSync(join(OUT, `diff-${suf}.png`), Buffer.from(d.img, "base64"));
    passo(`pixel ${suf}`, d.pct <= 0.5, `${d.pct.toFixed(2)}%`);
  }
  // movimento reduzido: o quadro final parado
  await a.ctx.close();
  await r.ctx.close();
  // O quadro parado é o CSS do movimento reduzido. Carrega em movimento
  // normal (a saída fica presa pelos temporizadores) e troca a preferência
  // depois: com ela desde o início, o quadro parado já sai uns 200 ms após a
  // hidratação, e numa hidratação lenta ia embora antes da foto. O tempo do
  // quadro parado é medido à parte.
  const ar = await app(390, modo);
  await ar.p.emulateMedia({ reducedMotion: "reduce" });
  const rr = await ref(md, { reduzir: true });
  await ar.p.waitForTimeout(200);
  const [pa, pr] = [
    await ar.p.screenshot({ clip: clip(390) }),
    await rr.p.screenshot({ clip: clip(390) }),
  ];
  const d = await diff(pr, pa);
  writeFileSync(join(OUT, `app-390-${md}-reduzido.png`), pa);
  writeFileSync(
    join(OUT, `diff-390-${md}-reduzido.png`),
    Buffer.from(d.img, "base64")
  );
  passo(
    `pixel 390-${md} movimento reduzido (quadro final parado)`,
    d.pct <= 0.5,
    `${d.pct.toFixed(2)}%`
  );
  if (PRINTS)
    await ar.p.screenshot({ path: `${PRINTS}/reduzido-390-${md}.png` });
  await ar.ctx.close();
  await rr.ctx.close();
}

// ── (b) prints dos quadros-chave, 390 e 430 ─────────────────────────────
if (PRINTS)
  for (const w of [390, 430])
    for (const md of ["claro", "escuro"]) {
      const a = await app(w, md === "claro" ? "light" : "dark");
      for (const t of [0, 1, 2, 3, 4]) {
        // 4 s: o fim da saída (o desenho some por inteiro em 4,0 s)
        if (t === 4) {
          await a.p.evaluate(() => {
            document.querySelector('[data-abertura="rota-das-metas"]').click();
          });
          await a.p.waitForTimeout(400);
        } else {
          await congelar(a.p, t);
          await a.p.waitForTimeout(150);
        }
        await a.p.screenshot({ path: `${PRINTS}/${t}s-${w}-${md}.png` });
      }
      await a.ctx.close();
    }

// ── (c) sem flash: brilho de cada quadro desde o início ────────────────
for (const md of ["escuro", "claro"]) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await ctx.addInitScript(
    (md) => {
      localStorage.setItem("jobapp-theme", "pink-neon");
      localStorage.setItem("jobapp-mode", md);
    },
    md === "claro" ? "light" : "dark"
  );
  await ctx.route("**/api/**", (r) => r.abort());
  await ctx.route(/supabase\.co/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto("about:blank");
  const cdp = await ctx.newCDPSession(p);
  const quadros = [];
  cdp.on("Page.screencastFrame", async (f) => {
    quadros.push(f.data);
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId });
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 60,
    everyNthFrame: 1,
  });
  await p.goto(`${BASE}/login`, { waitUntil: "commit", timeout: 180000 });
  await p.waitForTimeout(2500);
  await cdp.send("Page.stopScreencast");
  const brilhos = await pd.evaluate(async (lista) => {
    const out = [];
    for (const s of lista) {
      const i = new Image();
      i.src = "data:image/jpeg;base64," + s;
      await i.decode();
      const c = document.createElement("canvas");
      c.width = 40;
      c.height = 80;
      const g = c.getContext("2d");
      g.drawImage(i, 0, 0, 40, 80);
      const d = g.getImageData(0, 0, 40, 80).data;
      let soma = 0;
      for (let k = 0; k < d.length; k += 4)
        soma += 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
      out.push(Math.round(soma / (d.length / 4)));
    }
    return out;
  }, quadros);
  // O 1º quadro do screencast ainda é a about:blank anterior (branca): só
  // contam os quadros depois do 1º que já é da abertura.
  const inicio = brilhos.findIndex((b) =>
    md === "escuro" ? b < 60 : b > 150 && b < 250
  );
  const daAbertura = inicio >= 0 ? brilhos.slice(inicio) : [];
  const ruim =
    md === "escuro"
      ? daAbertura.filter((b) => b > 120)
      : daAbertura.filter((b) => b < 60);
  passo(
    `sem flash no início (${md}): ${daAbertura.length} quadros, brilho ${Math.min(...daAbertura)}–${Math.max(...daAbertura)}`,
    daAbertura.length > 3 && ruim.length === 0,
    `antes da abertura: ${brilhos.slice(0, Math.max(inicio, 0)).join(",")}`
  );
  await ctx.close();
}

await browser.close();
const falhas = resultados.filter((r) => !r).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} ok`);
process.exit(falhas ? 1 : 0);
