// Card "Sua Jornada" do Início x o .jcard do protótipo aprovado
// (docs/jornada/referencias/prototipo-sua-jornada.html), recorte do elemento,
// mesma métrica da ferramenta (medirPixels: pixelmatch YIQ, limiar 0,1).
// O protótipo usa o estado padrão (sexta 02/10/2026); o app roda com o relógio
// nesse dia. O celular do protótipo vai para a MESMA posição absoluta do card
// no app: a borda tracejada de um círculo é desenhada conforme a posição.
// Uso: node tests/visual/pixel/card-jornada.mjs <rotulo> [larguras] [modos] [temas]
// (modos: light,dark). Saída em %TEMP%/w2-pixel/card. Precisa de um next dev
// em PX_BASE_URL (padrão http://localhost:3112).
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
const PROTO = pathToFileURL(
  `${REPO}/docs/jornada/referencias/prototipo-sua-jornada.html`
).href;
const BASE = process.env.PX_BASE_URL ?? "http://localhost:3112";
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SEM = process.argv.includes("--sem-ausentes");
const [rotulo = "x", ws = "390", ms = "light", ts = "pink-neon"] = args;
const OUT = process.env.PX_OUT ?? `${process.env.TEMP ?? "."}/w2-pixel/card`;
mkdirSync(OUT, { recursive: true });
const ALT = { 390: 844, 430: 932 };
const HOJE = new Date(2026, 9, 2, 10, 0, 0); // sexta, 02/10/2026: o S.date do protótipo
// Rasterização em software: com a da GPU, a ponta de um traço da borda
// tracejada do enfeite variava 1 pixel conforme a combinação anterior do lote.
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--disable-gpu", "--disable-gpu-rasterization"],
});

async function proto(w, md, tm, alvo = null) {
  const ctx = await browser.newContext({
    viewport: { width: w + 400, height: 1400 },
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript(
    ([tm, md, w]) => {
      try {
        localStorage.setItem(
          "jornada-proto-prefs",
          JSON.stringify({ tm, md, w })
        );
      } catch {}
    },
    [tm, md, w]
  );
  const p = await ctx.newPage();
  await p.goto(PROTO, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important}.ph,.phone{transform:none!important}.ph{border-radius:0!important;overflow:visible!important;isolation:auto!important;box-shadow:none!important}.scr{overflow:visible!important}" +
      (SEM ? ".jcard .week,.jcard .next{display:none!important}" : ""),
  });
  await p.waitForTimeout(400);
  const el = p.locator(".jcard").first();
  // O celular vai para a MESMA posição absoluta do card no app (a borda
  // tracejada de um círculo é desenhada de um jeito que depende dela).
  if (alvo)
    await p.evaluate(
      ([ax, ay]) => {
        window.scrollTo(0, 0);
        const r = document.querySelector(".jcard").getBoundingClientRect();
        const box = document.querySelector(".phbox");
        box.style.left = `${ax - r.x}px`;
        box.style.top = `${ay - r.y}px`;
      },
      [alvo.x, alvo.y]
    );
  await p.waitForTimeout(200);
  return { ctx, p, el };
}
async function app(w, md, tm) {
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
  await p.clock.setFixedTime(HOJE);
  await p.goto(`${BASE}/dev-preview/app`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await p.addStyleTag({
    content:
      "nextjs-portal{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important}",
  });
  const recap = p.getByRole("button", { name: "Continuar no meu ritmo" });
  if (await recap.isVisible().catch(() => false)) {
    await recap.click();
    await p.waitForTimeout(400);
  }
  await p.evaluate(
    ([tm, md]) => {
      const h = document.documentElement;
      h.setAttribute("data-theme", tm);
      if (md === "light") h.setAttribute("data-mode", "light");
      else h.removeAttribute("data-mode");
    },
    [tm, md]
  );
  await p.evaluate(() => document.fonts.ready);
  const el = p.getByRole("button", { name: "Abrir sua Jornada" }).first();
  await el.waitFor({ timeout: 20000 });
  // Sem rolar: o card cabe na tela em 390 e em 430. Rolar 1px mudava a
  // posição do card no documento (a do protótipo é sem rolagem), e a borda
  // tracejada do enfeite saía com 1 pixel de diferença.
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(500);
  // O app reaplica o tema depois de hidratar: força de novo antes do print.
  await p.evaluate(
    ([tm, md]) => {
      const h = document.documentElement;
      h.setAttribute("data-theme", tm);
      if (md === "light") h.setAttribute("data-mode", "light");
      else h.removeAttribute("data-mode");
    },
    [tm, md]
  );
  await p.waitForTimeout(400);
  const y = await p.evaluate(
    () =>
      document
        .querySelector('[aria-label="Abrir sua Jornada"]')
        .getBoundingClientRect().y
  );

  return { ctx, p, el };
}
async function shot(x) {
  const b = await x.el.boundingBox();
  const clip = {
    x: Math.floor(b.x),
    y: Math.floor(b.y),
    width: Math.round(b.width),
    height: Math.round(b.height),
  };
  return { png: await x.p.screenshot({ clip }), clip };
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
    for (const tm of ts.split(",")) {
      const suf = `${w}-${md === "light" ? "claro" : "escuro"}-${tm}`;
      const a = await app(w, md, tm);
      // No app o card herda a posição fracionária do card de cima (o Início usa
      // line-height 1,5 do mockup das 5 telas); o protótipo ganha a mesma fração.
      const alvo = await a.p.evaluate(() => {
        const r = document
          .querySelector('[aria-label="Abrir sua Jornada"]')
          .getBoundingClientRect();
        return { x: r.x, y: r.y };
      });
      const m = await proto(w, md, tm, alvo);
      const sm = await shot(m),
        sa = await shot(a);
      const d = await diff(sm.png, sa.png);
      writeFileSync(join(OUT, `${rotulo}-proto-${suf}.png`), sm.png);
      writeFileSync(join(OUT, `${rotulo}-app-${suf}.png`), sa.png);
      writeFileSync(
        join(OUT, `${rotulo}-diff-${suf}.png`),
        Buffer.from(d.img, "base64")
      );
      console.log(
        `card ${suf}: ${d.pct.toFixed(2)}%  proto ${d.tam[0]}x${d.tam[1]} app ${d.tam[2]}x${d.tam[3]}`
      );
      linhas.push({ suf, pct: d.pct });
      await m.ctx.close();
      await a.ctx.close();
    }
writeFileSync(
  join(OUT, `${rotulo}-resumo.json`),
  JSON.stringify(linhas, null, 1)
);
await browser.close();
