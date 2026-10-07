// Script de apoio (temporário): imprime y/altura dos textos dos dois lados.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const PW = "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME = "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const { chromium } = createRequire(PW)("playwright");
const tela = process.argv[2] ?? "cofre";
const NAV = { inicio:"Início", agenda:"Agenda", financeiro:"Financeiro", cofre:"Cofre", rede:"Rede" };
const HOJE = new Date(2026, 8, 23, 10, 0, 0);
const COLETA = ([sel]) => {
  const raiz = document.querySelector(sel);
  const base = raiz.getBoundingClientRect();
  const out = [];
  const anda = (el) => {
    const r = el.getBoundingClientRect();
    const t = [...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.replace(/\s+/g," ").trim()).join(" ").trim();
    if (t && r.height >= 1) out.push([t.slice(0,34), Math.round((r.top-base.top)*10)/10, Math.round(r.height*10)/10, Math.round(r.width)]);
    for (const c of el.children) anda(c);
  };
  anda(raiz);
  return out;
};
const b = await chromium.launch({ executablePath: CHROME });
// mockup
const c1 = await b.newContext({ viewport:{width:900,height:1100}, deviceScaleFactor:1 });
const p1 = await c1.newPage();
await p1.goto(pathToFileURL("C:/Users/miguel/JobApp-W3/docs/jornada/referencias/5-telas-8-temas-claro-escuro.html").href, {waitUntil:"networkidle"});
await p1.evaluate(() => document.fonts.ready);
// O mockup abre com zoom de 62% (--s). Sem fixar em 1, TODA medida sai
// multiplicada por 0,62 e a comparação não vale nada.
await p1.evaluate(() => document.documentElement.style.setProperty("--s", "1"));
await p1.waitForTimeout(200);
const M = await p1.evaluate(COLETA, [`#view-um .ph[data-t="${tela}"][data-md="light"]`]);
// app
const c2 = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:1, hasTouch:true });
await c2.addInitScript(() => { try { localStorage.setItem("jobapp-theme","pink-neon"); localStorage.setItem("jobapp-mode","light"); localStorage.setItem("jobapp-recap-last-shown","2026-09"); } catch {} });
await c2.route("**/api/**", r=>r.abort());
await c2.route(/supabase\.co/, r=>r.abort());
const p2 = await c2.newPage();
await p2.clock.setFixedTime(HOJE);
await p2.goto("http://localhost:3107/dev-preview/app", {waitUntil:"networkidle", timeout:180000});
await p2.addStyleTag({content:"nextjs-portal{display:none!important}"});
const m = p2.getByRole("button",{name:/Mostrar abas/}); if (await m.isVisible().catch(()=>false)) await m.click();
await p2.getByRole("button",{name:NAV[tela], exact:true}).first().click();
await p2.waitForTimeout(1200);
await p2.evaluate(()=>window.scrollTo(0,0));
const A = await p2.evaluate(COLETA, ["body"]);
const mapa = new Map();
for (const [t,y,h,w] of A) if (!mapa.has(t)) mapa.set(t,[y,h,w]);
console.log("texto".padEnd(36), "mock_y  mock_h mock_w |  app_y   app_h  app_w | dy");
for (const [t,y,h,w] of M) {
  const a = mapa.get(t);
  const dy = a ? (a[0]-y).toFixed(1) : "-";
  console.log(t.padEnd(36), String(y).padStart(6), String(h).padStart(6), String(w).padStart(6), "|",
    a?String(a[0]).padStart(6):"   ---", a?String(a[1]).padStart(6):"  ---", a?String(a[2]).padStart(6):"  ---", "|", String(dy).padStart(6));
}
console.log("\n--- textos do app sem par no mockup ---");
const mset = new Set(M.map(([t])=>t));
for (const [t,y] of A) if (!mset.has(t) && y < 900) console.log(String(y).padStart(7), t);
await b.close();
