// #176 — teclado cobrindo o campo ativo nos formulários em sheet
// (Novo atendimento, Nova Despesa e Nova Entrada). Mede antes/depois com a mesma
// simulação da J07 (tests/visual/j07-matriz.mjs) e mais uma, a do iPhone.
//
//   janela   — a janela inteira encolhe 336pt (o que a J07 fez; é como o
//              Chrome do Android redimensiona com o teclado).
//   iphone   — a janela NÃO muda e só o visualViewport encolhe 336pt, como
//              no Safari do iOS: o teclado cobre a parte de baixo da janela
//              e um `position: fixed; bottom: 0` fica atrás dele. Navegador
//              de desktop não abre teclado; o visualViewport é substituído
//              por um falso, só neste navegador, antes da página carregar.
//
// Também mede o sheet SEM teclado (altura e topo), pra provar que nada muda
// quando o teclado está fechado.
//
// Uso: J176_FASE=antes|depois node tests/visual/teclado-176.mjs
//   J176_BASE_URL (padrão http://localhost:3102), J176_PLAYWRIGHT, J176_CHROME
//   Saída: docs/jornada/prints/176/<fase>-*.png e medicao-<fase>.json

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const FASE = process.env.J176_FASE ?? "depois";
const URL = `${process.env.J176_BASE_URL ?? "http://localhost:3102"}/dev-preview/app`;
const PW =
  process.env.J176_PLAYWRIGHT ??
  "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME =
  process.env.J176_CHROME ??
  "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const OUT = join(ROOT, "docs/jornada/prints/176");
mkdirSync(OUT, { recursive: true });

const { chromium } = createRequire(PW)("playwright");
const TECLADO = 336;
const ALTURA = { 390: 844, 430: 932 };
const FORMULARIOS = [
  {
    nome: "atendimento",
    aba: "Agenda",
    acao: /^Novo atendimento/,
    dialogo: /^(Novo|Editar) atendimento$/,
  },
  {
    nome: "despesa",
    aba: "Financeiro",
    acao: /^Nova Despesa/,
    dialogo: /^Nova Despesa$/,
  },
  {
    // Aba interna "Entradas" do Financeiro: o botão "Nova Entrada" da
    // própria aba abre o formulário (sem passar pelo "+").
    nome: "entrada",
    aba: "Financeiro",
    subAba: "Entradas",
    semMais: true,
    acao: /^Nova Entrada/,
    dialogo: /^Nova Entrada$/,
  },
];

const browser = await chromium.launch({ executablePath: CHROME });
const resultado = {
  fase: FASE,
  geradoEm: new Date().toISOString(),
  teclado: TECLADO,
  casos: [],
};

/** visualViewport falso, controlável: `window.__teclado(px)` abre/fecha o "teclado". */
function instalarViewportFalso() {
  const alvo = new EventTarget();
  let teclado = 0;
  const vv = {
    get width() {
      return window.innerWidth;
    },
    get height() {
      return window.innerHeight - teclado;
    },
    get offsetTop() {
      return 0;
    },
    get offsetLeft() {
      return 0;
    },
    get pageTop() {
      return window.scrollY;
    },
    get pageLeft() {
      return window.scrollX;
    },
    get scale() {
      return 1;
    },
    addEventListener: alvo.addEventListener.bind(alvo),
    removeEventListener: alvo.removeEventListener.bind(alvo),
    dispatchEvent: alvo.dispatchEvent.bind(alvo),
    onresize: null,
    onscroll: null,
  };
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    get: () => vv,
  });
  window.__teclado = (px) => {
    teclado = px;
    alvo.dispatchEvent(new Event("resize"));
  };
}

/**
 * Tema pink-neon e modo forçados no <html>: Ajustes reaplica o tema salvo
 * do usuário de teste por cima do localStorage (achado da J01).
 */
async function forcarTema(page, mode) {
  await page.evaluate((m) => {
    const h = document.documentElement;
    h.setAttribute("data-theme", "pink-neon");
    if (m === "light") h.setAttribute("data-mode", "light");
    else h.removeAttribute("data-mode");
  }, mode);
}

async function abrir({ width, mode, iphone }) {
  const ctx = await browser.newContext({
    viewport: { width, height: ALTURA[width] },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await ctx.addInitScript(
    ([m]) => {
      try {
        localStorage.setItem("jobapp-theme", "pink-neon");
        localStorage.setItem("jobapp-mode", m);
      } catch {}
    },
    [mode]
  );
  if (iphone) await ctx.addInitScript(instalarViewportFalso);
  await ctx.route("**/api/**", (r) => r.abort());
  await ctx.route(/supabase\.co/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.bringToFront();
  await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
  await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important;pointer-events:none!important}",
  });
  // O recap do mês abre sozinho, às vezes depois do carregamento.
  const recap = page.getByRole("button", { name: "Continuar no meu ritmo" });
  if (
    await recap.waitFor({ state: "visible", timeout: 2500 }).then(
      () => true,
      () => false
    )
  ) {
    await recap.click();
    await page.waitForTimeout(500);
  }
  await forcarTema(page, mode);
  return { ctx, page };
}

async function abrirFormulario(page, f) {
  await page.getByRole("button", { name: f.aba, exact: true }).first().click();
  await page.waitForTimeout(700);
  if (f.subAba) {
    await page
      .getByRole("button", { name: f.subAba, exact: true })
      .first()
      .click();
    await page.waitForTimeout(500);
  }
  if (!f.semMais) {
    await page.locator('[data-tour="fab"]').click();
    await page.waitForTimeout(500);
  }
  await page.getByRole("button", { name: f.acao }).first().click();
  await page.waitForTimeout(700);
  return page.getByRole("dialog", { name: f.dialogo });
}

/** Geometria do sheet aberto, sem teclado. */
async function geometria(dialogo) {
  return dialogo.evaluate((d) => {
    const r = d.getBoundingClientRect();
    return {
      topo: Math.round(r.top),
      base: Math.round(r.bottom),
      altura: Math.round(r.height),
      alturaJanela: window.innerHeight,
    };
  });
}

for (const f of FORMULARIOS) {
  for (const width of [390, 430]) {
    for (const mode of ["light", "dark"]) {
      for (const simulacao of ["janela", "iphone"]) {
        const iphone = simulacao === "iphone";
        const { ctx, page } = await abrir({ width, mode, iphone });
        const dialogo = await abrirFormulario(page, f);
        await forcarTema(page, mode);
        const tema = await page.evaluate(() => ({
          theme: document.documentElement.getAttribute("data-theme"),
          mode: document.documentElement.getAttribute("data-mode") ?? "dark",
        }));
        const semTeclado = await geometria(dialogo);
        const campos = await dialogo
          .locator('input:not([type="hidden"]):not([type="file"]), textarea')
          .all();
        const medicoes = [];
        let i = 0;
        for (const campo of campos) {
          i++;
          // Fecha o "teclado", foca o campo como um toque faria, abre o "teclado".
          if (iphone) await page.evaluate(() => window.__teclado(0));
          else await page.setViewportSize({ width, height: ALTURA[width] });
          await page.waitForTimeout(150);
          if (!(await campo.isVisible().catch(() => false))) continue;
          await campo.focus();
          if (iphone) await page.evaluate((t) => window.__teclado(t), TECLADO);
          else
            await page.setViewportSize({
              width,
              height: ALTURA[width] - TECLADO,
            });
          await page.waitForTimeout(450);
          const m = await campo.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const vv = window.visualViewport;
            const visivelAte = vv
              ? vv.offsetTop + vv.height
              : window.innerHeight;
            const dlg = el.closest('[role="dialog"]').getBoundingClientRect();
            return {
              campo:
                el.getAttribute("placeholder") ||
                el.getAttribute("aria-label") ||
                el.type,
              topo: Math.round(r.top),
              base: Math.round(r.bottom),
              visivelAte: Math.round(visivelAte),
              visivel: r.top >= 0 && r.bottom <= visivelAte,
              focado: document.activeElement === el,
              sheetTopo: Math.round(dlg.top),
              sheetBase: Math.round(dlg.bottom),
            };
          });
          medicoes.push(m);
          // Print do campo mais baixo de cada formulário (o pior caso).
          if (i === campos.length || !m.visivel) {
            const nome = `${FASE}-${f.nome}-${width}-${mode === "light" ? "claro" : "escuro"}-${simulacao}-campo${i}.png`;
            if (iphone) {
              // No iPhone o teclado cobre a parte de baixo: o print mostra só
              // o que fica visível acima dele.
              await page.screenshot({
                path: join(OUT, nome),
                clip: { x: 0, y: 0, width, height: ALTURA[width] - TECLADO },
              });
            } else {
              await page.screenshot({ path: join(OUT, nome) });
            }
          }
        }
        const cobertos = medicoes.filter((m) => !m.visivel).length;
        resultado.casos.push({
          formulario: f.nome,
          width,
          mode,
          simulacao,
          tema,
          semTeclado,
          campos: medicoes,
          cobertos,
        });
        console.log(
          `${FASE} ${f.nome} ${width} ${mode} ${simulacao}: ${cobertos}/${medicoes.length} cobertos; sheet sem teclado ${semTeclado.topo}-${semTeclado.base}`
        );
        await ctx.close();
      }
    }
  }
}

writeFileSync(
  join(OUT, `medicao-${FASE}.json`),
  JSON.stringify(resultado, null, 1)
);
console.log(`OK ${FASE}`);
await browser.close();
