// Rede · feed com 3 abas e fotos no formato do Instagram (proposta "Três
// abas"; proporções confirmadas em feed-proporcoes.html).
//
// Roda contra um `next dev` já no ar (/dev-preview/app, relógio do mockup).
// Nunca sobe servidor, nunca apaga nada e só escreve em <saida>/rede-feed/:
//   node tests/visual/pixel/rede-feed.mjs --base-url=http://localhost:3103
// Opções: --larguras=390,430 --modos=claro,escuro --temas=todos|pink-neon
//         --saida=docs/jornada/prints/pixel
//
// Confere, e falha (código 1) se algo não bater:
//  1. as medidas em pixels de cada formato, na largura da tela, em todos os
//     temas pedidos: 4:5 = 390×488 / 430×538, 1:1 = 390×390 / 430×430,
//     16:9 = 390×219 / 430×242, 1,91:1 = 390×204 / 430×225;
//  2. sem a fileira de amigas estilo stories; as 3 abas no lugar;
//  3. o carrossel: contador 1/N, setas (somem nas pontas), bolinhas, teclado
//     e o dedo (toque de verdade, pelo protocolo do Chrome);
//  4. as abas: Amigas só com amigas e você, o número de novas e a divisão
//     "Novas desde a sua última visita" / "Já visto"; Descobrir com pessoas
//     (Adicionar → Pedido enviado) e as dicas da semana;
//  5. as funções de antes: curtir, comentar, opções, perfil da autora,
//     busca e a tela de Amigas.
// Prints (só no tema pink-neon): cada aba, o carrossel, e a foto que
// aparece inteira com o fundo desfocado.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ALTURA, HOJE_DO_MOCKUP, TEMAS } from "./comparar.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const arg = (nome, padrao) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.slice(nome.length + 3) : padrao;
};
const BASE = arg(
  "base-url",
  process.env.PIXEL_BASE_URL ?? "http://localhost:3103"
);
const LARGURAS = arg("larguras", "390,430").split(",").map(Number);
const MODOS = arg("modos", "claro,escuro").split(",");
const TEMAS_PEDIDOS =
  arg("temas", "todos") === "todos" ? TEMAS : arg("temas", "").split(",");
const DIR = join(
  resolve(ROOT, arg("saida", "docs/jornada/prints/pixel")),
  "rede-feed"
);
mkdirSync(DIR, { recursive: true });
const PW =
  process.env.PIXEL_PLAYWRIGHT ??
  "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME =
  process.env.PIXEL_CHROME ??
  "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const { chromium } = createRequire(PW)("playwright");

/** Altura esperada de cada formato: largura ÷ proporção, arredondada. */
const ESPERADO = {
  "4:5": (w) => Math.round(w / (4 / 5)),
  "1:1": (w) => w,
  "16:9": (w) => Math.round(w / (16 / 9)),
  "1,91:1": (w) => Math.round(w / 1.91),
};
// A última visita à aba Amigas: antes dela, "já visto"; depois, "novas".
const VISITA = new Date(
  HOJE_DO_MOCKUP.getTime() - 20 * 3_600_000
).toISOString();

const browser = await chromium.launch({ executablePath: CHROME });
const passos = [];
const conferir = (nome, ok, dados = {}) => {
  passos.push({ nome, ok: !!ok, ...dados });
  console.log(
    `${ok ? "ok   " : "FALHA"} ${nome}${Object.keys(dados).length ? "  " + JSON.stringify(dados) : ""}`
  );
};

async function abrir({ largura, modo, tema, visita = null }) {
  const MODO_CSS = modo === "claro" ? "light" : "dark";
  const ctx = await browser.newContext({
    viewport: { width: largura, height: ALTURA[largura] },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await ctx.addInitScript(
    ([t, m, v]) => {
      try {
        localStorage.setItem("jobapp-theme", t);
        localStorage.setItem("jobapp-mode", m);
        localStorage.setItem("jobapp-recap-last-shown", "2026-09");
        if (v) localStorage.setItem("rede:amigas-visita:mock-app-user", v);
      } catch {}
    },
    [tema, MODO_CSS, visita]
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
  await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important;pointer-events:none!important}",
  });
  const recap = page.getByRole("button", { name: "Continuar no meu ritmo" });
  if (await recap.isVisible().catch(() => false)) await recap.click();
  const mostrar = page.getByRole("button", { name: /Mostrar abas/ });
  if (await mostrar.isVisible().catch(() => false)) await mostrar.click();
  await page.getByRole("button", { name: "Rede", exact: true }).first().click();
  await page.locator("[data-abas-feed]").waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(
    ([t, m]) => {
      const h = document.documentElement;
      h.setAttribute("data-theme", t);
      if (m === "light") h.setAttribute("data-mode", "light");
      else h.removeAttribute("data-mode");
      for (const f of document.querySelectorAll("strong"))
        if (f.textContent?.trim() === "Sessão de teste local indisponível.") {
          const c = f.closest("div");
          if (c) c.style.display = "none";
        }
    },
    [tema, MODO_CSS]
  );
  await page.waitForTimeout(300);
  return { ctx, page, erros };
}

const medirFormatos = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-formato]")].map((e) => {
      const r = e.getBoundingClientRect();
      return {
        post: e.closest("[data-post]")?.getAttribute("data-post"),
        formato: e.getAttribute("data-formato"),
        w: r.width,
        h: r.height,
        encaixes: [...e.querySelectorAll("[data-encaixe]")].map((x) =>
          x.getAttribute("data-encaixe")
        ),
      };
    })
  );

const nome = (largura, modo, tema, o) => `${o}-${largura}-${modo}-${tema}.png`;
const DO_RELOGIO = [
  "Text content does not match server-rendered HTML.",
  "There was an error while hydrating.",
];

// ── 1. medidas em pixels, todos os temas ───────────────────────────────
for (const largura of LARGURAS)
  for (const modo of MODOS)
    for (const tema of TEMAS_PEDIDOS) {
      const { ctx, page } = await abrir({ largura, modo, tema });
      const m = await medirFormatos(page);
      const ruins = m.filter(
        (x) => x.w !== largura || x.h !== ESPERADO[x.formato](largura)
      );
      const vistos = [...new Set(m.map((x) => x.formato))].sort().join(" ");
      conferir(
        `medidas ${largura} ${modo} ${tema}: ${m.length} fotos (${vistos}), largura ${largura} e altura exata`,
        m.length >= 5 &&
          ruins.length === 0 &&
          ["1,91:1", "16:9", "1:1", "4:5"].every((f) => vistos.includes(f)),
        ruins.length ? { ruins } : {}
      );
      if (tema === "pink-neon")
        writeFileSync(
          join(DIR, nome(largura, modo, tema, "para-voce")),
          await page.screenshot()
        );
      await ctx.close();
    }

// ── 2-5. comportamento, em pink-neon (390 e 430, claro e escuro) ───────
for (const largura of LARGURAS)
  for (const modo of MODOS) {
    const tema = "pink-neon";
    const { ctx, page, erros } = await abrir({
      largura,
      modo,
      tema,
      visita: VISITA,
    });
    const rot = `${largura} ${modo}`;

    // 2. stories fora, 3 abas
    const topo = await page.evaluate(() => ({
      abas: [...document.querySelectorAll("[data-abas-feed] [role=tab]")].map(
        (t) => t.textContent.replace(/\d+$/, "").trim()
      ),
      postar: [...document.querySelectorAll("button")].some(
        (b) => b.textContent.trim() === "Postar"
      ),
      fileira: [...document.querySelectorAll("span")].some(
        (s) => s.style.width === "62px" && s.style.height === "62px"
      ),
      presa: document
        .querySelector("[data-abas-feed]")
        .hasAttribute("data-presa"),
    }));
    conferir(
      `${rot}: sem a fileira de stories, as 3 abas no lugar (soltas no topo da tela)`,
      !topo.postar &&
        !topo.fileira &&
        topo.abas.join("|") === "Para você|Amigas|Descobrir" &&
        !topo.presa,
      topo
    );

    // 3. carrossel (post-4: antes/depois)
    const car = page.locator('[data-post="rede-post-4"] [data-carrossel]');
    await car.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const estadoCar = () =>
      car.evaluate((el) => ({
        contador: el.querySelector("[data-contador]")?.textContent,
        anterior: !!el.querySelector('[aria-label="Foto anterior"]'),
        proxima: !!el.querySelector('[aria-label="Próxima foto"]'),
        bolinha: [
          ...el.parentElement.querySelectorAll("[data-bolinhas] span"),
        ].findIndex((s) => s.style.transform.includes("1.15")),
      }));
    let e = await estadoCar();
    conferir(
      `${rot}: carrossel começa em 1/2, só a seta de avançar, 1ª bolinha`,
      e.contador === "1/2" && !e.anterior && e.proxima && e.bolinha === 0,
      e
    );
    const presas = await page.evaluate(() => {
      const t = document.querySelector("[data-abas-feed]");
      const r = t.getBoundingClientRect();
      return {
        presa: t.hasAttribute("data-presa"),
        top: r.top,
        largura: r.width,
        rolagem: Math.round(window.scrollY),
      };
    });
    conferir(
      `${rot}: rolando, as abas ficam presas no topo`,
      presas.presa &&
        presas.top === 0 &&
        presas.largura === largura &&
        presas.rolagem > 300,
      presas
    );
    writeFileSync(
      join(DIR, nome(largura, modo, tema, "carrossel-1")),
      await page.screenshot()
    );
    await car.getByRole("button", { name: "Próxima foto" }).click();
    await page.waitForTimeout(900);
    e = await estadoCar();
    conferir(
      `${rot}: seta avança para 2/2, troca as setas e a bolinha`,
      e.contador === "2/2" && e.anterior && !e.proxima && e.bolinha === 1,
      e
    );
    writeFileSync(
      join(DIR, nome(largura, modo, tema, "carrossel-2")),
      await page.screenshot()
    );
    await car.locator(".feed-foto-scroller").focus();
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(900);
    e = await estadoCar();
    conferir(`${rot}: teclado (←) volta para 1/2`, e.contador === "1/2", e);
    const caixa = await car.boundingBox();
    const cdp = await ctx.newCDPSession(page);
    const y = caixa.y + caixa.height / 2;
    // Começa fora da seta (ela fica por cima da foto, à direita).
    const x0 = Math.round(largura * 0.7);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: x0, y }],
    });
    for (let i = 1; i <= 12; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x0 - ((x0 - 30) * i) / 12, y }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(1200);
    e = await estadoCar();
    const abaDepois = await page.evaluate(
      () =>
        !!document.querySelector("[data-abas-feed]")?.getBoundingClientRect()
          .width
    );
    conferir(
      `${rot}: o dedo desliza para 2/2 e continua na Rede`,
      e.contador === "2/2" && abaDepois,
      e
    );

    // foto de outra proporção no carrossel: inteira, com o fundo desfocado
    const misto = page.locator('[data-post="rede-post-8"] [data-carrossel]');
    await misto.scrollIntoViewIfNeeded();
    await misto.getByRole("button", { name: "Próxima foto" }).click();
    await page.waitForTimeout(900);
    const mistoEstado = await misto.evaluate((el) => ({
      formato: el.getAttribute("data-formato"),
      encaixes: [...el.querySelectorAll("[data-encaixe]")].map((x) =>
        x.getAttribute("data-encaixe")
      ),
      fundo: el.querySelectorAll("[data-fundo-desfocado]").length,
    }));
    conferir(
      `${rot}: carrossel 1:1 com uma 16:9 → a 16:9 inteira, com fundo desfocado`,
      mistoEstado.formato === "1:1" &&
        mistoEstado.encaixes.join() === "cortar,inteira" &&
        mistoEstado.fundo === 1,
      mistoEstado
    );
    writeFileSync(
      join(DIR, nome(largura, modo, tema, "foto-inteira-desfocada")),
      await page.screenshot()
    );

    // 5. funções de antes, no Para você
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const soltas = await page.evaluate(
      () =>
        !document.querySelector("[data-abas-feed]").hasAttribute("data-presa")
    );
    conferir(`${rot}: de volta ao topo, as abas voltam ao lugar`, soltas);
    const p1 = page.locator('[data-post="rede-post-1"]');
    await p1.scrollIntoViewIfNeeded();
    const curtidas = async () =>
      (await p1.getByRole("button", { name: "Curtir" }).innerText()).trim();
    const antes = await curtidas();
    await p1.getByRole("button", { name: "Curtir" }).click();
    await page.waitForTimeout(600);
    const depois = await curtidas();
    conferir(
      `${rot}: curtir soma 1 e pinta o coração`,
      Number(depois) === Number(antes) + 1 &&
        (await p1
          .getByRole("button", { name: "Curtir" })
          .getAttribute("aria-pressed")) === "true",
      { antes, depois }
    );
    await p1.getByRole("button", { name: "Curtir" }).click();
    await page.waitForTimeout(400);
    await p1.getByRole("button", { name: "Comentar" }).click();
    await page.waitForTimeout(800);
    conferir(
      `${rot}: comentar abre os comentários`,
      await page.getByText("Comentários", { exact: true }).first().isVisible()
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    // Folhas fechadas continuam no DOM: conta as visíveis antes e depois.
    const folhasAntes = await page.locator("[role=dialog]:visible").count();
    await p1.getByRole("button", { name: "Mais opções" }).click();
    await page.waitForTimeout(800);
    const folhasDepois = await page.locator("[role=dialog]:visible").count();
    conferir(
      `${rot}: "Mais opções" abre a folha de opções`,
      folhasDepois === folhasAntes + 1,
      { folhasAntes, folhasDepois }
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);

    // 4. Amigas
    const abaAmigas = page.locator("[data-abas-feed] [role=tab]").nth(1);
    const numero = (await abaAmigas.innerText()).replace(/\D/g, "");
    conferir(
      `${rot}: a aba Amigas mostra o número de novas desde a última visita`,
      Number(numero) > 0,
      { numero }
    );
    await abaAmigas.click();
    await page.waitForTimeout(900);
    const am = await page.evaluate(() => ({
      autores: [
        ...new Set(
          [...document.querySelectorAll("[data-post]")].map(
            (a) => a.querySelector("button.truncate")?.textContent
          )
        ),
      ],
      divisores: [...document.querySelectorAll("[role=separator]")].map((d) =>
        d.textContent.trim()
      ),
      numero: document.querySelectorAll("[data-abas-feed] [role=tab] em")
        .length,
    }));
    conferir(
      `${rot}: Amigas só com amigas e você, dividida em novas e já vistas, sem o número aberta`,
      am.autores.every((n) => ["Miguel", "Marina", "Juliana"].includes(n)) &&
        am.divisores.join("|") === "Novas desde a sua última visita|Já visto" &&
        am.numero === 0,
      am
    );
    writeFileSync(
      join(DIR, nome(largura, modo, tema, "amigas")),
      await page.screenshot()
    );

    // 4. Descobrir
    await page.locator("[data-abas-feed] [role=tab]").nth(2).click();
    await page.waitForTimeout(900);
    const ds = await page.evaluate(() => ({
      titulos: [...document.querySelectorAll("[data-tab-panel=rede] h2, h2")]
        .filter((h) => h.getBoundingClientRect().width > 0)
        .map((h) => h.textContent.trim()),
      pessoas: [...document.querySelectorAll("button")].filter(
        (b) => b.textContent.trim() === "Adicionar"
      ).length,
      dicas: [...document.querySelectorAll("[data-post]")].length,
    }));
    conferir(
      `${rot}: Descobrir com pessoas para conhecer e as dicas da semana`,
      ds.titulos.includes("Pessoas para conhecer") &&
        ds.titulos.includes("Dicas mais curtidas da semana") &&
        ds.pessoas >= 2 &&
        ds.dicas >= 1,
      ds
    );
    writeFileSync(
      join(DIR, nome(largura, modo, tema, "descobrir")),
      await page.screenshot()
    );
    await page.getByRole("button", { name: "Adicionar" }).first().click();
    await page.waitForTimeout(900);
    conferir(
      `${rot}: Adicionar envia o pedido ("Pedido enviado")`,
      await page
        .getByRole("button", { name: "Pedido enviado" })
        .first()
        .isVisible()
    );

    // 5. cabeçalho: busca e Amigas; perfil da autora
    await page.getByRole("button", { name: "Buscar" }).first().click();
    await page.waitForTimeout(800);
    conferir(
      `${rot}: a busca abre`,
      await page.getByText("Buscar", { exact: true }).first().isVisible()
    );
    await page.goBack().catch(() => {});
    await page.keyboard.press("Escape");
    await ctx.close();

    const s2 = await abrir({ largura, modo, tema });
    await s2.page
      .getByRole("button", { name: "Amigas, solicitações e descobrir pessoas" })
      .click();
    await s2.page.waitForTimeout(900);
    conferir(
      `${rot}: o ícone de pessoas abre a tela de Amigas`,
      await s2.page.getByText("Amigas", { exact: true }).first().isVisible()
    );
    await s2.ctx.close();
    const s3 = await abrir({ largura, modo, tema });
    await s3.page.locator('[data-post="rede-post-4"] button.truncate').click();
    await s3.page.waitForTimeout(900);
    conferir(
      `${rot}: tocar no nome abre o perfil da autora`,
      await s3.page.getByText("Perfil", { exact: true }).first().isVisible()
    );
    await s3.ctx.close();

    const outros = erros.filter(
      (m) => !DO_RELOGIO.some((d) => m.startsWith(d))
    );
    conferir(
      `${rot}: sem erro na página (fora o aviso de hidratação do relógio congelado)`,
      outros.length === 0,
      { outros }
    );
  }

await browser.close();
writeFileSync(
  join(DIR, "resultado.json"),
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
const falhas = passos.filter((p) => !p.ok).length;
console.log(`\n${passos.length - falhas}/${passos.length} ok`);
if (falhas) process.exit(1);
