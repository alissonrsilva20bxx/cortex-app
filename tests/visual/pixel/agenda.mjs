// Pixel do mockup — comparador mockup × app, tela a tela.
//
// Até a ferramenta comum (tests/visual/pixel/comparar.mjs) chegar, é este
// que mede a Agenda. Roda contra um `next dev` no ar (/dev-preview/app) e
// o mockup normativo (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html):
//   - mockup: isola o celular da tela pedida, aplica tema e modo, 1:1;
//   - app: relógio congelado na quarta 23/09/2026 (o "hoje" do mockup),
//     recap do mês já visto, a aba certa, mesmo tema e modo;
//   - diff de pixels no canvas, com a métrica de cor do pixelmatch
//     (delta YIQ, limiar 0,1), e a imagem do diff;
//   - estilos computados de cada texto e de cada caixa com fundo.
//
// Uso: node tests/visual/pixel/agenda.mjs <tela> <rotulo> [larguras] [modos] [temas]
//   PX_OUT  pasta de saída (padrão docs/jornada/prints/pixel/<tela>)
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PW =
  process.env.PX_PLAYWRIGHT ??
  "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME =
  process.env.PX_CHROME ??
  "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const MOCKUP = pathToFileURL(
  `${REPO}/docs/jornada/referencias/5-telas-8-temas-claro-escuro.html`
).href;
const APP = `${process.env.PX_BASE_URL ?? "http://localhost:3102"}/dev-preview/app`;
const { chromium } = createRequire(PW)("playwright");

const [
  tela = "agenda",
  rotulo = "x",
  ws = "390,430",
  ms = "light,dark",
  ts = "pink-neon,ocean,gold",
] = process.argv.slice(2);
const OUT = process.env.PX_OUT ?? join(REPO, "docs/jornada/prints/pixel", tela);
mkdirSync(OUT, { recursive: true });
const ALT = { 390: 844, 430: 932 };
const NAV = {
  inicio: "Início",
  agenda: "Agenda",
  financeiro: "Financeiro",
  cofre: "Cofre",
  rede: "Rede",
};
const HOJE = new Date(2026, 8, 23, 10, 0, 0); // quarta, 23/09/2026 (o "hoje" do mockup)

const browser = await chromium.launch({ executablePath: CHROME });

async function mockup(w, md, tm) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: ALT[w] },
    deviceScaleFactor: 1,
  });
  const p = await ctx.newPage();
  await p.goto(MOCKUP, { waitUntil: "networkidle" });
  await p.evaluate(
    ([tela, md, tm, w, h]) => {
      const ph = document.querySelector(
        `#view-um .frame[data-t="${tela}"][data-md="${md}"] .ph`
      );
      ph.dataset.tm = tm;
      ph.style.width = w + "px";
      ph.style.height = h + "px";
      document.body.innerHTML = "";
      document.body.style.cssText = "margin:0;padding:0;background:none";
      document.documentElement.style.background = "none";
      document.body.appendChild(ph);
    },
    [tela, md, tm, w, ALT[w]]
  );
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  return { ctx, p };
}

async function app(w, md, tm) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: ALT[w] },
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  await ctx.addInitScript(
    ([tm, md]) => {
      try {
        localStorage.setItem("jobapp-theme", tm);
        localStorage.setItem("jobapp-mode", md);
        localStorage.setItem("jobapp-recap-last-shown", "2026-09");
      } catch {}
    },
    [tm, md]
  );
  await ctx.route("**/api/**", (r) => r.abort());
  await ctx.route(/supabase\.co/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.clock.setFixedTime(HOJE);
  await p.goto(APP, { waitUntil: "networkidle", timeout: 180000 });
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  const ir = async () => {
    const mostrar = p.getByRole("button", { name: /Mostrar abas/ });
    if (await mostrar.isVisible().catch(() => false)) await mostrar.click();
    await p
      .getByRole("button", { name: NAV[tela], exact: true })
      .first()
      .click();
  };
  if (tela !== "inicio") await ir();
  await p.waitForTimeout(900);
  await p.evaluate(
    ([tm, md]) => {
      const h = document.documentElement;
      h.setAttribute("data-theme", tm);
      if (md === "light") h.setAttribute("data-mode", "light");
      else h.removeAttribute("data-mode");
      window.scrollTo(0, 0);
      document.querySelector("main")?.scrollTo(0, 0);
    },
    [tm, md]
  );
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  return { ctx, p };
}

/** Estilos de cada elemento com texto próprio, e de cada caixa com fundo. */
function coletar() {
  const raiz = document.querySelector(".ph") ?? document.body;
  const vh = window.innerHeight;
  const out = { textos: [], caixas: [] };
  const caixa = (r) => [
    Math.round(r.left),
    Math.round(r.top),
    Math.round(r.width),
    Math.round(r.height),
  ];
  for (const el of raiz.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.top > vh || r.bottom < 0) continue;
    const proprio = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (proprio) {
      out.textos.push({
        t: proprio,
        fam: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
        tam: cs.fontSize,
        peso: cs.fontWeight,
        ls: cs.letterSpacing,
        lh: cs.lineHeight,
        cor: cs.color,
        caixa: caixa(r),
      });
    }
    const bg = cs.backgroundColor;
    const temFundo =
      (bg && bg !== "rgba(0, 0, 0, 0)") || cs.backgroundImage !== "none";
    if (temFundo && r.width < window.innerWidth + 1) {
      out.caixas.push({
        t: el.textContent.replace(/\s+/g, " ").trim().slice(0, 30),
        bg:
          cs.backgroundImage !== "none" ? cs.backgroundImage.slice(0, 60) : bg,
        raio: cs.borderRadius,
        pad: cs.padding,
        sombra: cs.boxShadow === "none" ? "" : cs.boxShadow.slice(0, 40),
        caixa: caixa(r),
      });
    }
  }
  return out;
}

async function diff(pngA, pngB, w, h, nomeDiff, pd) {
  return pd.evaluate(
    async ([a, b, w, h]) => {
      const load = async (s) => {
        const i = new Image();
        i.src = "data:image/png;base64," + s;
        await i.decode();
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d");
        g.drawImage(i, 0, 0);
        return g.getImageData(0, 0, w, h);
      };
      const x = await load(a),
        y = await load(b);
      const out = new ImageData(w, h);
      // pixelmatch: delta YIQ, limiar 0.1 (0.1² × 35215)
      const max = 35215 * 0.1 * 0.1;
      let n = 0;
      for (let i = 0; i < x.data.length; i += 4) {
        const [r1, g1, b1] = [x.data[i], x.data[i + 1], x.data[i + 2]];
        const [r2, g2, b2] = [y.data[i], y.data[i + 1], y.data[i + 2]];
        const yy = (r, g, b) =>
          r * 0.29889531 + g * 0.58662247 + b * 0.11448223;
        const ii = (r, g, b) => r * 0.59597799 - g * 0.2741761 - b * 0.32180189;
        const qq = (r, g, b) =>
          r * 0.21147017 - g * 0.52261711 + b * 0.31114694;
        const dy = yy(r1, g1, b1) - yy(r2, g2, b2),
          di = ii(r1, g1, b1) - ii(r2, g2, b2),
          dq = qq(r1, g1, b1) - qq(r2, g2, b2);
        const d = 0.5053 * dy * dy + 0.299 * di * di + 0.1957 * dq * dq;
        const gray = 255 - (255 - yy(r1, g1, b1)) * 0.1;
        if (d > max) {
          n++;
          out.data.set([255, 0, 60, 255], i);
        } else out.data.set([gray, gray, gray, 255], i);
      }
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").putImageData(out, 0, 0);
      return {
        pct: (100 * n) / (w * h),
        n,
        img: c.toDataURL("image/png").split(",")[1],
      };
    },
    [pngA.toString("base64"), pngB.toString("base64"), w, h]
  );
}

const linhas = [];
const pd = await (await browser.newContext()).newPage();
for (const w of ws.split(",").map(Number))
  for (const md of ms.split(","))
    for (const tm of ts.split(",")) {
      const suf = `${w}-${md === "light" ? "claro" : "escuro"}-${tm}`;
      const m = await mockup(w, md, tm);
      const pm = await m.p.screenshot({
        clip: { x: 0, y: 0, width: w, height: ALT[w] },
      });
      const em = await m.p.evaluate(coletar);
      const a = await app(w, md, tm);
      const pa = await a.p.screenshot({
        clip: { x: 0, y: 0, width: w, height: ALT[w] },
      });
      const ea = await a.p.evaluate(coletar);
      const d = await diff(pm, pa, w, ALT[w], suf, pd);
      writeFileSync(join(OUT, `${rotulo}-mockup-${suf}.png`), pm);
      writeFileSync(join(OUT, `${rotulo}-app-${suf}.png`), pa);
      writeFileSync(
        join(OUT, `${rotulo}-diff-${suf}.png`),
        Buffer.from(d.img, "base64")
      );
      writeFileSync(
        join(OUT, `${rotulo}-estilos-${suf}.json`),
        JSON.stringify({ mockup: em, app: ea }, null, 1)
      );
      linhas.push({ suf, pct: Math.round(d.pct * 100) / 100 });
      console.log(`${tela} ${suf}: diff ${d.pct.toFixed(2)}%`);
      await m.ctx.close();
      await a.ctx.close();
    }
writeFileSync(
  join(OUT, `${rotulo}-resumo.json`),
  JSON.stringify(linhas, null, 1)
);
await browser.close();
