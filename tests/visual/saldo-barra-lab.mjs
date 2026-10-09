// Barra "entrou x saiu" do Saldo do mês no laboratório: os 4 estados
// (com dados, zerado, só entradas, só saídas) em 390 e 430, claro e escuro.
// Mede a trilha e os segmentos e salva os prints em
// docs/jornada/prints/saldo-barra/. Precisa de um `next dev` no ar.
// Uso: node tests/visual/saldo-barra-lab.mjs [baseUrl]
// Ambiente: PIXEL_PLAYWRIGHT (pasta com node_modules/playwright) e
// PIXEL_CHROME, os mesmos do tests/visual/pixel/comparar.mjs.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(
  (process.env.PIXEL_PLAYWRIGHT ?? process.cwd()) + "/"
)("playwright");
const BASE = process.argv[2] ?? "http://localhost:3103";
const SAIDA = "docs/jornada/prints/saldo-barra";
mkdirSync(SAIDA, { recursive: true });
const CASOS = {
  dados: "",
  vazio: "vazio",
  "so-entradas": "so-entradas",
  "so-saidas": "so-saidas",
};
const browser = await chromium.launch({
  executablePath: process.env.PIXEL_CHROME,
  args: ["--disable-lcd-text"],
});
let falhas = 0;
const ok = (n, c, x) => {
  if (!c) falhas++;
  console.log(
    `${c ? "PASSA" : "FALHA"} ${n}${c ? "" : " " + JSON.stringify(x)}`
  );
};
const medidas = {};
for (const largura of [390, 430])
  for (const modo of ["light", "dark"])
    for (const [nome, param] of Object.entries(CASOS)) {
      const ctx = await browser.newContext({
        viewport: { width: largura, height: 900 },
        deviceScaleFactor: 2,
        hasTouch: true,
      });
      await ctx.addInitScript((m) => {
        try {
          localStorage.setItem("jobapp-theme", "pink-neon");
          localStorage.setItem("jobapp-mode", m);
          localStorage.setItem("jobapp-recap-last-shown", "2026-09");
        } catch {}
      }, modo);
      await ctx.route("**/api/**", (r) => r.abort());
      await ctx.route(/supabase\.co/, (r) => r.abort());
      const page = await ctx.newPage();
      const erros = [];
      // O relógio congelado (23/09/2026, prints estáveis) só vale no
      // navegador: o servidor renderiza com a data real e a hidratação
      // diverge nos textos de data. Sem o relógio, zero erros de página.
      page.on("pageerror", (e) => {
        const msg = e.message.split("\n")[0];
        if (!/server-rendered HTML|while hydrating/.test(msg)) erros.push(msg);
      });
      await page.clock.setFixedTime(new Date(2026, 8, 23, 10, 0, 0));
      await page.goto(
        `${BASE}/dev-preview/app${param ? `?financeiro=${param}` : ""}`,
        { waitUntil: "networkidle", timeout: 180000 }
      );
      await page.addStyleTag({
        content:
          "nextjs-portal{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important}",
      });
      const recap = page.getByRole("button", {
        name: "Continuar no meu ritmo",
      });
      if (await recap.isVisible().catch(() => false)) await recap.click();
      const mostrar = page.getByRole("button", { name: /Mostrar abas/ });
      if (await mostrar.isVisible().catch(() => false)) await mostrar.click();
      await page
        .getByRole("button", { name: "Financeiro", exact: true })
        .first()
        .click();
      const barra = page.locator("[data-saldo-barra]").first();
      await barra.waitFor({ state: "visible", timeout: 15000 });
      await page.waitForTimeout(500);
      const m = await barra.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          estado: el.getAttribute("data-saldo-barra"),
          x: Math.round(r.x),
          w: Math.round(r.width),
          h: Math.round(r.height),
          fundo: cs.backgroundColor,
          raio: cs.borderRadius,
          segs: [...el.children].map((s) => ({
            w: Math.round(s.getBoundingClientRect().width),
            cor: getComputedStyle(s).backgroundColor,
          })),
          verde: getComputedStyle(document.documentElement)
            .getPropertyValue("--t-green")
            .trim(),
          vermelho: getComputedStyle(document.documentElement)
            .getPropertyValue("--t-red")
            .trim(),
        };
      });
      const id = `${nome}-${largura}-${modo === "light" ? "claro" : "escuro"}`;
      medidas[id] = m;
      await barra.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/${id}.png` });
      ok(`${id} sem erro de página`, erros.length === 0, erros);
      ok(
        `${id} trilha 8px de altura, raio 4px`,
        m.h === 8 && m.raio === "4px",
        m
      );
      if (nome === "vazio")
        ok(
          `${id} zerado: trilha cinza vazia (sem segmentos, fundo visível)`,
          m.estado === "vazia" &&
            m.segs.length === 0 &&
            m.fundo !== "rgba(0, 0, 0, 0)",
          m
        );
      if (nome === "so-entradas")
        ok(
          `${id} só entradas: 1 segmento verde inteiro`,
          m.estado === "movimento" &&
            m.segs.length === 1 &&
            m.segs[0].w === m.w,
          m
        );
      if (nome === "so-saidas")
        ok(
          `${id} só saídas: 1 segmento vermelho inteiro`,
          m.estado === "movimento" &&
            m.segs.length === 1 &&
            m.segs[0].w === m.w,
          m
        );
      if (nome === "dados")
        ok(
          `${id} com dados: verde + vermelho`,
          m.estado === "movimento" && m.segs.length === 2,
          m
        );
      await ctx.close();
    }
// Mesma posição e largura em todos os estados da mesma tela.
for (const largura of [390, 430])
  for (const modo of ["claro", "escuro"]) {
    const ms = Object.keys(CASOS).map(
      (c) => medidas[`${c}-${largura}-${modo}`]
    );
    ok(
      `${largura} ${modo}: mesma posição e largura nos 4 estados`,
      ms.every((m) => m.x === ms[0].x && m.w === ms[0].w),
      ms.map((m) => [m.x, m.w])
    );
    const so = (c) => medidas[`${c}-${largura}-${modo}`].segs[0].cor;
    ok(
      `${largura} ${modo}: só entradas é verde, só saídas é vermelho (cores diferentes)`,
      so("so-entradas") !== so("so-saidas") &&
        so("so-entradas") === medidas[`dados-${largura}-${modo}`].segs[0].cor &&
        so("so-saidas") === medidas[`dados-${largura}-${modo}`].segs[1].cor,
      [so("so-entradas"), so("so-saidas")]
    );
  }
console.log(JSON.stringify(medidas["dados-390-claro"]));
console.log(JSON.stringify(medidas["vazio-390-escuro"]));
await browser.close();
console.log(falhas ? `${falhas} falha(s)` : "barra do saldo: tudo certo");
process.exit(falhas ? 1 : 0);
