// J16 (#166) — matriz de regressão visual e smoke da Jornada no laboratório.
//
// Mesmo formato do J07 (`tests/visual/j07-matriz.mjs`): roda contra um
// `next dev` já no ar, em /dev-preview/app (dados 100% mockados no
// navegador; /api/** e supabase.co bloqueados). Script Playwright avulso,
// fora do Vitest. Nada do repositório muda durante a rodada: o que precisa
// de outro comportamento (Modo discreto, rede caída, atendimento que traz
// comemoração) é trocado SÓ no navegador, num gancho do transporte de
// laboratório (`lib/mockJornada.ts`), como o J07 fez com o estado vazio.
//
//   J16_BASE_URL    padrão http://localhost:3102
//   J16_PLAYWRIGHT  pasta node_modules que contém `playwright`
//   J16_CHROME      executável do Chromium
//   J16_OUT         pasta dos prints (padrão docs/jornada/prints/J16)
//   J16_SECOES      só estas seções (matriz,comemoracao,smoke,saltos); as
//                   outras ficam como estavam no j16-medicoes.json
//
// Uso: node tests/visual/j16-matriz.mjs
//
// Superfícies: card no Início, tela "Sua Jornada", os 3 resumos e a
// comemoração. Em cada uma: transbordo na janela, contraste do texto contra
// o fundo real (pixels do print), alvos de toque < 44px. Fora da matriz:
// a sequência da comemoração no tempo, o Modo discreto, o atendimento
// adiado até a próxima abertura, a rede caída, e salto/rolagem ao abrir a
// tela e trocar de resumo.

import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const BASE = process.env.J16_BASE_URL ?? "http://localhost:3102";
const URL = `${BASE}/dev-preview/app`;
const PW =
  process.env.J16_PLAYWRIGHT ??
  "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME =
  process.env.J16_CHROME ??
  "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const OUT = process.env.J16_OUT ?? join(ROOT, "docs/jornada/prints/J16");
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
const ALTURA = { 390: 844, 430: 932 };
const USUARIA = "mock-app-user";
const modoSlug = (m) => (m === "light" ? "claro" : "escuro");

// Áudio: o Chromium sem gesto deixa o contexto suspenso; com esta chave ele
// toca, e o contador de osciladores mede se a comemoração fez som.
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

const SECOES = (
  process.env.J16_SECOES ?? "matriz,comemoracao,smoke,saltos"
).split(",");
const roda = (secao) => SECOES.includes(secao);
const MEDICOES = join(OUT, "j16-medicoes.json");
const anterior = existsSync(MEDICOES)
  ? JSON.parse(readFileSync(MEDICOES, "utf-8"))
  : {};
const resultado = {
  base: URL,
  quando: new Date().toISOString(),
  matriz: roda("matriz") ? [] : (anterior.matriz ?? []),
  comemoracao: roda("comemoracao") ? {} : (anterior.comemoracao ?? {}),
  smoke: roda("smoke") ? {} : (anterior.smoke ?? {}),
  saltos: roda("saltos") ? {} : (anterior.saltos ?? {}),
};

// Seletores das superfícies (os nomes acessíveis vêm de textos.ts).
const RAIZ = {
  card: 'button[aria-label="Abrir sua Jornada"]',
  tela: '[role="dialog"][aria-labelledby="jornada-titulo"]',
  resumos: "[data-jornada-resumos]",
  comemoracao: "[data-jornada-comemoracao]",
};

// ---------------------------------------------------------------------------
// Abertura
// ---------------------------------------------------------------------------

/**
 * `fila`: comemorações deixadas na fila persistente (J11) antes de abrir, como
 * se o app tivesse fechado com elas pendentes. `ganchos`: código que roda na
 * página antes do app e define `self.__j16R` (registrar do laboratório) e/ou
 * `self.__j16E` (estado lido pelo laboratório).
 */
async function abrir({
  width = 390,
  mode = "light",
  theme = "pink-neon",
  nova = false,
  fila = null,
  ganchos = null,
  manterRecap = false,
}) {
  const ctx = await browser.newContext({
    viewport: { width, height: ALTURA[width] },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await ctx.addInitScript(
    ([t, m, fila, chave]) => {
      try {
        localStorage.setItem("jobapp-theme", t);
        localStorage.setItem("jobapp-mode", m);
        if (fila && !sessionStorage.getItem("j16-semeada")) {
          sessionStorage.setItem("j16-semeada", "1");
          localStorage.setItem(
            chave,
            JSON.stringify({
              v: "v2",
              userId: chave.split(":")[1],
              estado: null,
              fila,
              pendentes: [],
            })
          );
        }
      } catch {}
      // Conta osciladores criados (som de verdade agendado).
      window.__osc = 0;
      const AC = window.AudioContext;
      if (AC) {
        const orig = AC.prototype.createOscillator;
        AC.prototype.createOscillator = function () {
          window.__osc++;
          return orig.call(this);
        };
      }
      // Linha do tempo da comemoração: o que aparece, em ordem.
      window.__vistos = [];
      const marcar = () => {
        const raiz = document.querySelector("[data-jornada-comemoracao]");
        if (!raiz) return;
        const t = raiz.innerText.replace(/\s+/g, " ").trim();
        const ult = window.__vistos[window.__vistos.length - 1];
        if (t && t !== ult?.t)
          window.__vistos.push({ t, ms: performance.now() });
      };
      new MutationObserver(marcar).observe(document, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    },
    [theme, mode, fila, `jobapp-jornada:${USUARIA}`]
  );
  if (ganchos) await ctx.addInitScript(ganchos);
  await ctx.route("**/api/**", (r) => r.abort());
  await ctx.route(/supabase\.co/, (r) => r.abort());
  // Os ganchos do transporte de laboratório, só neste navegador.
  await ctx.route("**/_next/static/chunks/**/*.js*", async (route) => {
    const res = await route.fetch();
    let body = await res.text();
    if (body.includes("comemoracoes: []")) {
      body = body
        .split("async registrar () {")
        .join(
          "async registrar (p) { if (self.__j16R) return self.__j16R(p, estado);"
        )
        .split("async lerEstado () {")
        .join(
          "async lerEstado () { if (self.__j16E) estado = self.__j16E(estado);"
        );
    }
    await route.fulfill({ response: res, body });
  });
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message.split("\n")[0]));
  await page.bringToFront();
  await page.goto(URL + (nova ? "?jornada=nova" : ""), {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important;pointer-events:none!important}",
  });
  // O recap do mês abre sozinho, às vezes depois do networkidle.
  if (!manterRecap) {
    const recap = page.getByRole("button", { name: "Continuar no meu ritmo" });
    try {
      await recap.waitFor({ state: "visible", timeout: 3000 });
      await recap.click();
      await page.waitForTimeout(600);
    } catch {}
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

async function abrirTela(page) {
  const card = page.locator(RAIZ.card);
  await card.waitFor({ state: "visible", timeout: 20000 });
  await card.click();
  await page.locator(RAIZ.tela).waitFor({ state: "visible" });
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Medições (as do J07, restritas à superfície)
// ---------------------------------------------------------------------------

async function medirTransbordo(page) {
  return page.evaluate(() => ({
    transbordoPx: document.documentElement.scrollWidth - window.innerWidth,
  }));
}

async function medirToque(page, raiz) {
  return page.evaluate((raiz) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const base = document.querySelector(raiz);
    if (!base) return { alvosVisiveis: 0, menoresQue44: [], semRaiz: true };
    const sel =
      'button, a[href], [role="button"], [role="tab"], [role="switch"], input:not([type="hidden"]), select, textarea';
    const lista = [
      ...(base.matches(sel) ? [base] : []),
      ...base.querySelectorAll(sel),
    ];
    const pequenos = [];
    let total = 0;
    for (const el of lista) {
      if (el.closest('[aria-hidden="true"]')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      total++;
      if (r.width < 44 || r.height < 44) {
        pequenos.push({
          nome: (el.getAttribute("aria-label") || el.textContent || el.tagName)
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    return { alvosVisiveis: total, menoresQue44: pequenos };
  }, raiz);
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

/** Mede a tela inteira rolando o diálogo de janela em janela. */
async function medirTelaRolando(page) {
  const passos = await page.evaluate((sel) => {
    const d = document.querySelector(sel);
    return Math.ceil(d.scrollHeight / d.clientHeight);
  }, RAIZ.tela);
  const contraste = { textosMedidos: 0, abaixoDoMinimo: [] };
  const toque = { alvosVisiveis: 0, menoresQue44: [] };
  for (let i = 0; i < passos; i++) {
    await page.evaluate(
      ([sel, i]) => {
        const d = document.querySelector(sel);
        d.scrollTop = i * d.clientHeight;
      },
      [RAIZ.tela, i]
    );
    await page.waitForTimeout(250);
    const c = await medirContraste(page, RAIZ.tela);
    const t = await medirToque(page, RAIZ.tela);
    contraste.textosMedidos += c.textosMedidos;
    contraste.abaixoDoMinimo.push(...c.abaixoDoMinimo);
    toque.alvosVisiveis += t.alvosVisiveis;
    toque.menoresQue44.push(...t.menoresQue44);
  }
  const unico = (lista, k) => [
    ...new Map(lista.map((x) => [k(x), x])).values(),
  ];
  contraste.abaixoDoMinimo = unico(contraste.abaixoDoMinimo, (x) => x.texto);
  toque.menoresQue44 = unico(toque.menoresQue44, (x) => x.nome);
  await page.evaluate((sel) => {
    document.querySelector(sel).scrollTop = 0;
  }, RAIZ.tela);
  return { contraste, toque };
}

async function printTelaInteira(page, arquivo, width) {
  const altura = await page.evaluate(
    (sel) => document.querySelector(sel).scrollHeight,
    RAIZ.tela
  );
  await page.setViewportSize({ width, height: altura });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, arquivo) });
  await page.setViewportSize({ width, height: ALTURA[width] });
  await page.waitForTimeout(300);
}

async function irParaResumos(page) {
  await page.evaluate((sel) => {
    const r = document.querySelector(sel);
    r?.scrollIntoView({ block: "start" });
  }, RAIZ.resumos);
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// 1. Matriz: card, tela, resumos (a comemoração vem na seção 2)
// ---------------------------------------------------------------------------

const combos = [];
for (const width of [390, 430])
  for (const mode of ["light", "dark"])
    combos.push({ width, mode, theme: "pink-neon", resumos: true });
for (const theme of TEMAS.slice(1))
  combos.push({ width: 390, mode: "light", theme, resumos: false });
for (const mode of ["light", "dark"])
  combos.push({
    width: 390,
    mode,
    theme: "pink-neon",
    resumos: true,
    nova: true,
  });

for (const c of roda("matriz") ? combos : []) {
  const sufixo = `${c.width}-${modoSlug(c.mode)}-${c.theme}${c.nova ? "-conta-nova" : ""}`;
  const { ctx, page, erros } = await abrir(c);
  const linha = { ...c, sufixo, superficies: {} };

  // Card no Início
  const card = page.locator(RAIZ.card);
  await card.waitFor({ state: "visible", timeout: 20000 });
  await card.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, `j16-card-${sufixo}.png`) });
  linha.superficies.card = {
    ...(await medirTransbordo(page)),
    contraste: await medirContraste(page, RAIZ.card),
    toque: await medirToque(page, RAIZ.card),
    texto: (await card.innerText()).replace(/\s+/g, " "),
  };
  // Tela
  await abrirTela(page);
  await forcarTema(page, c.theme, c.mode);
  await page.screenshot({ path: join(OUT, `j16-tela-${sufixo}.png`) });
  const medTela = await medirTelaRolando(page);
  linha.superficies.tela = {
    ...(await medirTransbordo(page)),
    ...medTela,
    secoes: await page.evaluate(
      (sel) =>
        [...document.querySelectorAll(`${sel} h2`)].map((h) => h.textContent),
      RAIZ.tela
    ),
    foco: await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label")
    ),
  };
  await printTelaInteira(page, `j16-tela-inteira-${sufixo}.png`, c.width);

  // Resumos (semana, mês, ano)
  if (c.resumos) {
    linha.superficies.resumos = {};
    for (const aba of ["Semana", "Mês", "Ano"]) {
      await irParaResumos(page);
      await page.getByRole("tab", { name: aba, exact: true }).click();
      await page.waitForTimeout(300);
      await irParaResumos(page);
      const slug = aba === "Mês" ? "mes" : aba.toLowerCase();
      await page
        .locator(RAIZ.resumos)
        .screenshot({ path: join(OUT, `j16-resumo-${slug}-${sufixo}.png`) });
      linha.superficies.resumos[slug] = {
        contraste: await medirContraste(page, RAIZ.resumos),
        toque: await medirToque(page, RAIZ.resumos),
        texto: (await page.locator(RAIZ.resumos).innerText()).replace(
          /\s+/g,
          " "
        ),
      };
    }
  }

  linha.erros = erros;
  resultado.matriz.push(linha);
  console.log(
    `matriz ${sufixo}: card ${linha.superficies.card.contraste.abaixoDoMinimo.length}c/${linha.superficies.card.toque.menoresQue44.length}t · tela ${medTela.contraste.abaixoDoMinimo.length}c/${medTela.toque.menoresQue44.length}t`
  );
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 2. Comemoração: a fila pendente toca na ordem, em vários instantes
// ---------------------------------------------------------------------------

const FILA = [
  {
    id: "f1",
    tipo: "pequena",
    glow: 15,
    ganhou: true,
    acao: "guardar_meta",
    pilar: "prosperar",
  },
  {
    id: "f2",
    tipo: "selo",
    glow: 20,
    ganhou: true,
    selo: "rumo_a_meta",
    nivel: 1,
    pilar: "prosperar",
  },
  { id: "f3", tipo: "estagio", glow: 0, ganhou: true, estagio: 1, de: 0 },
  { id: "f4", tipo: "meta", glow: 100, ganhou: true },
];

/** Toca a fila; tira prints nos instantes de cada item e toca pra seguir. */
async function tocarFila(page, nome, { prints = true } = {}) {
  const instantes = {
    pequena: [0, 600],
    selo: [150, 450, 1300],
    estagio: [100, 1150, 2700],
    meta: [2700],
  };
  const t0 = Date.now();
  const tirados = [];
  const medidas = {};
  for (const item of FILA) {
    // Espera o item aparecer na camada.
    await page
      .waitForFunction(
        (n) => window.__vistos.length >= n,
        FILA.indexOf(item) + 1,
        { timeout: 15000 }
      )
      .catch(() => {});
    const inicio = Date.now();
    for (const ms of instantes[item.tipo] ?? []) {
      const falta = inicio + ms - Date.now();
      if (falta > 0) await page.waitForTimeout(falta);
      if (prints) {
        const arq = `j16-comemoracao-${nome}-${item.tipo}-${String(ms).padStart(4, "0")}ms.png`;
        await page.screenshot({ path: join(OUT, arq) });
        tirados.push(arq);
      }
    }
    if (prints && !medidas[item.tipo]) {
      medidas[item.tipo] = {
        contraste: await medirContraste(page, RAIZ.comemoracao),
        toque: await medirToque(page, RAIZ.comemoracao),
      };
    }
    // Cartão e tela cheia seguem no toque; o aviso segue sozinho.
    if (item.tipo !== "pequena") {
      await page.waitForTimeout(400);
      await page.mouse.click(195, 420);
    }
  }
  await page.waitForTimeout(2600);
  const fim = await page.evaluate(() => ({
    vistos: window.__vistos.map((v) => v.t),
    osciladores: window.__osc,
    filaNoDisco:
      JSON.parse(
        localStorage.getItem("jobapp-jornada:mock-app-user") ?? "{}"
      ).fila?.map((c) => c.id) ?? null,
    camadaVazia: !document
      .querySelector("[data-jornada-comemoracao]")
      ?.innerText.trim(),
  }));
  return { ...fim, prints: tirados, medidas, duracaoMs: Date.now() - t0 };
}

for (const width of roda("comemoracao") ? [390, 430] : [])
  for (const mode of ["light", "dark"]) {
    const sufixo = `${width}-${modoSlug(mode)}-pink-neon`;
    const { ctx, page, erros } = await abrir({ width, mode, fila: FILA });
    await page.waitForTimeout(200);
    await forcarTema(page, "pink-neon", mode);
    // O print da superfície: o cartão do selo no pico.
    const r = await tocarFila(page, sufixo, { prints: width === 390 });
    if (width !== 390) {
      // Nas outras combinações, só o print da matriz e as medidas.
    }
    resultado.comemoracao[sufixo] = {
      ...r,
      erros,
      ...(await medirTransbordo(page)),
    };
    console.log(
      `comemoração ${sufixo}: ${r.vistos.length} itens, osciladores ${r.osciladores}, fila no disco ${JSON.stringify(r.filaNoDisco)}`
    );
    await ctx.close();
  }

// O print de matriz da comemoração em 430 (o selo no pico) e as medidas.
for (const mode of roda("comemoracao") ? ["light", "dark"] : []) {
  const { ctx, page } = await abrir({ width: 430, mode, fila: [FILA[1]] });
  await page
    .waitForFunction(() => window.__vistos.length >= 1, null, {
      timeout: 15000,
    })
    .catch(() => {});
  await page.waitForTimeout(1300);
  await forcarTema(page, "pink-neon", mode);
  await page.screenshot({
    path: join(OUT, `j16-comemoracao-430-${modoSlug(mode)}-pink-neon.png`),
  });
  resultado.comemoracao[`selo-430-${modoSlug(mode)}`] = {
    contraste: await medirContraste(page, RAIZ.comemoracao),
    toque: await medirToque(page, RAIZ.comemoracao),
  };
  await ctx.close();
}
for (const mode of roda("comemoracao") ? ["light", "dark"] : []) {
  const { ctx, page } = await abrir({ width: 390, mode, fila: [FILA[1]] });
  await page
    .waitForFunction(() => window.__vistos.length >= 1, null, {
      timeout: 15000,
    })
    .catch(() => {});
  await page.waitForTimeout(1300);
  await forcarTema(page, "pink-neon", mode);
  await page.screenshot({
    path: join(OUT, `j16-comemoracao-390-${modoSlug(mode)}-pink-neon.png`),
  });
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 3. Smoke no laboratório
// ---------------------------------------------------------------------------

// 6. Modo discreto: a mesma fila, sem som e sem forma grande.
if (roda("smoke")) {
  const { ctx, page } = await abrir({
    fila: FILA,
    ganchos: () => {
      self.__j16E = (e) => ({
        ...e,
        preferencias: { ...e.preferencias, modoDiscreto: true },
      });
    },
  });
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const formas = [];
    for (let i = 0; i < 40; i++) {
      const raiz = document.querySelector("[data-jornada-comemoracao]");
      const grande = raiz?.querySelector(
        '[role="button"], button, [aria-modal]'
      );
      if (grande) formas.push("grande");
      await espera(250);
    }
    return {
      vistos: window.__vistos.map((v) => v.t),
      osciladores: window.__osc,
      formaGrande: formas.length,
      canvasPintado: (() => {
        const c = document.querySelector("[data-jornada-comemoracao] canvas");
        if (!c || !c.width) return false;
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i]) return true;
        return false;
      })(),
    };
  });
  await page.screenshot({
    path: join(OUT, "j16-smoke-discreto-390-claro-pink-neon.png"),
  });
  resultado.smoke.discreto = r;
  console.log(`discreto: ${JSON.stringify(r)}`);
  await ctx.close();
}

// 4 e 5. Atendimento: a pequena toca, a grande fica pra próxima abertura.
if (roda("smoke")) {
  const ganchos = () => {
    self.__j16R = (p, estado) => {
      if (p?.acao !== "atendimento")
        return Promise.resolve({ estado, comemoracoes: [] });
      // Como o servidor (0035): o que vem do atendimento, além da pequena, é adiado.
      return Promise.resolve({
        estado,
        comemoracoes: [
          {
            id: `${p.chave}:1`,
            tipo: "pequena",
            glow: 0,
            ganhou: true,
            acao: "atendimento",
            adiada: false,
          },
          {
            id: `${p.chave}:2`,
            tipo: "selo",
            glow: 20,
            ganhou: true,
            selo: "mes_a_mes",
            nivel: 1,
            pilar: "organizar",
            adiada: true,
          },
        ],
      });
    };
  };
  const { ctx, page } = await abrir({ ganchos });
  await page.getByRole("button", { name: "Novo", exact: true }).first().click();
  const form = page.getByRole("dialog", { name: "Novo atendimento" });
  await form.waitFor({ state: "visible" });
  await form
    .getByPlaceholder("Nome do cliente")
    .first()
    .fill("Cliente de teste J16");
  await form.getByPlaceholder("0,00").fill("120");
  // Data e hora são obrigatórias: hoje, daqui a pouco.
  const hoje = new Date();
  const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  await form.locator('input[type="date"]').fill(iso);
  await form.locator('input[type="time"]').fill("10:00");
  // Presencial pede local.
  await form.getByPlaceholder("Endereço ou local").fill("Estúdio de teste");
  await form
    .getByRole("button", { name: /Registrar atendimento|Salvar/ })
    .last()
    .click();
  await page.waitForTimeout(4500);
  const naHora = await page.evaluate(() => ({
    vistos: window.__vistos.map((v) => v.t),
    filaNoDisco:
      JSON.parse(
        localStorage.getItem("jobapp-jornada:mock-app-user") ?? "{}"
      ).fila?.map((c) => `${c.tipo}${c.adiada ? "(adiada)" : ""}`) ?? null,
  }));
  await page.screenshot({
    path: join(OUT, "j16-smoke-atendimento-na-hora-390-claro-pink-neon.png"),
  });
  // Próxima abertura: recarrega o app (a fila persistente da J11 continua).
  await page.reload({ waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.waitForTimeout(1600);
  await page.screenshot({
    path: join(
      OUT,
      "j16-smoke-atendimento-proxima-abertura-390-claro-pink-neon.png"
    ),
  });
  const depois = await page.evaluate(() => ({
    vistos: window.__vistos.map((v) => v.t),
  }));
  resultado.smoke.atendimento = { naHora, proximaAbertura: depois };
  console.log(`atendimento: ${JSON.stringify(resultado.smoke.atendimento)}`);
  await ctx.close();
}

// 7. Rede caída na chamada da Jornada: a despesa continua valendo.
if (roda("smoke")) {
  const ganchos = () => {
    self.__j16R = () => Promise.reject(new Error("rede caída (J16)"));
  };
  const { ctx, page, erros } = await abrir({ ganchos });
  const mostrar = page.getByRole("button", { name: /Mostrar abas/ });
  if (await mostrar.isVisible().catch(() => false)) await mostrar.click();
  await page
    .getByRole("button", { name: "Financeiro", exact: true })
    .first()
    .click();
  await page.waitForTimeout(900);
  // O "+" abre a folha "Criar novo"; a ação abre o formulário (como no J07).
  await page.locator('[data-tour="fab"]').click();
  await page.waitForTimeout(500);
  await page
    .getByRole("button", { name: /^Nova Despesa/ })
    .first()
    .click();
  const form = page.getByRole("dialog", { name: "Nova Despesa" });
  await form.waitFor({ state: "visible" });
  await form.getByPlaceholder("Descrição").fill("Despesa J16 rede caída");
  await form.getByPlaceholder("Valor (R$)").fill("42");
  await form.getByRole("button", { name: "Salvar Despesa" }).click();
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => ({
    toast: document.body.innerText.includes("Despesa registrada!"),
    naLista: document.body.innerText.includes("Despesa J16 rede caída"),
    pendentes:
      JSON.parse(
        localStorage.getItem("jobapp-jornada:mock-app-user") ?? "{}"
      ).pendentes?.map((p) => p.acao) ?? null,
  }));
  await page.screenshot({
    path: join(OUT, "j16-smoke-rede-caida-390-claro-pink-neon.png"),
  });
  resultado.smoke.redeCaida = { ...r, erros };
  console.log(`rede caída: ${JSON.stringify(resultado.smoke.redeCaida)}`);
  await ctx.close();
}

// Na abertura do app, a comemoração pendente e o recap do mês aparecem juntos?
if (roda("smoke")) {
  const { ctx, page } = await abrir({ fila: [FILA[1]], manterRecap: true });
  const amostras = [];
  for (const ms of [300, 1300, 2500]) {
    await page.waitForTimeout(ms - (amostras.at(-1)?.ms ?? 0));
    const r = await page.evaluate(() => {
      const recap = document.querySelector(
        '[role="dialog"][aria-label="Seu recap do mês"]'
      );
      const cr = recap?.getBoundingClientRect();
      const recapVisivel =
        !!recap && cr.height > 0 && cr.top < window.innerHeight - 10;
      const camada = document.querySelector("[data-jornada-comemoracao]");
      const comemorando = !!camada?.innerText.trim();
      const meio = document.elementFromPoint(
        window.innerWidth / 2,
        window.innerHeight / 2
      );
      return {
        recapVisivel,
        comemorando,
        porCima: meio?.closest("[data-jornada-comemoracao]")
          ? "comemoracao"
          : meio?.closest('[aria-label="Seu recap do mês"]')
            ? "recap"
            : meio?.tagName,
      };
    });
    amostras.push({ ms, ...r });
    await page.screenshot({
      path: join(
        OUT,
        `j16-smoke-recap-e-comemoracao-${String(ms).padStart(4, "0")}ms.png`
      ),
    });
  }
  resultado.smoke.recapEComemoracao = amostras;
  console.log(`recap + comemoração: ${JSON.stringify(amostras)}`);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// 4. Salto de layout ao abrir a tela e ao trocar de resumo
// ---------------------------------------------------------------------------
for (const width of roda("saltos") ? [390, 430] : []) {
  const { ctx, page } = await abrir({ width });
  await page.evaluate(() => {
    window.__cls = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        if (!e.hadRecentInput) window.__cls.push(e.value);
    }).observe({ type: "layout-shift", buffered: false });
  });
  const posicao = () =>
    page.evaluate(() => ({
      main: document.querySelector("main")?.scrollTop ?? 0,
      janela: window.scrollY,
    }));
  await page
    .locator(RAIZ.card)
    .evaluate((e) => e.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(400);
  const antes = await posicao();
  await abrirTela(page);
  const aoAbrir = await page.evaluate(() =>
    window.__cls.reduce((a, b) => a + b, 0)
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const depois = await posicao();
  const rolagemPreservada =
    antes.main === depois.main && antes.janela === depois.janela;
  await abrirTela(page);
  await irParaResumos(page);
  const topoAntes = await page.evaluate(
    (sel) => document.querySelector(sel).getBoundingClientRect().top,
    RAIZ.resumos
  );
  const alturas = [];
  for (const aba of ["Mês", "Ano", "Semana"]) {
    await page.getByRole("tab", { name: aba, exact: true }).click();
    await page.waitForTimeout(300);
    alturas.push(
      await page.evaluate(
        (sel) => document.querySelector(sel).getBoundingClientRect().height,
        RAIZ.resumos
      )
    );
  }
  const topoDepois = await page.evaluate(
    (sel) => document.querySelector(sel).getBoundingClientRect().top,
    RAIZ.resumos
  );
  const total = await page.evaluate(() =>
    window.__cls.reduce((a, b) => a + b, 0)
  );
  resultado.saltos[width] = {
    rolagemDoInicio: { antes, depois, preservada: rolagemPreservada },
    clsAoAbrirTela: Math.round(aoAbrir * 1000) / 1000,
    clsTotal: Math.round(total * 1000) / 1000,
    resumoNaoPula: Math.abs(topoAntes - topoDepois) < 1,
    alturasDoResumo: alturas.map(Math.round),
  };
  console.log(`saltos ${width}: ${JSON.stringify(resultado.saltos[width])}`);
  await ctx.close();
}

writeFileSync(MEDICOES, JSON.stringify(resultado, null, 1));
await browser.close();
