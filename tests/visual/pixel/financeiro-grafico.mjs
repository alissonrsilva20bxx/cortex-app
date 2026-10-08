// Gráfico de palitos do Financeiro: pixel contra o app de antes da PR de
// pixel, referência nova com o gráfico e o app real (/) com dados mockados.
//
// O mockup normativo do Financeiro A (5-telas-8-temas-claro-escuro.html) não
// tem gráfico. Por decisão do operador o gráfico de palitos volta ao topo,
// logo abaixo dos 4 cards, como estava antes da PR de pixel (4451e1b^). Então:
//   - a faixa ACIMA do gráfico (saldo e 4 cards) se mede contra o mockup com
//     `comparar.mjs --ate='[data-pixel="grafico-palitos"]'`;
//   - o gráfico se mede aqui, contra o app daquele commit (etapa `antes`);
//   - a tela com o gráfico vira a referência das próximas medições
//     (`referencia-com-grafico-*.png`);
//   - o app real (/, o `app/page.tsx`, com sessão e banco mockados na rede)
//     tem que sair pixel a pixel igual ao laboratório (/dev-preview/app): os
//     dois renderizam o MESMO FinanceiroTab.
//
// Etapas (rodar contra um `next dev` já no ar; a ferramenta nunca sobe
// servidor, nunca apaga arquivo e só escreve em <saida>/financeiro/):
//   node tests/visual/pixel/financeiro-grafico.mjs --etapa=antes  --base-url=<app do commit antigo>
//   node tests/visual/pixel/financeiro-grafico.mjs --etapa=depois --base-url=<app desta branch>
//   node tests/visual/pixel/financeiro-grafico.mjs --etapa=tela   --base-url=... --rotulo=antes-palitos
// Opções: --larguras=390,430 --modos=claro,escuro --temas=pink-neon,ocean,gold
//         --saida=docs/jornada/prints/pixel

import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ALTURA, HOJE_DO_MOCKUP, medirPixels } from "./comparar.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PW =
  process.env.PIXEL_PLAYWRIGHT ??
  "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME =
  process.env.PIXEL_CHROME ??
  "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";

const arg = (nome, padrao) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.slice(nome.length + 3) : padrao;
};
const ETAPA = arg("etapa", "depois");
const BASE = arg(
  "base-url",
  process.env.PIXEL_BASE_URL ?? "http://localhost:3103"
);
const LARGURAS = arg("larguras", "390,430").split(",").map(Number);
const MODOS = arg("modos", "claro,escuro").split(",");
const TEMAS = arg("temas", "pink-neon,ocean,gold").split(",");
const ROTULO = arg("rotulo", "antes-palitos");
const DIR = join(
  resolve(ROOT, arg("saida", "docs/jornada/prints/pixel")),
  "financeiro"
);
mkdirSync(DIR, { recursive: true });
if (!["antes", "depois", "tela"].includes(ETAPA)) {
  console.error(
    "financeiro-grafico.mjs: --etapa deve ser antes, depois ou tela"
  );
  process.exit(2);
}

const { chromium } = createRequire(PW)("playwright");
const browser = await chromium.launch({ executablePath: CHROME });
const lona = await (await browser.newContext()).newPage();
await lona.setContent("<!doctype html><title>diff</title>");

/** Mesmo diff do comparar.mjs (pixelmatch YIQ 0,1), com a imagem do diff. */
async function diff(pngA, pngB) {
  return lona.evaluate(
    async ([a, b, fonte]) => {
      const medir = eval(`(${fonte})`);
      const carrega = (d) =>
        new Promise((ok, falha) => {
          const img = new Image();
          img.onload = () => ok(img);
          img.onerror = () => falha(new Error("png ilegível"));
          img.src = `data:image/png;base64,${d}`;
        });
      const [ia, ib] = await Promise.all([carrega(a), carrega(b)]);
      const pinta = (img) => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, img.width, img.height).data;
      };
      const da = pinta(ia);
      const r = medir({
        a: da,
        b: pinta(ib),
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
        const px = (Math.floor(p / r.largura) * ia.width + (p % r.largura)) * 4;
        const cinza = r.mascara[p] ? 0 : (da[px] + da[px + 1] + da[px + 2]) / 3;
        const c = 255 - (255 - cinza) * 0.18;
        img.data[o] = r.mascara[p] ? 255 : c;
        img.data[o + 1] = r.mascara[p] ? 0 : c;
        img.data[o + 2] = r.mascara[p] ? 90 : c;
        img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return {
        difPct: r.difPct,
        diferentes: r.diferentes,
        tamanho: `${r.largura}x${r.altura}`,
        mesmoTamanho: r.mesmoTamanho,
        png: s.toDataURL("image/png").split(",")[1],
      };
    },
    [pngA.toString("base64"), pngB.toString("base64"), medirPixels.toString()]
  );
}

// ---------------------------------------------------------------------------
// App real (/) com um Supabase FALSO local
// ---------------------------------------------------------------------------
//
// O app real passa pelo middleware, que valida a sessão NO SERVIDOR
// (`supabase.auth.getUser()` no Node do next dev) -- isso o navegador não
// intercepta. Então o Supabase inteiro vira um servidor http local, aqui
// dentro, com o "banco" do laboratório (lib/mockAppData.ts), e o `next dev`
// desta medição sobe apontando para ele:
//
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 npx next dev -p 3112
//   node tests/visual/pixel/financeiro-grafico.mjs --etapa=depois --supabase-falso=54399
//
// Nada sai para o Supabase de verdade. Sem `--supabase-falso`, a etapa
// `depois` mede só o laboratório.

const PORTA_FALSO = Number(arg("supabase-falso", "0"));

/** A semente do laboratório (lib/mockAppData.ts) com o relógio do mockup:
 * as datas dela são relativas a `Date.now()`, então o Node congela o mesmo
 * instante que o navegador antes de importá-la. */
async function sementeDoLaboratorio() {
  const agora = Date.now;
  Date.now = () => HOJE_DO_MOCKUP.getTime();
  try {
    const m = await import(
      pathToFileURL(join(ROOT, "lib/mockAppData.ts")).href
    );
    return { seed: m.buildMockAppSeed(), usuario: m.MOCK_APP_USUARIO };
  } finally {
    Date.now = agora;
  }
}

/** PostgREST mínimo: `col=eq.v` (e gte/lte/gt/lt/neq/is), `order` e `limit`
 * -- os filtros que o app usa (`.eq`, `.order`). */
export function consultar(linhas, params) {
  let r = [...linhas];
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset"].includes(k)) continue;
    const ponto = v.indexOf(".");
    const op = v.slice(0, ponto);
    const val = v.slice(ponto + 1);
    const cmp = (x) => (x === null || x === undefined ? null : String(x));
    const f = {
      eq: (x) => cmp(x) === val,
      neq: (x) => cmp(x) !== val,
      gte: (x) => cmp(x) >= val,
      lte: (x) => cmp(x) <= val,
      gt: (x) => cmp(x) > val,
      lt: (x) => cmp(x) < val,
      is: (x) =>
        val === "null" ? x === null || x === undefined : String(x) === val,
    }[op];
    if (f) r = r.filter((l) => f(l[k]));
  }
  const ordem = params.get("order");
  if (ordem)
    for (const parte of ordem.split(",").reverse()) {
      const [col, dir] = parte.split(".");
      const s = dir === "desc" ? -1 : 1;
      r.sort((a, b) => (a[col] > b[col] ? s : a[col] < b[col] ? -s : 0));
    }
  const lim = params.get("limit");
  if (lim) r = r.slice(0, Number(lim));
  return r;
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

async function subirSupabaseFalso(porta) {
  const { seed, usuario } = await sementeDoLaboratorio();
  const user = {
    id: usuario.id,
    aud: "authenticated",
    role: "authenticated",
    email: usuario.email,
    user_metadata: { full_name: usuario.nome },
    app_metadata: { provider: "email" },
    created_at: "2026-01-01T00:00:00Z",
  };
  const pedidos = [];
  const servidor = createServer((req, res) => {
    const u = new URL(req.url, `http://127.0.0.1:${porta}`);
    pedidos.push(`${req.method} ${u.pathname}`);
    const json = (body, status = 200) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "*",
        "access-control-expose-headers": "*",
      });
      res.end(JSON.stringify(body));
    };
    if (req.method === "OPTIONS") return json({}, 200);
    if (u.pathname === "/auth/v1/user") return json(user);
    const tabela = u.pathname.match(/^\/rest\/v1\/([^/]+)$/)?.[1];
    if (tabela && req.method === "GET") {
      const linhas = consultar(seed.tables[tabela] ?? [], u.searchParams);
      if ((req.headers.accept ?? "").includes("vnd.pgrst.object"))
        return linhas.length === 1
          ? json(linhas[0])
          : json(
              {
                code: "PGRST116",
                message: "0 rows",
                details: null,
                hint: null,
              },
              406
            );
      return json(linhas);
    }
    // URL assinada do storage (fotos do feed da Rede): o formato do
    // Supabase, com um endereço que não aponta para lugar nenhum.
    if (
      u.pathname.startsWith("/storage/v1/object/sign/") &&
      req.method === "POST"
    ) {
      let corpo = "";
      req.on("data", (c) => (corpo += c));
      req.on("end", () => {
        let pedido = {};
        try {
          pedido = JSON.parse(corpo || "{}");
        } catch {}
        const assinar = (path) => ({
          path,
          signedURL: `/object/sign/falso/${path}?token=falso`,
          error: null,
        });
        json(
          Array.isArray(pedido.paths)
            ? pedido.paths.map(assinar)
            : { signedURL: assinar("arquivo").signedURL }
        );
      });
      return;
    }
    // RPC devolve lista vazia (as da Rede listam conversas, feed etc.);
    // escrita e storage não são usadas pela tela do Financeiro.
    req.resume();
    if (u.pathname.startsWith("/rest/v1/rpc/")) return json([]);
    return json(req.method === "GET" ? [] : {}, 200);
  });
  await new Promise((ok) => servidor.listen(porta, "127.0.0.1", ok));
  return { servidor, user, pedidos };
}

/** A sessão no cookie que o @supabase/ssr lê (`sb-<ref>-auth-token`, valor
 * `base64-<json>`), com o `ref` do host falso (`127`). */
async function sessaoDoAppReal(ctx, user) {
  const exp = Math.floor(HOJE_DO_MOCKUP.getTime() / 1000) + 365 * 86400;
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, exp, role: "authenticated", aud: "authenticated" })}.assinatura`;
  await ctx.addCookies([
    {
      name: "sb-127-auth-token",
      value: `base64-${b64({
        access_token: token,
        token_type: "bearer",
        expires_in: 365 * 86400,
        expires_at: exp,
        refresh_token: "refresh-falso",
        user,
      })}`,
      url: BASE,
    },
  ]);
}

const falso = PORTA_FALSO ? await subirSupabaseFalso(PORTA_FALSO) : null;

// ---------------------------------------------------------------------------
// Navegação (a mesma receita do comparar.mjs)
// ---------------------------------------------------------------------------

async function abrir({ largura, modo, tema, real }) {
  const MODO_CSS = modo === "claro" ? "light" : "dark";
  const ctx = await browser.newContext({
    viewport: { width: largura, height: ALTURA[largura] },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  await ctx.addInitScript(
    ([t, m, uid]) => {
      try {
        localStorage.setItem("jobapp-theme", t);
        localStorage.setItem("jobapp-mode", m);
        localStorage.setItem("jobapp-recap-last-shown", "2026-09");
        // App real: conta já apresentada (sem onboarding nem tour por cima).
        localStorage.setItem(`jobapp-onboarding-done:${uid}`, "1");
        localStorage.setItem(`jobapp-tour-done:${uid}`, "1");
      } catch {}
    },
    [tema, MODO_CSS, "mock-app-user"]
  );
  // App real: as rotas /api do próprio app ficam vivas (elas falam com o
  // Supabase falso pelo servidor); o laboratório continua sem backend.
  if (!real) await ctx.route("**/api/**", (r) => r.abort());
  if (real) await sessaoDoAppReal(ctx, falso.user);
  else await ctx.route(/supabase\.co/, (r) => r.abort());
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message.split("\n")[0]));
  await page.clock.setFixedTime(HOJE_DO_MOCKUP);
  await page.goto(`${BASE}${real ? "/" : "/dev-preview/app"}`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important;pointer-events:none!important}",
  });
  // Onboarding, tour e recap: o que aparecer por cima da tela é dispensado
  // como uma pessoa faria, antes de ir para a aba.
  for (const nome of [
    "Continuar no meu ritmo",
    "Pular",
    "Agora não",
    "Fechar",
  ]) {
    const b = page.getByRole("button", { name: nome, exact: true }).first();
    if (await b.isVisible().catch(() => false)) {
      await b.click();
      await page.waitForTimeout(400);
    }
  }
  const mostrar = page.getByRole("button", { name: /Mostrar abas/ });
  if (await mostrar.isVisible().catch(() => false)) await mostrar.click();
  try {
    await page
      .getByRole("button", { name: "Financeiro", exact: true })
      .first()
      .click();
  } catch (e) {
    const prova = join(
      DIR,
      `falha-${real ? "app-real" : "laboratorio"}-${largura}-${modo}-${tema}.png`
    );
    writeFileSync(prova, await page.screenshot());
    throw new Error(
      `aba Financeiro não apareceu (${real ? "/" : "/dev-preview/app"}); tela em ${prova}; erros: ${erros.join(" | ")}`,
      { cause: e }
    );
  }
  await page
    .getByText("Resumo financeiro", { exact: true })
    .first()
    .waitFor({ timeout: 60000 });
  await page.waitForTimeout(900);
  await page.evaluate(
    ([t, m]) => {
      const h = document.documentElement;
      h.setAttribute("data-theme", t);
      if (m === "light") h.setAttribute("data-mode", "light");
      else h.removeAttribute("data-mode");
      for (const forte of document.querySelectorAll("strong"))
        if (
          forte.textContent?.trim() === "Sessão de teste local indisponível."
        ) {
          const caixa = forte.closest("div");
          if (caixa) caixa.style.display = "none";
        }
      window.scrollTo(0, 0);
    },
    [tema, MODO_CSS]
  );
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
  await page.waitForTimeout(400);
  return { ctx, page, erros };
}

/** O card do gráfico: o FinCard que contém "Resumo financeiro" -- a mesma
 * âncora no commit antigo e nesta branch. */
const cardDoGrafico = (page) =>
  page
    .getByText("Resumo financeiro", { exact: true })
    .first()
    .locator("xpath=ancestor::div[2]");

// ---------------------------------------------------------------------------

const linhas = [];
for (const largura of LARGURAS)
  for (const modo of MODOS)
    for (const tema of TEMAS) {
      const sufixo = `${tema}-${modo}-${largura}`;
      if (ETAPA === "antes") {
        const lab = await abrir({ largura, modo, tema, real: false });
        writeFileSync(
          join(DIR, `grafico-antes-${sufixo}.png`),
          await cardDoGrafico(lab.page).screenshot()
        );
        linhas.push({ sufixo, erros: lab.erros.length });
        await lab.ctx.close();
        continue;
      }
      if (ETAPA === "tela") {
        const lab = await abrir({ largura, modo, tema, real: false });
        // A tela inteira, rolagem incluída. O app rola num contêiner interno
        // e as folhas fechadas ficam `fixed` logo abaixo da tela: o
        // `fullPage` cru as pintava por cima. Então: as folhas fora da tela
        // somem e o contêiner de rolagem se desenrola.
        await lab.page.evaluate(() => {
          const alto = window.innerHeight;
          for (const el of document.querySelectorAll("body *")) {
            const cs = getComputedStyle(el);
            if (
              cs.position === "fixed" &&
              el.getBoundingClientRect().top >= alto - 1
            )
              el.style.display = "none";
          }
          for (const el of document.querySelectorAll("body *")) {
            const cs = getComputedStyle(el);
            if (
              /(auto|scroll)/.test(cs.overflowY) &&
              el.scrollHeight > el.clientHeight + 1
            ) {
              el.style.overflowY = "visible";
              el.style.height = "auto";
              el.style.maxHeight = "none";
            }
          }
          document.documentElement.style.height = "auto";
          document.body.style.height = "auto";
        });
        await lab.page.waitForTimeout(300);
        writeFileSync(
          join(DIR, `${ROTULO}-${sufixo}.png`),
          await lab.page.screenshot({ fullPage: true })
        );
        linhas.push({ sufixo });
        await lab.ctx.close();
        continue;
      }
      const lab = await abrir({ largura, modo, tema, real: false });
      const grafico = await cardDoGrafico(lab.page).screenshot();
      const telaLab = await lab.page.screenshot();
      writeFileSync(join(DIR, `grafico-depois-${sufixo}.png`), grafico);
      writeFileSync(join(DIR, `referencia-com-grafico-${sufixo}.png`), telaLab);
      const r = { sufixo, errosLab: lab.erros };
      const antes = join(DIR, `grafico-antes-${sufixo}.png`);
      if (existsSync(antes)) {
        const d = await diff(readFileSync(antes), grafico);
        writeFileSync(
          join(DIR, `grafico-diff-${sufixo}.png`),
          Buffer.from(d.png, "base64")
        );
        r.graficoVsAntes = {
          difPct: d.difPct,
          tamanho: d.tamanho,
          mesmoTamanho: d.mesmoTamanho,
        };
      }
      await lab.ctx.close();

      if (!falso) {
        linhas.push(r);
        console.log(
          `${sufixo.padEnd(22)} gráfico × commit antigo ${String(r.graficoVsAntes?.difPct ?? "-").padStart(6)}%   (app real: sem --supabase-falso)`
        );
        continue;
      }
      const real = await abrir({ largura, modo, tema, real: true });
      const telaReal = await real.page.screenshot();
      writeFileSync(join(DIR, `app-real-${sufixo}.png`), telaReal);
      const d2 = await diff(telaLab, telaReal);
      writeFileSync(
        join(DIR, `app-real-diff-${sufixo}.png`),
        Buffer.from(d2.png, "base64")
      );
      r.appRealVsLaboratorio = {
        difPct: d2.difPct,
        tamanho: d2.tamanho,
        mesmoTamanho: d2.mesmoTamanho,
      };
      r.errosAppReal = real.erros;
      r.pedidosAoSupabaseFalso = [...new Set(falso.pedidos)].sort();
      await real.ctx.close();
      linhas.push(r);
      console.log(
        `${sufixo.padEnd(22)} gráfico × commit antigo ${String(r.graficoVsAntes?.difPct ?? "-").padStart(6)}%   app real × laboratório ${String(d2.difPct).padStart(6)}%`
      );
    }

await browser.close();
if (falso) falso.servidor.close();
writeFileSync(
  join(DIR, `grafico-resumo-${ETAPA}.json`),
  JSON.stringify(
    {
      quando: new Date().toISOString(),
      etapa: ETAPA,
      baseUrl: BASE,
      metrica: "pixelmatch YIQ, limiar 0.1",
      relogio: HOJE_DO_MOCKUP.toISOString(),
      linhas,
    },
    null,
    2
  )
);
if (ETAPA !== "depois")
  console.log(`${ETAPA}: ${linhas.length} capturas em ${DIR}`);
