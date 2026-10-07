import { createRequire } from "node:module";
const PW = "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const CHROME = "C:/Users/miguel/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const { chromium } = createRequire(PW)("playwright");
const b = await chromium.launch({ executablePath: CHROME });
const c = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:1, hasTouch:true });
await c.addInitScript(() => { try { localStorage.setItem("jobapp-theme","pink-neon"); localStorage.setItem("jobapp-mode","light"); localStorage.setItem("jobapp-recap-last-shown","2026-09"); } catch {} });
await c.route("**/api/**", r=>r.abort()); await c.route(/supabase\.co/, r=>r.abort());
const p = await c.newPage();
await p.clock.setFixedTime(new Date(2026, 8, 23, 10, 0, 0));
await p.goto("http://localhost:3107/dev-preview/app", {waitUntil:"networkidle", timeout:180000});
const m = p.getByRole("button",{name:/Mostrar abas/}); if (await m.isVisible().catch(()=>false)) await m.click();
await p.getByRole("button",{name:"Cofre", exact:true}).first().click();
await p.waitForTimeout(1200);
console.log(await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("div,span,p,h1,h2,a")) {
    const t = [...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join("");
    if (t.trim()) out.push(JSON.stringify(t));
  }
  return out.slice(0, 26).join("\n");
}));
await b.close();
