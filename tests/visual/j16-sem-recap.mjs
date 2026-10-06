// J16 (#166) — carregado ANTES do `j07-matriz.mjs` pra rodar o J07 de novo
// sem editar o script dele:
//
//   node --import ./tests/visual/j16-sem-recap.mjs tests/visual/j07-matriz.mjs
//
// O recap do mês (RecapSheet) abre sozinho, às vezes depois que o J07 já
// conferiu se ele estava na tela, e aí fica por cima do Início e trava os
// cliques nas abas. Aqui cada navegador novo começa com o recap do mês atual
// já visto (a mesma chave que o RecapSheet grava quando ela fecha), como
// quem já abriu o app este mês. Nada mais muda.

import { createRequire } from "node:module";

const PW =
  process.env.J07_PLAYWRIGHT ??
  "C:/Users/miguel/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/";
const { chromium } = createRequire(PW)("playwright");

const lancar = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await lancar(...args);
  const novoContexto = browser.newContext.bind(browser);
  browser.newContext = async (...a) => {
    const ctx = await novoContexto(...a);
    await ctx.addInitScript(() => {
      try {
        const d = new Date();
        localStorage.setItem(
          "jobapp-recap-last-shown",
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        );
      } catch {}
    });
    return ctx;
  };
  return browser;
};
