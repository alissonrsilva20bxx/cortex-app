// J07 (#157) — matriz de regressão visual e smoke das 5 telas da Jornada.
//
// Roda contra um `next dev` já no ar, na rota de laboratório /dev-preview/app
// (dados 100% mockados no navegador; nenhuma chamada de backend: /api/** e
// supabase.co ficam bloqueados). Não é teste do Vitest (só `*.test.ts` entra
// lá): é um script Playwright avulso, pra repetir a rodada da J07.
//
//   J07_BASE_URL       padrão http://localhost:3102
//   J07_PLAYWRIGHT     pasta node_modules que contém `playwright`
//   J07_CHROME         executável do Chromium
//   J07_OUT            pasta dos prints (padrão docs/jornada/prints/J07)
//   J07_RESULT         arquivo JSON com todas as medições
//
// Uso: node tests/visual/j07-matriz.mjs
//
// O que mede, por aba × largura × modo × tema (ver docs/jornada/tickets/J07.md):
//   1. transbordo horizontal na JANELA (scrollWidth − innerWidth) e quem passa
//      da borda direita;
//   5. contraste do texto contra o fundo de verdade (pixels do print, não CSS);
//   6. alvos de toque visíveis menores que 44×44;
// e, fora da matriz de prints:
//   2. barra pílula: recolhe ao rolar e volta, amostrada em vários instantes;
//   3. troca de aba: quadro em branco, salto de layout (layout-shift) e
//      posição de rolagem guardada por aba;
//   4. estado vazio de cada aba (semente do mock esvaziada só no navegador);
//   7. teclado: formulário aberto com a altura da janela reduzida (simulação).

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const BASE = process.env.J07_BASE_URL ?? "http://localhost:3102";
const URL = `${BASE}/dev-preview/app`;
const PW =
  process.env.J07_PLAYWRIGHT ??
  "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME =
  process.env.J07_CHROME ??
  "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const OUT = process.env.J07_OUT ?? join(ROOT, "docs/jornada/prints/J07");
const RESULT = process.env.J07_RESULT ?? join(OUT, "j07-medicoes.json");
mkdirSync(OUT, { recursive: true });

const { chromium } = createRequire(PW)("playwright");

const ABAS = [
  { slug: "inicio", nav: "Início", tab: "home" },
  { slug: "agenda", nav: "Agenda", tab: "jobs" },
  { slug: "financeiro", nav: "Financeiro", tab: "financeiro" },
  { slug: "cofre", nav: "Cofre", tab: "cofre" },
  { slug: "rede", nav: "Rede", tab: "rede" },
];
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
const ALTURA = { 390: 844, 430: 932 };
/** Tabelas de conteúdo esvaziadas no cenário "vazio". */
const VAZIAS = [
  "jobs",
  "metas",
  "despesas",
  "receitas_avulsas",
  "objetivos",
  "notas",
  "rede_posts",
  "rede_curtidas",
  "rede_comentarios",
  "rede_post_fotos",
]
  .map((t) => `${t}: []`)
  .join(", ");
const modoSlug = (m) => (m === "light" ? "claro" : "escuro");

const browser = await chromium.launch({ executablePath: CHROME });
const resultado = {
  geradoEm: new Date().toISOString(),
  url: URL,
  matriz: [],
  pilula: [],
  trocaDeAba: [],
  vazio: [],
  teclado: [],
  errosDePagina: [],
};

// ---------------------------------------------------------------------------
// Abertura da página
// ---------------------------------------------------------------------------

async function abrir({ width, mode, theme, vazio = false, height }) {
  const ctx = await browser.newContext({
    viewport: { width, height: height ?? ALTURA[width] },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await ctx.addInitScript(
    ([t, m]) => {
      try {
        localStorage.setItem("jobapp-theme", t);
        localStorage.setItem("jobapp-mode", m);
      } catch {}
    },
    [theme, mode]
  );
  // Nenhum backend: o laboratório é 100% mock no navegador.
  await ctx.route("**/api/**", (r) => r.abort());
  await ctx.route(/supabase\.co/, (r) => r.abort());
  if (vazio) {
    // Estado vazio só neste navegador: as tabelas de CONTEÚDO nascem sem
    // nenhuma linha (atendimentos, lançamentos, metas, objetivos, notas,
    // posts) e o Cofre sem arquivo. Conta, configurações, perfil, convite e
    // amizade ficam, senão a Rede volta pra vitrine em vez de mostrar o feed
    // vazio. Nada muda no repositório.
    await ctx.route("**/_next/static/chunks/**/*.js*", async (route) => {
      const res = await route.fetch();
      let body = await res.text();
      body = body
        .split("const store = seed.tables;")
        .join(`const store = { ...seed.tables, ${VAZIAS} };`)
        .split("new MockStorageBucket(seed.cofreFiles)")
        .join("new MockStorageBucket([])");
      await route.fulfill({ response: res, body });
    });
  }
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message.split("\n")[0]));
  await page.bringToFront();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
  // Overlay do next dev (hidratação conhecida da J01): fora do print e do toque.
  await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important;pointer-events:none!important}",
  });
  const recap = page.getByRole("button", { name: "Continuar no meu ritmo" });
  if (await recap.isVisible().catch(() => false)) {
    await recap.click();
    await page.waitForTimeout(500);
  }
  await forcarTema(page, theme, mode);
  return { ctx, page, erros };
}

async function forcarTema(page, theme, mode) {
  await page.evaluate(
    ([t, m]) => {
      const h = document.documentElement;
      h.setAttribute("data-theme", t);
      if (m === "light") h.setAttribute("data-mode", "light");
      else h.removeAttribute("data-mode");
    },
    [theme, mode]
  );
}

async function irPara(page, aba, theme, mode) {
  // A pílula pode estar recolhida: o botão "Mostrar abas" reabre.
  const mostrar = page.getByRole("button", { name: /Mostrar abas/ });
  if (await mostrar.isVisible().catch(() => false)) await mostrar.click();
  await page
    .getByRole("button", { name: aba.nav, exact: true })
    .first()
    .click();
  await page.waitForTimeout(900);
  await forcarTema(page, theme, mode);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(350);
}

// ---------------------------------------------------------------------------
// Medições dentro da página
// ---------------------------------------------------------------------------

/** Transbordo na janela + elementos visíveis que passam da borda direita. */
async function medirTransbordo(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const fora = [];
    const rolaNaHorizontal = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (
          ox === "auto" ||
          ox === "scroll" ||
          ox === "hidden" ||
          ox === "clip"
        )
          return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (r.right > vw + 1 && !rolaNaHorizontal(el)) {
        fora.push(
          `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} right=${Math.round(r.right)}`
        );
      }
    }
    return {
      transbordoPx: document.documentElement.scrollWidth - vw,
      bodyTransbordoPx: document.body.scrollWidth - vw,
      elementosForaDaBorda: fora.slice(0, 10),
    };
  });
}

/** Alvos de toque visíveis (na tela agora) menores que 44×44. */
async function medirToque(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sel =
      'button, a[href], [role="button"], [role="tab"], [role="switch"], input:not([type="hidden"]), select, textarea, summary';
    const pequenos = [];
    let total = 0;
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest('[aria-hidden="true"]')) continue;
      const cs = getComputedStyle(el);
      if (
        cs.visibility === "hidden" ||
        cs.display === "none" ||
        cs.pointerEvents === "none"
      )
        continue;
      let op = 1;
      for (let p = el; p; p = p.parentElement)
        op *= Number(getComputedStyle(p).opacity);
      if (op < 0.05) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      // Algo por cima (sheet fechado, overlay) não conta como alvo visível.
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), vw - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
      const topo = document.elementFromPoint(cx, cy);
      if (topo && topo !== el && !el.contains(topo) && !topo.contains(el))
        continue;
      total++;
      // Exceção do WCAG 2.5.8: link dentro de uma frase.
      const inline = el.tagName === "A" && cs.display === "inline";
      if ((r.width < 44 || r.height < 44) && !inline) {
        const nome = (
          el.getAttribute("aria-label") ||
          el.textContent ||
          el.getAttribute("placeholder") ||
          el.tagName
        )
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 40);
        pequenos.push({
          nome,
          w: Math.round(r.width),
          h: Math.round(r.height),
          disabled: el.disabled === true,
        });
      }
    }
    return { alvosVisiveis: total, menoresQue44: pequenos };
  });
}

/**
 * Contraste do texto contra o fundo REAL: o fundo é a cor mais frequente
 * dos pixels do print dentro da caixa do texto (gradientes, vidro e
 * transparência entram como a usuária vê). A cor do texto é a do CSS, já
 * composta com a opacidade dos ancestrais sobre esse fundo.
 */
async function medirContraste(page) {
  const png = await page.screenshot({ type: "png" });
  return page.evaluate(
    async (dataUrl) => {
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
      for (const el of document.querySelectorAll("body *")) {
        const temTexto = [...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim().length > 1
        );
        if (!temTexto) continue;
        if (
          el.closest(
            '[aria-hidden="true"], [disabled], [aria-disabled="true"], nextjs-portal'
          )
        )
          continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        // Cortado pela borda (chip rolado pra fora, etc.): o pedaço fora do
        // print não tem pixel pra medir.
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
    `data:image/png;base64,${png.toString("base64")}`
  );
}

// ---------------------------------------------------------------------------
// 1, 5, 6 — matriz de prints
// ---------------------------------------------------------------------------

const combos = [];
for (const width of [390, 430])
  for (const mode of ["light", "dark"])
    combos.push({ width, mode, theme: "pink-neon" });
for (const theme of TEMAS.slice(1))
  combos.push({ width: 390, mode: "light", theme });

for (const c of combos) {
  const { ctx, page, erros } = await abrir(c);
  for (const aba of ABAS) {
    await irPara(page, aba, c.theme, c.mode);
    const nome = `j07-${aba.slug}-${c.width}-${modoSlug(c.mode)}-${c.theme}.png`;
    await page.screenshot({ path: join(OUT, nome) });
    const tema = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      mode: document.documentElement.getAttribute("data-mode") ?? "dark",
      painel:
        document
          .querySelector('[data-tab-panel]:not([style*="none"])')
          ?.getAttribute("data-tab-panel") ?? null,
    }));
    const transbordo = await medirTransbordo(page);
    const toque = await medirToque(page);
    const contraste = await medirContraste(page);
    resultado.matriz.push({
      print: nome,
      aba: aba.slug,
      ...c,
      tema,
      ...transbordo,
      ...toque,
      ...contraste,
    });
    console.log(
      `${nome} transbordo=${transbordo.transbordoPx} toque<44=${toque.menoresQue44.length} contraste<min=${contraste.abaixoDoMinimo.length} painel=${tema.painel}`
    );
  }
  resultado.errosDePagina.push({ ...c, erros: [...new Set(erros)] });
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 2 — barra pílula, amostrada no tempo, nas 5 abas
// ---------------------------------------------------------------------------

async function estadoPilula(page) {
  return page.evaluate(() => {
    const nav = document.querySelector("nav[data-compact], nav.fixed");
    const r = nav?.getBoundingClientRect();
    const mais = document.querySelector('[data-tour="fab"]');
    const rm = mais?.getBoundingClientRect();
    return {
      scrollY: Math.round(window.scrollY),
      compacta: nav?.hasAttribute("data-compact") ?? null,
      largura: r ? Math.round(r.width) : null,
      maisVisivel: rm
        ? rm.width > 0 && Number(getComputedStyle(mais).opacity) > 0.05
        : false,
      maisRotulo: mais?.getAttribute("aria-label") ?? null,
      maisAoLado: rm && r ? rm.left >= r.right - 1 : null,
    };
  });
}

for (const mode of ["light", "dark"]) {
  const { ctx, page } = await abrir({ width: 390, mode, theme: "pink-neon" });
  for (const aba of ABAS) {
    await irPara(page, aba, "pink-neon", mode);
    const rolavel = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    );
    const amostras = {
      inicio: await estadoPilula(page),
      descendo: [],
      subindo: [],
    };
    await page.mouse.move(195, 400);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 150);
      await page.waitForTimeout(40);
    }
    const t0 = Date.now();
    for (const t of [0, 60, 120, 200, 300, 450, 700]) {
      const espera = t - (Date.now() - t0);
      if (espera > 0) await page.waitForTimeout(espera);
      amostras.descendo.push({ t, ...(await estadoPilula(page)) });
      if (mode === "light" && [0, 120, 700].includes(t)) {
        await page.screenshot({
          path: join(
            OUT,
            `j07-pilula-${aba.slug}-390-claro-pink-neon-descendo-${String(t).padStart(3, "0")}ms.png`
          ),
          clip: { x: 0, y: 844 - 130, width: 390, height: 130 },
        });
      }
    }
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(40);
    }
    const t1 = Date.now();
    for (const t of [0, 60, 120, 200, 300, 450, 700]) {
      const espera = t - (Date.now() - t1);
      if (espera > 0) await page.waitForTimeout(espera);
      amostras.subindo.push({ t, ...(await estadoPilula(page)) });
      if (mode === "light" && [0, 120, 700].includes(t)) {
        await page.screenshot({
          path: join(
            OUT,
            `j07-pilula-${aba.slug}-390-claro-pink-neon-subindo-${String(t).padStart(3, "0")}ms.png`
          ),
          clip: { x: 0, y: 844 - 130, width: 390, height: 130 },
        });
      }
    }
    const recolheu = amostras.descendo.some((a) => a.compacta);
    const voltou = amostras.subindo.at(-1).compacta === false;
    resultado.pilula.push({
      aba: aba.slug,
      mode,
      rolavelPx: rolavel,
      recolheu,
      voltou,
      amostras,
    });
    console.log(
      `pilula ${aba.slug} ${mode} rolavel=${rolavel} recolheu=${recolheu} voltou=${voltou}`
    );
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 3 — troca de aba: quadro em branco, layout-shift, rolagem guardada
// ---------------------------------------------------------------------------

{
  const { ctx, page } = await abrir({
    width: 390,
    mode: "light",
    theme: "pink-neon",
  });
  await page.evaluate(() => {
    window.__shifts = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        if (!e.hadRecentInput) window.__shifts.push(e.value);
    }).observe({ type: "layout-shift", buffered: false });
  });
  const posicoes = {};
  const sequencia = [...ABAS, ...ABAS]; // 2 voltas: a 2ª confere a rolagem guardada
  let anterior = null;
  for (const aba of sequencia) {
    const mostrar = page.getByRole("button", { name: /Mostrar abas/ });
    if (await mostrar.isVisible().catch(() => false)) await mostrar.click();
    await page.evaluate(() => {
      window.__shifts.length = 0;
      window.__quadros = [];
      const t0 = performance.now();
      const amostra = () => {
        const visiveis = [
          ...document.querySelectorAll("[data-tab-panel]"),
        ].filter((p) => p.style.display !== "none");
        window.__quadros.push({
          t: Math.round(performance.now() - t0),
          paineis: visiveis.map((p) => p.getAttribute("data-tab-panel")),
          altura: visiveis[0]
            ? Math.round(visiveis[0].getBoundingClientRect().height)
            : 0,
          scrollY: Math.round(window.scrollY),
        });
        if (performance.now() - t0 < 600) requestAnimationFrame(amostra);
      };
      requestAnimationFrame(amostra);
    });
    await page
      .getByRole("button", { name: aba.nav, exact: true })
      .first()
      .click();
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({
      quadros: window.__quadros,
      shifts: window.__shifts.reduce((s, v) => s + v, 0),
      scrollY: Math.round(window.scrollY),
      max: document.documentElement.scrollHeight - window.innerHeight,
    }));
    const esperado = posicoes[aba.slug] ?? 0;
    const quadrosVazios = r.quadros.filter(
      (q) => q.paineis.length !== 1 || q.altura === 0
    ).length;
    const registro = {
      de: anterior,
      para: aba.slug,
      scrollYDepois: r.scrollY,
      scrollYEsperado: Math.min(esperado, Math.max(0, r.max)),
      rolagemGuardada:
        Math.abs(r.scrollY - Math.min(esperado, Math.max(0, r.max))) <= 2,
      quadrosAmostrados: r.quadros.length,
      quadrosSemPainelOuVazios: quadrosVazios,
      layoutShift: Math.round(r.shifts * 1000) / 1000,
    };
    resultado.trocaDeAba.push(registro);
    console.log(
      `troca ${anterior}->${aba.slug} scroll=${r.scrollY}/${registro.scrollYEsperado} vazios=${quadrosVazios} cls=${registro.layoutShift}`
    );
    // Deixa esta aba rolada pra conferir na volta.
    const alvo = await page.evaluate(() => {
      const y = Math.min(
        300,
        Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      );
      window.scrollTo(0, y);
      return y;
    });
    await page.waitForTimeout(300);
    posicoes[aba.slug] = alvo;
    anterior = aba.slug;
  }
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 4 — estado vazio nas 5 abas (claro e escuro, 390, pink-neon)
// ---------------------------------------------------------------------------

for (const mode of ["light", "dark"]) {
  const { ctx, page, erros } = await abrir({
    width: 390,
    mode,
    theme: "pink-neon",
    vazio: true,
  });
  for (const aba of ABAS) {
    await irPara(page, aba, "pink-neon", mode);
    const nome = `j07-${aba.slug}-390-${modoSlug(mode)}-pink-neon-vazio.png`;
    await page.screenshot({ path: join(OUT, nome) });
    const info = await page.evaluate((tab) => {
      const p = document.querySelector(`[data-tab-panel="${tab}"]`);
      const texto = (p?.innerText ?? "").trim();
      return {
        alturaPainel: Math.round(p?.getBoundingClientRect().height ?? 0),
        caracteres: texto.length,
        trecho: texto.replace(/\s+/g, " ").slice(0, 300),
      };
    }, aba.tab);
    const transbordo = await medirTransbordo(page);
    resultado.vazio.push({
      print: nome,
      aba: aba.slug,
      mode,
      ...info,
      ...transbordo,
    });
    console.log(
      `vazio ${aba.slug} ${mode} altura=${info.alturaPainel} chars=${info.caracteres} transbordo=${transbordo.transbordoPx}`
    );
  }
  resultado.errosDePagina.push({
    width: 390,
    mode,
    theme: "pink-neon",
    vazio: true,
    erros: [...new Set(erros)],
  });
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 7 — teclado (simulado): abre um formulário, foca cada campo e reduz a
// altura da janela pela altura típica do teclado do iPhone (~336pt).
// Navegador de desktop não abre teclado virtual: isto mede se o campo ativo
// continua visível quando a área útil encolhe, não o comportamento do iOS.
// ---------------------------------------------------------------------------

const TECLADO = 336;
const formularios = [
  { aba: ABAS[1], acao: /^Novo atendimento/, nome: "agenda-novo-atendimento" },
  {
    aba: ABAS[2],
    acao: /^Nova (Despesa|Entrada)/,
    nome: "financeiro-novo-lancamento",
  },
];

/** Marca o diálogo de formulário aberto (na tela, com campos) e devolve quantos campos ele tem. */
async function marcarFormularioAberto(page) {
  return page.evaluate(() => {
    for (const d of document.querySelectorAll('[role="dialog"]'))
      d.removeAttribute("data-j07-aberto");
    const abertos = [...document.querySelectorAll('[role="dialog"]')].filter(
      (d) => {
        const cs = getComputedStyle(d);
        const r = d.getBoundingClientRect();
        return (
          cs.visibility === "visible" &&
          r.top < window.innerHeight &&
          r.bottom > 0 &&
          d.querySelector("input, textarea, select")
        );
      }
    );
    const d = abertos.at(-1);
    if (!d) return 0;
    d.setAttribute("data-j07-aberto", "");
    return d.querySelectorAll(
      'input:not([type="hidden"]):not([type="file"]), textarea'
    ).length;
  });
}

for (const f of formularios) {
  for (const width of [390, 430]) {
    const { ctx, page } = await abrir({
      width,
      mode: "light",
      theme: "pink-neon",
    });
    await irPara(page, f.aba, "pink-neon", "light");
    await page.locator('[data-tour="fab"]').click();
    await page.waitForTimeout(500);
    // O "+" abre a folha "Criar novo"; a ação certa abre o formulário.
    const acao = page.getByRole("button", { name: f.acao }).first();
    if (await acao.isVisible().catch(() => false)) {
      await acao.click();
      await page.waitForTimeout(600);
    }
    const nCampos = await marcarFormularioAberto(page);
    if (!nCampos) {
      resultado.teclado.push({
        formulario: f.nome,
        width,
        erro: "formulário não abriu",
      });
      await page.screenshot({
        path: join(OUT, `j07-teclado-${f.nome}-${width}-erro.png`),
      });
      await ctx.close();
      continue;
    }
    const campos = await page
      .locator(
        '[data-j07-aberto] input:not([type="hidden"]):not([type="file"]), [data-j07-aberto] textarea'
      )
      .all();
    const medicoes = [];
    let i = 0;
    for (const campo of campos) {
      await page.setViewportSize({ width, height: ALTURA[width] });
      await page.waitForTimeout(150);
      if (!(await campo.isVisible().catch(() => false))) continue;
      await campo.focus();
      await page.setViewportSize({ width, height: ALTURA[width] - TECLADO });
      await page.waitForTimeout(400);
      const m = await campo.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const dlg = el.closest('[role="dialog"]').getBoundingClientRect();
        return {
          campo:
            el.getAttribute("placeholder") ||
            el.getAttribute("aria-label") ||
            el.type,
          topo: Math.round(r.top),
          base: Math.round(r.bottom),
          alturaUtil: window.innerHeight,
          dialogoTopo: Math.round(dlg.top),
          visivel: r.top >= 0 && r.bottom <= window.innerHeight,
          focado: document.activeElement === el,
        };
      });
      medicoes.push(m);
      if (i === 0 || !m.visivel) {
        await page.screenshot({
          path: join(OUT, `j07-teclado-${f.nome}-${width}-campo${i + 1}.png`),
        });
      }
      i++;
    }
    resultado.teclado.push({
      formulario: f.nome,
      width,
      alturaTeclado: TECLADO,
      campos: medicoes,
    });
    console.log(
      `teclado ${f.nome} ${width}: ${medicoes.filter((m) => !m.visivel).length}/${medicoes.length} campos cobertos`
    );
    await ctx.close();
  }
}

writeFileSync(RESULT, JSON.stringify(resultado, null, 1));
console.log(
  `OK: ${resultado.matriz.length} prints da matriz; medições em ${RESULT}`
);
await browser.close();
