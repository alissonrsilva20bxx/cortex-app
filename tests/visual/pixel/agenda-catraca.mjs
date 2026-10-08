// Agenda: a faixa da semana desliza com o dedo, em catraca (uma semana
// inteira por gesto), com o indicador de qual semana e a volta para hoje.
//
// Roda contra um `next dev` já no ar (/dev-preview/app), com o relógio do
// mockup (quarta, 23/09/2026). Nunca sobe servidor, nunca apaga nada e só
// escreve em <saida>/agenda/:
//   node tests/visual/pixel/agenda-catraca.mjs --base-url=http://localhost:3103
// Opções: --largura=390 --modo=claro --tema=pink-neon --saida=docs/jornada/prints/pixel
//
// Falha (código 1) se qualquer passo não fizer o que deve. O pixel da tela
// parada continua medido pelo comparar.mjs (--tela=agenda).

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ALTURA, HOJE_DO_MOCKUP } from "./comparar.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const arg = (nome, padrao) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.slice(nome.length + 3) : padrao;
};
const BASE = arg(
  "base-url",
  process.env.PIXEL_BASE_URL ?? "http://localhost:3103"
);
const LARGURA = Number(arg("largura", "390"));
const MODO = arg("modo", "claro");
const TEMA = arg("tema", "pink-neon");
const DIR = join(
  resolve(ROOT, arg("saida", "docs/jornada/prints/pixel")),
  "agenda"
);
mkdirSync(DIR, { recursive: true });
const PW =
  process.env.PIXEL_PLAYWRIGHT ??
  "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME =
  process.env.PIXEL_CHROME ??
  "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const { chromium } = createRequire(PW)("playwright");

const browser = await chromium.launch({ executablePath: CHROME });
const MODO_CSS = MODO === "claro" ? "light" : "dark";
const ctx = await browser.newContext({
  viewport: { width: LARGURA, height: ALTURA[LARGURA] },
  deviceScaleFactor: 2,
  hasTouch: true,
});
await ctx.addInitScript(
  ([t, m]) => {
    try {
      localStorage.setItem("jobapp-theme", t);
      localStorage.setItem("jobapp-mode", m);
      localStorage.setItem("jobapp-recap-last-shown", "2026-09");
    } catch {}
  },
  [TEMA, MODO_CSS]
);
await ctx.route("**/api/**", (r) => r.abort());
await ctx.route(/supabase\.co/, (r) => r.abort());
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(e.message.split("\n")[0]));
await page.clock.setFixedTime(HOJE_DO_MOCKUP);
await page.goto(`${BASE}/dev-preview/app`, {
  waitUntil: "networkidle",
  timeout: 180000,
});
await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
const recap = page.getByRole("button", { name: "Continuar no meu ritmo" });
if (await recap.isVisible().catch(() => false)) await recap.click();
const mostrar = page.getByRole("button", { name: /Mostrar abas/ });
if (await mostrar.isVisible().catch(() => false)) await mostrar.click();
await page.getByRole("button", { name: "Agenda", exact: true }).first().click();
await page.waitForTimeout(900);
// Tema e modo como o comparar.mjs aplica (o laboratório lê do html).
await page.evaluate(
  ([t, m]) => {
    const h = document.documentElement;
    h.setAttribute("data-theme", t);
    if (m === "light") h.setAttribute("data-mode", "light");
    else h.removeAttribute("data-mode");
    for (const forte of document.querySelectorAll("strong"))
      if (forte.textContent?.trim() === "Sessão de teste local indisponível.") {
        const caixa = forte.closest("div");
        if (caixa) caixa.style.display = "none";
      }
  },
  [TEMA, MODO_CSS]
);
await page.waitForTimeout(300);

const faixa = page.locator(".agenda-semanas");
const estado = () =>
  page.evaluate(() => {
    const passo = (f) =>
      f.querySelector('[data-semana="1"]').offsetLeft -
      f.querySelector('[data-semana="0"]').offsetLeft;
    const el = document.querySelector(".agenda-semanas");
    const meio = el.querySelector('[data-semana="0"]');
    const sel = meio.querySelector('[aria-pressed="true"]');
    const ind = [...document.querySelectorAll("span[aria-live]")].find((s) =>
      /semana/i.test(s.textContent ?? "")
    );
    return {
      paginas: el.querySelectorAll("[data-semana]").length,
      // Passo de uma página: da semana do meio à seguinte (largura + vão).
      noMeio: Math.abs(el.scrollLeft - passo(el)) <= 1,
      dias: [...meio.querySelectorAll("button")].map((b) =>
        b.textContent.replace(/\D/g, "")
      ),
      selecionado: sel?.getAttribute("aria-label") ?? null,
      indicador: ind?.textContent ?? null,
      voltar: [...document.querySelectorAll("button")].some(
        (b) => b.textContent === "Voltar para hoje"
      ),
    };
  });
/** O gesto: arrasta a faixa uma fração da largura e solta; o snap leva até
 * a borda da página e a catraca assenta. */
async function deslizar(fracao) {
  await faixa.evaluate((el, f) => {
    const passo =
      el.querySelector('[data-semana="1"]').offsetLeft -
      el.querySelector('[data-semana="0"]').offsetLeft;
    el.scrollTo({ left: passo * (1 + f), behavior: "smooth" });
  }, fracao);
  await page.waitForTimeout(1200);
}

const passos = [];
const conferir = (nome, ok, dados) => {
  passos.push({ nome, ok, ...dados });
  console.log(`${ok ? "ok   " : "FALHA"} ${nome}  ${JSON.stringify(dados)}`);
};

let e = await estado();
conferir(
  "parada: 3 páginas, mostra a do meio, semana de 20 a 26/9, sem indicador",
  e.paginas === 3 &&
    e.noMeio &&
    e.dias.join(",") === "20,21,22,23,24,25,26" &&
    !e.voltar,
  e
);
writeFileSync(
  join(DIR, `catraca-1-parada-${LARGURA}-${MODO}-${TEMA}.png`),
  await page.screenshot()
);

// Foto do meio do gesto: com o snap ligado o navegador devolve a faixa pra
// borda na hora, então só pra foto o snap sai e volta.
await faixa.evaluate((el) => {
  el.style.scrollSnapType = "none";
  el.scrollLeft = (el.clientWidth + 5) * 1.45;
});
await page.waitForTimeout(150);
writeFileSync(
  join(DIR, `catraca-2-no-gesto-${LARGURA}-${MODO}-${TEMA}.png`),
  await page.screenshot()
);
await faixa.evaluate((el) => {
  el.scrollLeft = el.clientWidth + 5;
  el.style.scrollSnapType = "";
});
await page.waitForTimeout(800);
e = await estado();
conferir(
  "depois da foto do gesto: de volta à semana corrente",
  e.noMeio && e.dias.join(",") === "20,21,22,23,24,25,26",
  e
);

await deslizar(1);
e = await estado();
conferir(
  "desliza pra esquerda: próxima semana (27/9 a 3/10), mesmo dia da semana, indicador",
  e.noMeio &&
    e.dias.join(",") === "27,28,29,30,1,2,3" &&
    e.selecionado === "Dia 30" &&
    /Próxima semana/.test(e.indicador ?? "") &&
    e.voltar,
  e
);
writeFileSync(
  join(DIR, `catraca-3-proxima-${LARGURA}-${MODO}-${TEMA}.png`),
  await page.screenshot()
);

await deslizar(1);
e = await estado();
conferir(
  "de novo: daqui a 2 semanas (4 a 10/10), uma semana por gesto",
  e.dias.join(",") === "4,5,6,7,8,9,10" &&
    /Daqui a 2 semanas/.test(e.indicador ?? ""),
  e
);

await deslizar(-1);
await deslizar(-1);
await deslizar(-1);
e = await estado();
conferir(
  "3 pra trás: semana passada (13 a 19/9)",
  e.dias.join(",") === "13,14,15,16,17,18,19" &&
    /Semana passada/.test(e.indicador ?? ""),
  e
);
writeFileSync(
  join(DIR, `catraca-4-passada-${LARGURA}-${MODO}-${TEMA}.png`),
  await page.screenshot()
);

await faixa.evaluate((el) => {
  el.scrollTo({ left: (el.clientWidth + 5) * 1.3, behavior: "auto" });
});
await page.waitForTimeout(150);
await faixa.evaluate((el) => {
  el.scrollTo({ left: el.clientWidth + 5, behavior: "smooth" });
});
await page.waitForTimeout(1000);
e = await estado();
conferir(
  "gesto curto que volta: continua na mesma semana",
  e.dias.join(",") === "13,14,15,16,17,18,19",
  e
);

await page.getByRole("button", { name: "Voltar para hoje" }).click();
await page.waitForTimeout(600);
e = await estado();
conferir(
  "voltar para hoje: semana corrente, hoje selecionado, sem indicador",
  e.noMeio &&
    e.dias.join(",") === "20,21,22,23,24,25,26" &&
    e.selecionado === "Dia 23 (hoje)" &&
    !e.voltar,
  e
);
writeFileSync(
  join(DIR, `catraca-5-hoje-${LARGURA}-${MODO}-${TEMA}.png`),
  await page.screenshot()
);

await page.getByRole("button", { name: "Próxima semana" }).click();
await page.waitForTimeout(1200);
e = await estado();
conferir(
  "a seta do painel gira a mesma catraca",
  e.noMeio && e.dias.join(",") === "27,28,29,30,1,2,3",
  e
);

// O relógio congelado (23/09/2026) só vale no navegador: o servidor
// renderiza com a data de hoje e o React avisa a diferença na hidratação.
// Isso acontece em qualquer tela medida com o relógio do mockup, antes
// desta mudança também; qualquer OUTRO erro reprova.
const DO_RELOGIO = [
  "Text content does not match server-rendered HTML.",
  "There was an error while hydrating.",
];
const outros = erros.filter((m) => !DO_RELOGIO.some((d) => m.startsWith(d)));
conferir(
  "sem erro na página (fora o aviso de hidratação do relógio congelado)",
  outros.length === 0,
  { erros: outros }
);
await browser.close();
writeFileSync(
  join(DIR, `catraca-resultado-${LARGURA}-${MODO}-${TEMA}.json`),
  JSON.stringify(
    {
      quando: new Date().toISOString(),
      baseUrl: BASE,
      relogio: HOJE_DO_MOCKUP.toISOString(),
      passos,
    },
    null,
    2
  )
);
if (passos.some((p) => !p.ok)) process.exit(1);
