// Onboarding "Linha do tempo" × desenho aprovado
// (docs/jornada/referencias/onboarding-linha-do-tempo.html), tela a tela,
// com a mesma métrica do comparar.mjs (medirPixels: pixelmatch YIQ, 0,1).
//
//  - telas 1, 2 e 3 (boas-vindas, incluso, linha do tempo): a tela inteira;
//  - tela 4: só a pílula do contador (o Início atrás dela tem os dados do
//    laboratório, não os do desenho), nos dias 7, 3 e 1;
//  - tela 5 (fim do teste): a tela inteira.
// No desenho some a moldura do celular (barra de status, borda, sombra) e o
// celular fica em (0,0) com a largura da tela. O desenho não carrega a
// fonte (sem <link> nem @font-face): a ferramenta injeta nele a Plus
// Jakarta Sans que ele nomeia, o MESMO arquivo que o app serve (next/font).
//
// Uso (precisa de um `next dev` no ar; nunca sobe servidor, nunca apaga):
//   node tests/visual/pixel/onboarding.mjs --base-url=http://localhost:3103
//   --larguras=390,430 --modos=claro,escuro --saida=docs/jornada/prints/pixel
// Sai em <saida>/onboarding/: <tela>-<largura>-<modo>-{desenho,app,diff}.png
// e resultado.json.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ALTURA, HOJE_DO_MOCKUP, medirPixels } from "./comparar.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const arg = (n, p) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : p;
};
const BASE = arg(
  "base-url",
  process.env.PIXEL_BASE_URL ?? "http://localhost:3103"
);
const LARGURAS = arg("larguras", "390,430").split(",").map(Number);
const MODOS = arg("modos", "claro,escuro").split(",");
const DIR = join(
  resolve(ROOT, arg("saida", "docs/jornada/prints/pixel")),
  "onboarding"
);
mkdirSync(DIR, { recursive: true });
const DESENHO = pathToFileURL(
  join(ROOT, "docs/jornada/referencias/onboarding-linha-do-tempo.html")
).href;
const PW =
  process.env.PIXEL_PLAYWRIGHT ??
  "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME =
  process.env.PIXEL_CHROME ??
  "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const { chromium } = createRequire(PW)("playwright");
// Texto com suavização cinza nos dois lados, como no celular: no Windows de
// mesa o Chrome usa subpixel (bordas coloridas) quando o texto não está numa
// camada própria, e o desenho deixa as telas em camadas (cinza). Sem isto,
// a borda de toda letra divergia sem nada estar errado.
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--disable-lcd-text"],
});

const lona = await (await browser.newContext()).newPage();
await lona.setContent("<!doctype html><title>diff</title>");
async function diff(a, b) {
  return lona.evaluate(
    async ([a, b, fonte]) => {
      const medir = eval(`(${fonte})`);
      const carrega = (d) =>
        new Promise((ok) => {
          const i = new Image();
          i.onload = () => ok(i);
          i.src = `data:image/png;base64,${d}`;
        });
      const [ia, ib] = await Promise.all([carrega(a), carrega(b)]);
      const px = (img) => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, img.width, img.height).data;
      };
      const da = px(ia);
      const r = medir({
        a: da,
        b: px(ib),
        larguraA: ia.width,
        alturaA: ia.height,
        larguraB: ib.width,
        alturaB: ib.height,
        limiar: 0.1,
      });
      const s = document.createElement("canvas");
      s.width = r.largura;
      s.height = r.altura;
      const ctx = s.getContext("2d");
      const img = ctx.createImageData(r.largura, r.altura);
      for (let p = 0; p < r.largura * r.altura; p++) {
        const o = p * 4;
        const q = (Math.floor(p / r.largura) * ia.width + (p % r.largura)) * 4;
        const c = 255 - (255 - (da[q] + da[q + 1] + da[q + 2]) / 3) * 0.18;
        img.data[o] = r.mascara[p] ? 255 : c;
        img.data[o + 1] = r.mascara[p] ? 0 : c;
        img.data[o + 2] = r.mascara[p] ? 90 : c;
        img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return {
        difPct: r.difPct,
        tamanho: `${r.largura}x${r.altura}`,
        mesmoTamanho: r.mesmoTamanho,
        png: s.toDataURL("image/png").split(",")[1],
      };
    },
    [a.toString("base64"), b.toString("base64"), medirPixels.toString()]
  );
}

let cssDaFonte = null;
/** O @font-face da Plus Jakarta Sans do app (next/font), com o arquivo
 * embutido, para o desenho usar exatamente a mesma fonte. */
async function fonteDoApp() {
  if (cssDaFonte) return cssDaFonte;
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(`${BASE}/dev-preview/app`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  const faces = await p.evaluate(() => {
    const out = [];
    for (const sh of document.styleSheets) {
      let regras;
      try {
        regras = sh.cssRules;
      } catch {
        continue;
      }
      for (const r of regras)
        if (
          r instanceof CSSFontFaceRule &&
          /Plus_Jakarta|Plus Jakarta/i.test(r.style.fontFamily)
        ) {
          const url = r.style
            .getPropertyValue("src")
            .match(/url\("?([^")]+)"?\)/)?.[1];
          if (url)
            out.push({
              url: new URL(url, location.href).href,
              peso: r.style.fontWeight,
              faixa: r.style.getPropertyValue("unicode-range"),
            });
        }
    }
    return out;
  });
  if (!faces.length) throw new Error("não achei a Plus Jakarta Sans do app");
  const partes = [];
  for (const f of faces) {
    const corpo = await (await p.request.get(f.url)).body();
    partes.push(
      `@font-face{font-family:"Plus Jakarta Sans";font-style:normal;font-weight:${f.peso || "200 800"};font-display:block;src:url(data:font/woff2;base64,${corpo.toString("base64")}) format("woff2");${f.faixa ? `unicode-range:${f.faixa};` : ""}}`
    );
  }
  await ctx.close();
  cssDaFonte = partes.join("\n");
  return cssDaFonte;
}

/** O desenho no passo `passo` (0-4), dia `dia` na pílula. */
async function desenho(largura, modo, passo, dia = 7) {
  const ctx = await browser.newContext({
    viewport: { width: largura, height: ALTURA[largura] },
    deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();
  await p.goto(DESENHO, { waitUntil: "networkidle" });
  // A MESMA fonte do app (o arquivo do next/font), em data URL: com o
  // arquivo do Google Fonts a borda das letras diferia de leve.
  await p.addStyleTag({ content: await fonteDoApp() });
  await p.evaluate(
    ([m, ps, d, w, h]) => {
      /* eslint-disable no-undef */
      modo = m;
      passo = ps;
      dia = d;
      manual = true;
      document.documentElement.dataset.page = m;
      const ph = document.getElementById("main");
      ph.dataset.md = m;
      renderTudo();
      const st = document.createElement("style");
      st.textContent = `#main{position:fixed!important;left:0!important;top:0!important;transform:none!important;width:${w}px!important;height:${h}px!important;border-radius:0!important;box-shadow:none!important;z-index:2147483647}#main .sb{display:none!important}.screen{transition:none!important}`;
      document.head.appendChild(st);
      window.scrollTo(0, 0);
    },
    [modo, passo, dia, largura, ALTURA[largura]]
  );
  await p.evaluate(() => document.fonts.ready);
  const fonte = await p.evaluate(() =>
    document.fonts.check('800 30px "Plus Jakarta Sans"')
  );
  if (!fonte)
    throw new Error("o desenho não carregou a Plus Jakarta Sans do app");
  await p.waitForTimeout(400);
  return { ctx, p };
}

async function app(largura, modo) {
  const MODO_CSS = modo === "claro" ? "light" : "dark";
  const ctx = await browser.newContext({
    viewport: { width: largura, height: ALTURA[largura] },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await ctx.addInitScript((m) => {
    try {
      localStorage.setItem("jobapp-theme", "pink-neon");
      localStorage.setItem("jobapp-mode", m);
      localStorage.setItem("jobapp-recap-last-shown", "2026-09");
    } catch {}
  }, MODO_CSS);
  await ctx.route("**/api/**", (r) => r.abort());
  await ctx.route(/supabase\.co/, (r) => r.abort());
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(e.message.split("\n")[0]));
  await p.clock.setFixedTime(HOJE_DO_MOCKUP);
  await p.goto(`${BASE}/dev-preview/app`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await p.addStyleTag({
    content:
      "nextjs-portal{display:none!important;pointer-events:none!important}*,*::before,*::after{animation:none!important;transition:none!important}",
  });
  const recap = p.getByRole("button", { name: "Continuar no meu ritmo" });
  if (await recap.isVisible().catch(() => false)) await recap.click();
  await p.evaluate((m) => {
    const h = document.documentElement;
    h.setAttribute("data-theme", "pink-neon");
    if (m === "light") h.setAttribute("data-mode", "light");
    else h.removeAttribute("data-mode");
  }, MODO_CSS);
  await p.waitForTimeout(300);
  return { ctx, p, erros, tema: () => forcarTema(p, MODO_CSS) };
}

/** O ThemeProvider do laboratório reaplica o tema salvo (grafite) depois da
 * carga: o tema da medição é imposto de novo logo antes de cada print. */
async function forcarTema(p, MODO_CSS) {
  await p.evaluate((m) => {
    const h = document.documentElement;
    h.setAttribute("data-theme", "pink-neon");
    if (m === "light") h.setAttribute("data-mode", "light");
    else h.removeAttribute("data-mode");
  }, MODO_CSS);
  await p.waitForTimeout(120);
}

const resultados = [];
async function medir(nome, pngD, pngA) {
  writeFileSync(join(DIR, `${nome}-desenho.png`), pngD);
  writeFileSync(join(DIR, `${nome}-app.png`), pngA);
  const d = await diff(pngD, pngA);
  writeFileSync(join(DIR, `${nome}-diff.png`), Buffer.from(d.png, "base64"));
  resultados.push({
    nome,
    difPct: d.difPct,
    tamanho: d.tamanho,
    mesmoTamanho: d.mesmoTamanho,
  });
  console.log(
    `${nome.padEnd(30)} ${String(d.difPct).padStart(7)}%  ${d.tamanho}${d.mesmoTamanho ? "" : "  (tamanhos diferentes)"}`
  );
}

const TELAS_INTRO = ["boas-vindas", "incluso", "linha-do-tempo"];
for (const largura of LARGURAS)
  for (const modo of MODOS) {
    // Telas 1-3: o onboarding do laboratório.
    const a = await app(largura, modo);
    await a.p.evaluate(() => window.__previewOnboarding());
    await a.p.locator("[data-onboarding-tela]").waitFor();
    for (let i = 0; i < 3; i++) {
      await a.p.waitForTimeout(250);
      await a.tema();
      const pngA = await a.p.screenshot();
      const d = await desenho(largura, modo, i);
      await medir(
        `${TELAS_INTRO[i]}-${largura}-${modo}`,
        await d.p.screenshot(),
        pngA
      );
      await d.ctx.close();
      if (i < 2)
        await a.p
          .locator("[data-onboarding-tela] button", {
            hasText: /^(Começar meus|Continuar)/,
          })
          .click();
    }
    await a.ctx.close();

    // Tela 4: a pílula, nos dias 7, 3 e 1.
    for (const dia of [7, 3, 1]) {
      const b = await app(largura, modo);
      await b.p.evaluate((d) => window.__previewTrial(d), dia);
      const pilula = b.p.locator("[data-pilula-teste]");
      await pilula.waitFor();
      await b.p.waitForTimeout(250);
      await b.tema();
      // Só a pílula, sobre o mesmo cinza liso nos dois lados: ela é de
      // vidro (o fundo tinge) e o recorte retangular pega os cantos; atrás
      // dela o desenho tem o fundo dele e o app tem o Início do laboratório.
      const SO_A_PILULA = (sel) =>
        `html,body{background:#7a7a7a!important}*{visibility:hidden!important}${sel},${sel} *{visibility:visible!important}`;
      await b.p.addStyleTag({ content: SO_A_PILULA("[data-pilula-teste]") });
      const pngA = await pilula.screenshot();
      const d = await desenho(largura, modo, 3, dia);
      // O desenho desenha os ícones por <use> de um sprite: o sprite fica
      // visível (ele não tem tamanho, não aparece).
      await d.p.addStyleTag({
        content:
          SO_A_PILULA("#main .trial") +
          "svg:has(symbol),svg:has(symbol) *{visibility:visible!important}",
      });
      const pngD = await d.p.locator("#main .trial").screenshot();
      await medir(`pilula-dia${dia}-${largura}-${modo}`, pngD, pngA);
      await d.ctx.close();
      await b.ctx.close();
    }

    // Tela 5: os planos.
    const c = await app(largura, modo);
    await c.p.evaluate(() => window.__previewPlanos());
    await c.p.locator("[data-planos]").waitFor();
    await c.p.waitForTimeout(250);
    await c.tema();
    const pngA = await c.p.screenshot();
    const d = await desenho(largura, modo, 4);
    await medir(`planos-${largura}-${modo}`, await d.p.screenshot(), pngA);
    // A lista de planos e "Seus dados continuam", alinhadas pelo topo da
    // lista: o cartão de cima mostra o que ELA fez (dados do laboratório,
    // não os do desenho), e a altura dele empurra o que vem embaixo.
    const caixa = (pg, lista, keep) =>
      pg.evaluate(
        ([l, k]) => {
          const a = document.querySelector(l).getBoundingClientRect();
          const b = document.querySelector(k).getBoundingClientRect();
          return { topo: Math.floor(a.top), fim: Math.ceil(b.bottom) };
        },
        [lista, keep]
      );
    const cA = await caixa(
      c.p,
      "[data-planos] [role=radiogroup]",
      "[data-planos] [role=radiogroup] + div"
    );
    const cD = await caixa(
      d.p,
      "#main .screen.on .plans",
      "#main .screen.on .keep"
    );
    const altoLista = Math.max(cA.fim - cA.topo, cD.fim - cD.topo) + 24;
    await medir(
      `planos-lista-${largura}-${modo}`,
      await d.p.screenshot({
        clip: { x: 0, y: cD.topo - 12, width: largura, height: altoLista },
      }),
      await c.p.screenshot({
        clip: { x: 0, y: cA.topo - 12, width: largura, height: altoLista },
      })
    );
    // Os botões, presos ao fim da tela nos dois lados.
    const rodape = 200;
    const yR = ALTURA[largura] - rodape;
    await medir(
      `planos-botoes-${largura}-${modo}`,
      await d.p.screenshot({
        clip: { x: 0, y: yR, width: largura, height: rodape },
      }),
      await c.p.screenshot({
        clip: { x: 0, y: yR, width: largura, height: rodape },
      })
    );
    await d.ctx.close();
    await c.ctx.close();
  }

await browser.close();
writeFileSync(
  join(DIR, "resultado.json"),
  JSON.stringify(
    {
      quando: new Date().toISOString(),
      baseUrl: BASE,
      metrica: "pixelmatch YIQ, limiar 0.1",
      resultados,
    },
    null,
    2
  )
);
