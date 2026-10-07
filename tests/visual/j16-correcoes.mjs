// Correções da J16 (#197, #198, #200) — medição antes/depois no laboratório.
//
// Roda contra um `next dev` já no ar, em /dev-preview/app, como a matriz da
// J16 (tests/visual/j16-matriz.mjs, na #201). Mede só os três achados:
//   #197  contraste de "Selo novo" e "+N Glow" no cartão do selo, nos 8
//         temas, claro e escuro (pixels do print, método do J07);
//   #198  área de toque de "Voltar" e das chaves da tela da Jornada, e o
//         tamanho do que se VÊ (o desenho não pode crescer);
//   #200  os números do resumo da semana, do mês e do ano no laboratório.
// A comemoração toca no laboratório porque ele monta o ComemoracaoHost
// desde a J16 (#201).
//
//   J16C_FASE  "antes" ou "depois" (prefixo dos prints e do JSON)
//   J16C_OUT   pasta (padrão docs/jornada/prints/J16-correcoes)
//
// Uso: J16C_FASE=depois node tests/visual/j16-correcoes.mjs

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const URL = `${process.env.J16_BASE_URL ?? "http://localhost:3102"}/dev-preview/app`;
const PW =
  process.env.J16_PLAYWRIGHT ??
  "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME =
  process.env.J16_CHROME ??
  "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const FASE = process.env.J16C_FASE ?? "depois";
const OUT =
  process.env.J16C_OUT ?? join(ROOT, "docs/jornada/prints/J16-correcoes");
mkdirSync(OUT, { recursive: true });
const { chromium } = createRequire(PW)("playwright");

const TEMAS = [
  "pink-neon",
  "purple",
  "ocean",
  "midnight",
  "grafite",
  "gold",
  "emerald",
  "crimson",
];
const modoSlug = (m) => (m === "light" ? "claro" : "escuro");
const browser = await chromium.launch({ executablePath: CHROME });
const resultado = {
  fase: FASE,
  quando: new Date().toISOString(),
  selo: [],
  toque: [],
  resumos: {},
};

const SELO = {
  id: "c1",
  tipo: "selo",
  glow: 20,
  ganhou: true,
  selo: "rumo_a_meta",
  nivel: 1,
  pilar: "prosperar",
};

async function abrir({
  width = 390,
  mode = "light",
  theme = "pink-neon",
  fila = null,
}) {
  const ctx = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await ctx.addInitScript(
    ([t, m, fila]) => {
      try {
        localStorage.setItem("jobapp-theme", t);
        localStorage.setItem("jobapp-mode", m);
        const d = new Date();
        localStorage.setItem(
          "jobapp-recap-last-shown",
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        );
        if (fila && !sessionStorage.getItem("j16c")) {
          sessionStorage.setItem("j16c", "1");
          localStorage.setItem(
            "jobapp-jornada:mock-app-user",
            JSON.stringify({
              v: "v2",
              userId: "mock-app-user",
              estado: null,
              fila,
              pendentes: [],
            })
          );
        }
      } catch {}
    },
    [theme, mode, fila]
  );
  await ctx.route("**/api/**", (r) => r.abort());
  await ctx.route(/supabase\.co/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.bringToFront();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 180000 });
  await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important;pointer-events:none!important}",
  });
  await page.evaluate(
    ([t, m]) => {
      const h = document.documentElement;
      h.setAttribute("data-theme", t);
      if (m === "light") h.setAttribute("data-mode", "light");
      else h.removeAttribute("data-mode");
    },
    [theme, mode]
  );
  return { ctx, page };
}

/** Contraste contra o fundo real (pixels do print), só dentro da superfície. */
async function medirContraste(page, raiz) {
  const png = await page.screenshot({ type: "png" });
  return page.evaluate(
    async ([dataUrl, raiz]) => {
      const base = document.querySelector(raiz);
      if (!base) return { textosMedidos: 0, abaixoDoMinimo: [], semRaiz: true };
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const dpr = img.width / window.innerWidth;
      const cv = document.createElement("canvas");
      cv.width = img.width;
      cv.height = img.height;
      const g = cv.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const lin = (c) => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const lum = ([r, gg, b]) =>
        0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
      const ratio = (a, b) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };
      const parse = (s) => {
        const m = s.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1]
          .split(/[ ,/]+/)
          .filter(Boolean)
          .map(Number);
        return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
      };
      const falhas = [];
      let medidos = 0;
      const vh = window.innerHeight;
      const todos = [base, ...base.querySelectorAll("*")];
      for (const el of todos) {
        const temTexto = [...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim().length > 1
        );
        if (!temTexto) continue;
        if (el.closest('[aria-hidden="true"], [disabled]')) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (
          r.width < 4 ||
          r.height < 6 ||
          r.top < 0 ||
          r.bottom > vh ||
          r.left < 0 ||
          r.right > window.innerWidth
        )
          continue;
        const topo = document.elementFromPoint(
          r.left + Math.min(r.width / 2, 8),
          r.top + r.height / 2
        );
        if (!topo || (topo !== el && !el.contains(topo) && !topo.contains(el)))
          continue;
        let op = 1;
        for (let p = el; p; p = p.parentElement)
          op *= Number(getComputedStyle(p).opacity);
        if (op < 0.05) continue;
        const cor = parse(cs.color);
        if (!cor) continue;
        const data = g.getImageData(
          Math.floor(r.left * dpr),
          Math.floor(r.top * dpr),
          Math.max(1, Math.floor(r.width * dpr)),
          Math.max(1, Math.floor(r.height * dpr))
        ).data;
        const hist = new Map();
        for (let i = 0; i < data.length; i += 4) {
          const k =
            ((data[i] >> 3) << 10) |
            ((data[i + 1] >> 3) << 5) |
            (data[i + 2] >> 3);
          const e = hist.get(k) || [0, 0, 0, 0];
          e[0]++;
          e[1] += data[i];
          e[2] += data[i + 1];
          e[3] += data[i + 2];
          hist.set(k, e);
        }
        let best = null;
        for (const e of hist.values()) if (!best || e[0] > best[0]) best = e;
        const fundo = [best[1] / best[0], best[2] / best[0], best[3] / best[0]];
        const a = cor[3] * op;
        const texto = [0, 1, 2].map((i) => cor[i] * a + fundo[i] * (1 - a));
        const tam = parseFloat(cs.fontSize);
        const peso = Number(cs.fontWeight) || 400;
        const grande = tam >= 24 || (tam >= 18.66 && peso >= 700);
        const minimo = grande ? 3 : 4.5;
        const cr = ratio(texto, fundo);
        medidos++;
        if (cr < minimo) {
          falhas.push({
            texto: el.textContent.trim().replace(/\s+/g, " ").slice(0, 40),
            contraste: Math.round(cr * 100) / 100,
            minimo,
            corCss: cs.color,
            fundo: `rgb(${fundo.map(Math.round).join(",")})`,
            tamanho: tam,
          });
        }
      }
      return { textosMedidos: medidos, abaixoDoMinimo: falhas };
    },
    [`data:image/png;base64,${png.toString("base64")}`, raiz]
  );
}

/**
 * Contraste de um texto pequeno sobre fundo que muda (os raios do cartão
 * giram atrás dele). Fundo = as cores da caixa do texto (com 6px de folga)
 * que NÃO são o próprio texto, e entre elas as que cobrem pelo menos 10%
 * dos pixels; vale o PIOR contraste. Assim o raio claro e o escuro contam.
 */
async function contrastePiorFundo(page, seletorTexto) {
  const png = await page.screenshot({ type: "png" });
  return page.evaluate(
    async ([dataUrl, seletorTexto]) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const dpr = img.width / window.innerWidth;
      const cv = document.createElement("canvas");
      cv.width = img.width;
      cv.height = img.height;
      const g = cv.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const lin = (c) => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const lum = ([r, gg, b]) =>
        0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
      const ratio = (a, b) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };
      const out = [];
      for (const el of document.querySelectorAll(seletorTexto)) {
        const cs = getComputedStyle(el);
        const m = cs.color.match(/rgba?\(([^)]+)\)/);
        const cor = m[1]
          .split(/[ ,/]+/)
          .filter(Boolean)
          .map(Number)
          .slice(0, 3);
        const r = el.getBoundingClientRect();
        const f = 6;
        const data = g.getImageData(
          Math.floor((r.left - f) * dpr),
          Math.floor((r.top - f) * dpr),
          Math.ceil((r.width + 2 * f) * dpr),
          Math.ceil((r.height + 2 * f) * dpr)
        ).data;
        const hist = new Map();
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const px = [data[i], data[i + 1], data[i + 2]];
          const dist = Math.hypot(
            px[0] - cor[0],
            px[1] - cor[1],
            px[2] - cor[2]
          );
          if (dist < 90) continue; // o texto e o miolo do antisserrilhado
          const k = ((px[0] >> 3) << 10) | ((px[1] >> 3) << 5) | (px[2] >> 3);
          const e = hist.get(k) || [0, 0, 0, 0];
          e[0]++;
          e[1] += px[0];
          e[2] += px[1];
          e[3] += px[2];
          hist.set(k, e);
          n++;
        }
        const fundos = [...hist.values()]
          .filter((e) => e[0] / n >= 0.1)
          .map((e) => [e[1] / e[0], e[2] / e[0], e[3] / e[0]]);
        const pior = Math.min(...fundos.map((fd) => ratio(cor, fd)));
        const tam = parseFloat(cs.fontSize);
        const peso = Number(cs.fontWeight) || 400;
        const minimo = tam >= 24 || (tam >= 18.66 && peso >= 700) ? 3 : 4.5;
        out.push({
          texto: el.textContent.trim(),
          cor: cs.color,
          fundos: fundos.map((fd) => `rgb(${fd.map(Math.round).join(",")})`),
          contraste: Math.round(pior * 100) / 100,
          minimo,
        });
      }
      return out;
    },
    [`data:image/png;base64,${png.toString("base64")}`, seletorTexto]
  );
}

// ---------------------------------------------------------------- #197
for (const theme of TEMAS)
  for (const mode of ["light", "dark"]) {
    const { ctx, page } = await abrir({ theme, mode, fila: [SELO] });
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-jornada-comemoracao]")
          ?.innerText.includes("+20"),
      null,
      { timeout: 15000 }
    );
    await page.waitForTimeout(1300);
    const nome = `j16c-${FASE}-selo-390-${modoSlug(mode)}-${theme}.png`;
    await page.screenshot({ path: join(OUT, nome) });
    // Os dois textos do achado: a chamada e a pílula do Glow do cartão.
    const medidas = await contrastePiorFundo(
      page,
      '[data-jornada-comemoracao] [class*="chamada"], [data-jornada-comemoracao] [class*="glow"]'
    );
    const abaixo = medidas.filter((x) => x.contraste < x.minimo);
    resultado.selo.push({ theme, mode, print: nome, medidas });
    console.log(
      `selo ${mode} ${theme}: ${medidas.map((x) => `${x.texto}=${x.contraste}`).join(" ")}${abaixo.length ? "  <-- ABAIXO" : ""}`
    );
    await ctx.close();
  }

// ---------------------------------------------------------------- #198
for (const width of [390, 430])
  for (const mode of ["light", "dark"]) {
    const { ctx, page } = await abrir({ width, mode });
    const card = page.locator('button[aria-label="Abrir sua Jornada"]');
    await card.waitFor({ state: "visible", timeout: 20000 });
    await card.click();
    const tela = page.locator(
      '[role="dialog"][aria-labelledby="jornada-titulo"]'
    );
    await tela.waitFor();
    await page.waitForTimeout(500);
    const sufixo = `${width}-${modoSlug(mode)}-pink-neon`;
    await page.screenshot({
      path: join(OUT, `j16c-${FASE}-tela-topo-${sufixo}.png`),
      clip: { x: 0, y: 0, width, height: 160 },
    });
    const medir = () =>
      page.evaluate(() => {
        const caixa = (el) => {
          const r = el.getBoundingClientRect();
          return {
            w: Math.round(r.width),
            h: Math.round(r.height),
            x: Math.round(r.left),
            y: Math.round(r.top),
          };
        };
        // O que se vê: o primeiro elemento com fundo dentro do botão (ou ele).
        const visual = (el) => {
          for (const e of [el, ...el.querySelectorAll("*")]) {
            const bg = getComputedStyle(e).backgroundColor;
            if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent")
              return caixa(e);
          }
          return caixa(el);
        };
        const voltar = document.querySelector(
          '[role="dialog"] button[aria-label="Voltar"]'
        );
        const chaves = [
          ...document.querySelectorAll('[role="dialog"] [role="switch"]'),
        ];
        return [
          { nome: "Voltar", toque: caixa(voltar), visual: visual(voltar) },
          ...chaves.map((c) => ({
            nome:
              document.getElementById(c.getAttribute("aria-labelledby"))
                ?.textContent ?? "chave",
            toque: caixa(c),
            visual: visual(c),
          })),
        ];
      });
    const topo = await medir();
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      d.scrollTop = d.scrollHeight;
    });
    await page.waitForTimeout(400);
    const ajustes = await medir();
    await page.screenshot({
      path: join(OUT, `j16c-${FASE}-tela-ajustes-${sufixo}.png`),
    });
    const linha = { width, mode, voltar: topo[0], chaves: ajustes.slice(1) };
    resultado.toque.push(linha);
    console.log(
      `toque ${sufixo}: ${[linha.voltar, ...linha.chaves].map((x) => `${x.nome} toque ${x.toque.w}x${x.toque.h} visual ${x.visual.w}x${x.visual.h}`).join(" | ")}`
    );
    await ctx.close();
  }

// ---------------------------------------------------------------- #200
{
  const { ctx, page } = await abrir({});
  await page.locator('button[aria-label="Abrir sua Jornada"]').click();
  await page.locator("[data-jornada-resumos]").waitFor();
  for (const aba of ["Semana", "Mês", "Ano"]) {
    await page.evaluate(() =>
      document
        .querySelector("[data-jornada-resumos]")
        .scrollIntoView({ block: "start" })
    );
    await page.getByRole("tab", { name: aba, exact: true }).click();
    await page.waitForTimeout(300);
    await page.evaluate(() =>
      document
        .querySelector("[data-jornada-resumos]")
        .scrollIntoView({ block: "start" })
    );
    const slug = aba === "Mês" ? "mes" : aba.toLowerCase();
    await page.locator("[data-jornada-resumos]").screenshot({
      path: join(OUT, `j16c-${FASE}-resumo-${slug}-390-claro-pink-neon.png`),
    });
    resultado.resumos[slug] = (
      await page.locator("[data-jornada-resumos] section").innerText()
    ).replace(/\s+/g, " ");
    console.log(`resumo ${slug}: ${resultado.resumos[slug]}`);
  }
  await ctx.close();
}

writeFileSync(
  join(OUT, `j16c-${FASE}-medicoes.json`),
  JSON.stringify(resultado, null, 1)
);
await browser.close();
