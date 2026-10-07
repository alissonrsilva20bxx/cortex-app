// Pixel da "Sua Jornada": protótipo aprovado × app, estado a estado.
//
// Referência normativa: docs/jornada/referencias/prototipo-sua-jornada.html
// (a tela da Jornada, os resumos e as comemorações). O protótipo é um app em
// miniatura (JS próprio, 8 temas, claro/escuro, 390/430); o app é o
// /dev-preview/app com o laboratório da Jornada (lib/mockJornada.ts).
//
// Uso (precisa de um `next dev` no ar; a ferramenta nunca sobe servidor):
//   node tests/visual/pixel/jornada.mjs --estado=tela
//   node tests/visual/pixel/jornada.mjs --estado=tela,semana,mes --temas=todos
//   node tests/visual/pixel/jornada.mjs --estado=selo --largura=430 --modo=escuro
//
//   --estado=tela|semana|mes|ano|selo|estagio|meta   (lista com vírgula)
//   --temas=todos | --tema=pink-neon                  (padrão pink-neon)
//   --largura=390|430|ambas   (padrão ambas)
//   --modo=claro|escuro|ambos (padrão ambos)
//   --base-url=http://localhost:3103
//   --saida=docs/jornada/prints/pixel/jornada        (prefixo: --fase=antes)
//   --fase=antes|depois (padrão depois)
//
// O que mede:
//   - "tela": o conteúdo INTEIRO da tela (sem a altura do celular cortando),
//     e cada seção dela, pareadas pela ordem;
//   - os demais estados: o celular inteiro (390×844 / 430×932).
// A métrica é a do pixelmatch (YIQ, limiar 0,1), o mesmo `medirPixels` do
// comparar.mjs. Os estilos computados de cada texto saem num .md ao lado.
//
// O dia: o protótipo desenha sexta, 02/10/2026 (a foto "Agora", 305 Glow).
// O relógio do app fica congelado nesse instante.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  COLETAR,
  PROPS,
  TEMAS,
  comparar,
  medirPixels,
  relatorioDeEstilos,
} from "./comparar.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
const PW =
  process.env.PIXEL_PLAYWRIGHT ??
  "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME =
  process.env.PIXEL_CHROME ??
  "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";

export const HOJE_DO_PROTOTIPO = new Date(2026, 9, 2, 10, 0, 0);
/** O resumo do ano usa a foto "Mês 14" do protótipo (03/12/2027): o
 * laboratório tem a mesma usuária em `?jornada=ano`. */
const HOJE_DO_ANO = new Date(2027, 11, 3, 10, 0, 0);
export const ESTADOS = [
  "tela",
  "semana",
  "mes",
  "ano",
  "selo",
  "estagio",
  "meta",
];
const ALTURA = { 390: 844, 430: 932 };

const arg = (nome, padrao) => {
  const a = process.argv.find((x) => x.startsWith(`--${nome}=`));
  return a ? a.slice(nome.length + 3) : padrao;
};

/** Esconde o que é só da página do protótipo e solta o celular em 1:1. */
const SOLTAR_PROTOTIPO = `
  .ph{position:relative!important;left:0!important;top:0!important;transform:none!important;
      border-radius:0!important;box-shadow:none!important}
  #fx,#toast,.phcap{display:none!important}
`;
/** Para a tela inteira: o celular cresce com o conteúdo da Jornada. */
const TELA_INTEIRA_PROTOTIPO = `
  .ph{height:auto!important;overflow:visible!important}
  #sJourney{position:relative!important;inset:auto!important;transform:none!important;
            overflow:visible!important;height:auto!important;box-shadow:none!important}
  #sHome,#sRede,#bar{display:none!important}
`;
const TELA_INTEIRA_APP = `
  html,body{height:auto!important;overflow:visible!important}
  [data-jornada-tela]{position:relative!important;inset:auto!important;overflow:visible!important}
  body > *:not(:has([data-jornada-tela])){display:none!important}
`;
const SO_DO_LABORATORIO = `nextjs-portal{display:none!important}`;

/**
 * Congela a tela no estado FINAL, igual dos dois lados: as animações finitas
 * vão pro fim (`finish`: os "forwards" do protótipo — a medalha carimbada,
 * as letras do estágio — ficam visíveis) e as infinitas (pulso do estágio,
 * brilho dos selos, raios) param no instante 0. Desligar as animações com
 * `animation:none` apagaria o que só aparece no fim delas.
 */
async function congelar(page) {
  await page.evaluate(async () => {
    for (const a of document.getAnimations()) {
      const t = a.effect?.getComputedTiming?.();
      if (!t || t.iterations === Infinity) {
        a.currentTime = 0;
        a.pause();
      } else {
        try {
          a.finish();
        } catch {
          a.pause();
        }
      }
    }
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    );
  });
}

async function principal() {
  const estados = arg("estado", "tela").split(",");
  for (const e of estados)
    if (!ESTADOS.includes(e)) throw new Error(`estado desconhecido: ${e}`);
  const temas = arg("temas") === "todos" ? TEMAS : [arg("tema", "pink-neon")];
  const larguras =
    arg("largura", "ambas") === "ambas" ? [390, 430] : [Number(arg("largura"))];
  const modos =
    arg("modo", "ambos") === "ambos" ? ["claro", "escuro"] : [arg("modo")];
  const baseUrl = arg("base-url", "http://localhost:3103");
  const fase = arg("fase", "depois");
  const saida = resolve(
    ROOT,
    arg("saida", "docs/jornada/prints/pixel/jornada")
  );
  mkdirSync(saida, { recursive: true });

  const { chromium } = createRequire(PW)("playwright");
  const browser = await chromium.launch({
    executablePath: CHROME,
    // O mockup e o app têm de rasterizar o texto igual (sem subpixel LCD).
    args: ["--disable-lcd-text"],
  });
  const lona = await (await browser.newContext()).newPage();
  await lona.setContent("<!doctype html><title>diff</title>");

  const linhas = [];
  for (const estado of estados)
    for (const tema of temas)
      for (const modo of modos)
        for (const largura of larguras) {
          const nome = `${estado}-${largura}-${modo}-${tema}`;
          const tentar = async (f) => {
            for (let k = 1; ; k++) {
              try {
                return await f();
              } catch (e) {
                if (k >= 3) throw e;
                console.log(
                  `  ${nome}: nova tentativa (${e.message.split("\n")[0]})`
                );
              }
            }
          };
          const proto = await tentar(() =>
            capturarPrototipo(browser, { estado, tema, modo, largura })
          );
          const app = await tentar(() =>
            capturarApp(browser, baseUrl, { estado, tema, modo, largura })
          );
          writeFileSync(
            join(saida, `${fase}-${nome}-prototipo.png`),
            proto.png
          );
          writeFileSync(join(saida, `${fase}-${nome}-app.png`), app.png);
          const d = await diff(lona, proto.png, app.png);
          writeFileSync(join(saida, `${fase}-${nome}-diff.png`), d.png);
          const cmp = comparar(proto.estilos, app.estilos, proto.estilos.area);
          writeFileSync(
            join(saida, `${fase}-${nome}-estilos.md`),
            relatorioDeEstilos(nome, cmp, {
              mockup: "prototipo-sua-jornada.html",
              app: `${baseUrl}/dev-preview/app`,
            })
          );
          // Seção a seção (só na tela): pareadas pela ordem.
          const secoes = [];
          if (estado === "tela") {
            // Pareadas pelo nome (o título de cada seção); a que só existe
            // de um lado aparece como "só no protótipo" / "só no app".
            for (const sp of proto.secoes) {
              const sa = app.secoes.find((x) => x.nome === sp.nome);
              if (!sa) {
                secoes.push(`${sp.nome}=só-no-protótipo`);
                continue;
              }
              const ds = await diff(lona, proto.png, app.png, sp, sa);
              secoes.push(`${sp.nome}=${ds.difPct.toFixed(2)}%`);
            }
            for (const sa of app.secoes)
              if (!proto.secoes.some((x) => x.nome === sa.nome))
                secoes.push(`${sa.nome}=só-no-app`);
          }
          const l = [
            estado,
            tema,
            modo,
            largura,
            `${d.difPct.toFixed(2)}%`,
            cmp.comDivergencia,
            secoes.join(" "),
          ].join("\t");
          linhas.push(l);
          console.log(l);
        }
  writeFileSync(
    join(saida, `${fase}.tsv`),
    "estado\ttema\tmodo\tlargura\tdiff\testilos_divergentes\tsecoes\n" +
      linhas.join("\n") +
      "\n"
  );
  await browser.close();
}

// ---------------------------------------------------------------------------
// Protótipo
// ---------------------------------------------------------------------------

const PROTOTIPO = pathToFileURL(
  join(ROOT, "docs/jornada/referencias/prototipo-sua-jornada.html")
).href;

async function capturarPrototipo(browser, { estado, tema, modo, largura }) {
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 1200 },
    deviceScaleFactor: 1,
  });
  await ctx.addInitScript(
    ([tm, md, w]) => {
      try {
        localStorage.setItem(
          "jornada-proto-prefs",
          JSON.stringify({ tm, md, w })
        );
      } catch {}
      // Partículas e sons usam Math.random: fixa a semente pra o print
      // sair igual a cada rodada (o canvas de faíscas fica escondido).
      let s = 42;
      Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    },
    [tema, modo === "claro" ? "light" : "dark", largura]
  );
  const page = await ctx.newPage();
  await page.goto(PROTOTIPO, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  const fonte = await page.evaluate(() =>
    document.fonts.check('800 30px "Plus Jakarta Sans"')
  );
  if (!fonte) throw new Error("a Plus Jakarta Sans do protótipo não carregou");
  // Abertura (splash) e o card da Jornada no Início leva pra tela.
  await page.waitForTimeout(2600);
  await page.evaluate(() => document.getElementById("splash")?.remove());
  await page.click("[data-go=journey]");
  await page.waitForTimeout(700);

  if (estado === "tela") {
    await page.addStyleTag({
      content: SOLTAR_PROTOTIPO + TELA_INTEIRA_PROTOTIPO,
    });
  } else {
    await acionarPrototipo(page, estado);
    await page.addStyleTag({ content: SOLTAR_PROTOTIPO });
  }
  await congelar(page);
  const el = page.locator("#ph");
  const png = await el.screenshot({ timeout: 120000 });
  const estilos = await page.evaluate(COLETAR, ["#ph", PROPS]);
  const secoes =
    estado === "tela"
      ? await page.evaluate(() => {
          const base = document.getElementById("ph").getBoundingClientRect();
          return [...document.getElementById("journey").children].map(
            (s, i) => {
              const r = s.getBoundingClientRect();
              const t =
                s
                  .querySelector("h1,h3,.h-stage,.recap-btn")
                  ?.textContent?.trim() ?? `s${i}`;
              return {
                nome: t.slice(0, 18).replace(/\s+/g, "_"),
                x: r.left - base.left,
                y: r.top - base.top,
                w: r.width,
                h: r.height,
              };
            }
          );
        })
      : [];
  await ctx.close();
  return { png, estilos, secoes };
}

/**
 * Dispara o estado no protótipo pelos próprios controles dele e espera o
 * estado FINAL da comemoração (as classes que a linha do tempo dele põe):
 *  - selo: "Guardar numa meta" → aviso pequeno → selo "Rumo à meta"
 *    (#ovBadge.on.go), por cima da tela da Jornada;
 *  - estagio: volta pro Início, planeja e sobe pra Organizada (#ovStage.p5);
 *  - meta: volta pro Início, guarda o que falta → selo (Continuar) → "Meta
 *    concluída" (#ovStage.p5);
 *  - semana / mes / ano: o resumo em stories (#ovRecap.on).
 */
async function acionarPrototipo(page, estado) {
  const esperar = (sel) => page.waitForSelector(sel, { timeout: 20000 });
  if (estado === "semana") {
    await page.click("#journey [data-recap=week]");
    await esperar("#ovRecap.on");
  } else if (estado === "mes" || estado === "ano") {
    await page.click(
      `.side [data-tm="${estado === "mes" ? "month" : "year"}"]`
    );
    await esperar("#ovRecap.on");
  } else if (estado === "selo") {
    await page.click('.side [data-demo="badge"]');
    await esperar("#ovBadge.on.go");
  } else if (estado === "estagio") {
    await page.click('.side [data-demo="stage"]');
    await esperar("#ovStage.p5");
  } else if (estado === "meta") {
    await page.click('.side [data-tm="goal"]');
    await esperar("#ovBadge.on.go");
    await page.waitForTimeout(1200);
    await page.click("#bOk");
    await esperar("#ovStage.p5");
  }
  // Deixa as entradas (fade, letras, faíscas) assentarem.
  await page.waitForTimeout(1600);
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

async function capturarApp(browser, baseUrl, { estado, tema, modo, largura }) {
  const ctx = await browser.newContext({
    viewport: { width: largura, height: ALTURA[largura] },
    deviceScaleFactor: 1,
  });
  const md = modo === "claro" ? "light" : "dark";
  await ctx.addInitScript(
    ([t, m, recap]) => {
      try {
        localStorage.setItem("jobapp-theme", t);
        localStorage.setItem("jobapp-mode", m);
        // O recap do mês (do Financeiro) já visto: não cobre a tela.
        localStorage.setItem("jobapp-recap-last-shown", recap);
        localStorage.setItem(
          "jobapp-install-banner-snoozed-until",
          String(Date.now() + 864e8)
        );
      } catch {}
      let s = 42;
      Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    },
    [tema, md, estado === "ano" ? "2027-12" : "2026-10"]
  );
  await ctx.route("**/api/**", (r) => r.abort());
  await ctx.route(/supabase\.co/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.clock.setFixedTime(
    estado === "ano" ? HOJE_DO_ANO : HOJE_DO_PROTOTIPO
  );
  await page.goto(
    `${baseUrl}/dev-preview/app${estado === "ano" ? "?jornada=ano" : ""}`,
    {
      waitUntil: "networkidle",
      timeout: 180000,
    }
  );
  // O ThemeProvider do app pode reaplicar o tema salvo depois da carga:
  // o tema da medição é imposto de novo logo antes do recorte.
  const forcarTema = () =>
    page.evaluate(
      ([t, m]) => {
        const h = document.documentElement;
        h.setAttribute("data-theme", t);
        if (m === "light") h.setAttribute("data-mode", "light");
        else h.removeAttribute("data-mode");
      },
      [tema, md]
    );
  await forcarTema();
  await page.addStyleTag({ content: SO_DO_LABORATORIO });
  await page
    .getByRole("button", { name: /Jornada/ })
    .first()
    .click();
  await page.locator("[data-jornada-tela]").waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);

  let alvo = page.locator("[data-jornada-tela]");
  if (estado === "tela") {
    await page.addStyleTag({ content: TELA_INTEIRA_APP });
    // Só a tela da Jornada na página: o resto do app (a barra, o "+"
    // fixos) apareceria por cima do recorte alto da tela inteira.
    await page.evaluate(() => {
      let el = document.querySelector("[data-jornada-tela]");
      while (el && el !== document.body) {
        for (const irmao of el.parentElement?.children ?? [])
          if (irmao !== el)
            irmao.style.setProperty("display", "none", "important");
        el = el.parentElement;
      }
    });
  } else {
    await acionarApp(page, estado);
    alvo = page.locator("body");
  }
  await forcarTema();
  await page.evaluate(() => document.fonts.ready);
  await congelar(page);
  const png =
    estado === "tela"
      ? await alvo.screenshot({ timeout: 120000 })
      : await page.screenshot({ timeout: 120000 });
  const estilos = await page.evaluate(COLETAR, [
    estado === "tela" ? "[data-jornada-tela]" : "body",
    PROPS,
  ]);
  const secoes =
    estado === "tela"
      ? await page.evaluate(() => {
          const raiz = document.querySelector("[data-jornada-tela]");
          const base = raiz.getBoundingClientRect();
          const corpo =
            raiz.querySelector("[data-jornada-corpo]") ??
            raiz.firstElementChild;
          return [...corpo.children].map((s, i) => {
            const r = s.getBoundingClientRect();
            const t =
              s
                .querySelector(
                  'h1,h2,h3,[class*="h-stage"],[class*="recap-btn"]'
                )
                ?.textContent?.trim() ??
              (s.matches('[class*="recap-btn"]')
                ? s.textContent.trim()
                : `s${i}`);
            return {
              nome: t.slice(0, 18).replace(/\s+/g, "_"),
              x: r.left - base.left,
              y: r.top - base.top,
              w: r.width,
              h: r.height,
            };
          });
        })
      : [];
  await ctx.close();
  return { png, estilos, secoes };
}

/** Dispara o estado no app: resumos pelos botões da tela; comemorações pelo
 * laboratório (`__previewComemoracao`), com o mesmo fundo do protótipo: o
 * selo por cima da Jornada, estágio e meta por cima do Início. */
async function acionarApp(page, estado) {
  if (["semana", "mes", "ano"].includes(estado)) {
    const rotulo = { semana: "Semana", mes: "Mês", ano: "Ano" }[estado];
    // Botão (protótipo: abre o resumo) ou aba (o app de antes).
    await page
      .locator("[data-jornada-tela]")
      .locator("button, [role=tab]")
      .filter({ hasText: new RegExp(`^\\s*${rotulo}\\s*$`) })
      .first()
      .click();
  } else {
    if (estado !== "selo") await page.keyboard.press("Escape");
    await page.evaluate((demo) => window.__previewComemoracao(demo), estado);
  }
  await page.waitForTimeout(
    estado === "estagio" || estado === "meta" ? 4500 : 3000
  );
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

/** Mede (e pinta) o diff no navegador com o MESMO medirPixels do comparar.mjs.
 * Com `ra`/`rb`, compara só esses retângulos (seção a seção). */
async function diff(page, pngA, pngB, ra = null, rb = null) {
  const r = await page.evaluate(
    async ([a, b, ra, rb, fonte]) => {
      const medir = eval(`(${fonte})`);
      const carrega = (dados) =>
        new Promise((ok, falha) => {
          const img = new Image();
          img.onload = () => ok(img);
          img.onerror = () => falha(new Error("png ilegível"));
          img.src = `data:image/png;base64,${dados}`;
        });
      const [ia, ib] = await Promise.all([carrega(a), carrega(b)]);
      const recorte = (img, r) => {
        const x = r ? Math.round(r.x) : 0;
        const y = r ? Math.round(r.y) : 0;
        const w = r ? Math.round(r.w) : img.width;
        const h = r ? Math.round(r.h) : img.height;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        return { dados: ctx.getImageData(0, 0, w, h).data, w, h };
      };
      const A = recorte(ia, ra);
      const B = recorte(ib, rb);
      const m = medir({
        a: A.dados,
        b: B.dados,
        larguraA: A.w,
        alturaA: A.h,
        larguraB: B.w,
        alturaB: B.h,
        limiar: 0.1,
      });
      const saida = document.createElement("canvas");
      saida.width = m.largura;
      saida.height = m.altura;
      const ctx = saida.getContext("2d");
      const img = ctx.createImageData(m.largura, m.altura);
      for (let p = 0; p < m.largura * m.altura; p++) {
        const o = p * 4;
        const px = p % m.largura;
        const py = Math.floor(p / m.largura);
        if (m.mascara[p]) {
          img.data[o] = 255;
          img.data[o + 1] = 0;
          img.data[o + 2] = 90;
        } else {
          const io = (py * A.w + px) * 4;
          const cinza =
            px < A.w && py < A.h
              ? (A.dados[io] + A.dados[io + 1] + A.dados[io + 2]) / 3
              : 255;
          const c = 255 - (255 - cinza) * 0.18;
          img.data[o] = c;
          img.data[o + 1] = c;
          img.data[o + 2] = c;
        }
        img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return {
        difPct: m.difPct,
        png: saida.toDataURL("image/png").split(",")[1],
      };
    },
    [
      pngA.toString("base64"),
      pngB.toString("base64"),
      ra,
      rb,
      medirPixels.toString(),
    ]
  );
  return { difPct: r.difPct, png: Buffer.from(r.png, "base64") };
}

const eDireto =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (eDireto) await principal();
