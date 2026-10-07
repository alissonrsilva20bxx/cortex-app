// Comparação de pixel entre o mockup normativo e o app de verdade.
//
// A referência é docs/jornada/referencias/5-telas-8-temas-claro-escuro.html
// (as 5 telas, 8 temas, claro e escuro). O app vem do laboratório
// (/dev-preview/app) servido por um `next dev` que JÁ esteja no ar -- esta
// ferramenta nunca sobe servidor e nunca instala nada.
//
// Para cada combinação (tela × largura × modo × tema) ela produz:
//   <tela>-<largura>-<modo>-<tema>-mockup.png   recorte do mockup
//   ...-app.png                                 o mesmo recorte do app
//   ...-diff.png                                o que difere, em vermelho
//   ...-estilos.md                              estilo computado lado a lado
//   ...-resultado.json                          tudo em número
//
// MÉTRICA: a do pixelmatch -- distância YIQ com limiar 0,1 (o padrão da
// biblioteca), a mesma que os harnesses das telas usam. Assim os números
// desta ferramenta são comparáveis com os deles. `--limiar` muda o valor.
//
// ESTILOS: cada linha é um elemento que existe nos dois lados, com as
// propriedades que divergem, ordenadas por `impacto`:
//     impacto = (soma das diferenças normalizadas) × raiz(área relativa)
// Uma diferença grande num elemento grande sobe; uma mínima num elemento
// minúsculo desce. O divisor de cada propriedade está em `GRAVIDADE`, e
// nenhuma passa de `TETO_POR_PROPRIEDADE` -- senão um `border-radius:
// 9999px` contra `0px` engoliria o ranking inteiro.
//
// Uso:
//   node tests/visual/pixel/comparar.mjs --tela=cofre
//   node tests/visual/pixel/comparar.mjs --telas=todas --largura=390 --modo=claro
//
// Opções (todas com padrão):
//   --tela=inicio|agenda|financeiro|cofre|rede   (ou --telas=todas)
//   --largura=390|430        padrão 390 (o mockup é desenhado em 390)
//   --modo=claro|escuro      padrão claro
//   --tema=<um dos 8>        padrão pink-neon
//   --base-url=...           padrão http://localhost:3103
//   --saida=...              padrão docs/jornada/prints/pixel
//   --limiar=0.1             limiar do pixelmatch (0 a 1)
//   --inteira                compara o conteúdo rolável inteiro, não só a 1ª dobra
//   --so-pixel               pula o dump de estilos (bem mais rápido)
//   --sem-jornada            no Início, esconde o card "Sua Jornada" (o mockup
//                            das 5 telas não tem esse card)
//   --json                   imprime só o JSON no stdout
//
// Ambiente: PIXEL_PLAYWRIGHT, PIXEL_CHROME e PIXEL_BASE_URL sobrescrevem os
// caminhos (Playwright do cache do npx, Chromium do ms-playwright).
//
// As funções puras daqui são testadas em comparar.test.mjs.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");

/** Quarta, 23/09/2026 10h -- o "hoje" que o mockup desenha. */
export const HOJE_DO_MOCKUP = new Date(2026, 8, 23, 10, 0, 0);

export const TELAS = {
  inicio: { nav: "Início", layout: "A" },
  agenda: { nav: "Agenda", layout: "C" },
  financeiro: { nav: "Financeiro", layout: "A" },
  cofre: { nav: "Cofre", layout: "C" },
  rede: { nav: "Rede", layout: "E" },
};
export const TEMAS = [
  "pink-neon",
  "purple",
  "crimson",
  "ocean",
  "gold",
  "emerald",
  "midnight",
  "grafite",
];
export const ALTURA = { 390: 844, 430: 932 };
/** O mockup é desenhado em 390×844; 430 é reflow aproximado (ver README). */
export const LARGURA_DO_MOCKUP = 390;

// ---------------------------------------------------------------------------
// Métrica de pixel: a do pixelmatch (YIQ, limiar 0,1)
// ---------------------------------------------------------------------------

/**
 * Conta os pixels que diferem, com a métrica de cor do pixelmatch: distância
 * YIQ contra `35215 × limiar²`. As constantes são as da biblioteca.
 *
 * Quando as imagens têm tamanhos diferentes, a área comparada é a união: o
 * que existe só de um lado conta como diferente (é o caso de uma tela que
 * ficou mais alta que a outra).
 *
 * `a` e `b` são RGBA achatado (4 bytes por pixel). Devolve a contagem e uma
 * máscara de 1 byte por pixel (1 = difere), para quem quiser pintar o diff.
 */
export function medirPixels({
  a,
  b,
  larguraA,
  alturaA,
  larguraB,
  alturaB,
  limiar = 0.1,
}) {
  const largura = Math.max(larguraA, larguraB);
  const altura = Math.max(alturaA, alturaB);
  const maxDelta = 35215 * limiar * limiar;
  const mascara = new Uint8Array(largura * altura);
  let diferentes = 0;

  const y = (r, g, b2) => r * 0.29889531 + g * 0.58662247 + b2 * 0.11448223;
  const i = (r, g, b2) => r * 0.59597799 - g * 0.2741761 - b2 * 0.32180189;
  const q = (r, g, b2) => r * 0.21147017 - g * 0.52261711 + b2 * 0.31114694;

  for (let py = 0; py < altura; py++) {
    for (let px = 0; px < largura; px++) {
      const fora =
        px >= larguraA || py >= alturaA || px >= larguraB || py >= alturaB;
      if (fora) {
        mascara[py * largura + px] = 1;
        diferentes++;
        continue;
      }
      const ia = (py * larguraA + px) * 4;
      const ib = (py * larguraB + px) * 4;
      const dy =
        y(a[ia], a[ia + 1], a[ia + 2]) - y(b[ib], b[ib + 1], b[ib + 2]);
      const di =
        i(a[ia], a[ia + 1], a[ia + 2]) - i(b[ib], b[ib + 1], b[ib + 2]);
      const dq =
        q(a[ia], a[ia + 1], a[ia + 2]) - q(b[ib], b[ib + 1], b[ib + 2]);
      const delta = 0.5053 * dy * dy + 0.299 * di * di + 0.1957 * dq * dq;
      if (delta > maxDelta) {
        mascara[py * largura + px] = 1;
        diferentes++;
      }
    }
  }
  const pixels = largura * altura;
  return {
    largura,
    altura,
    pixels,
    diferentes,
    difPct: Math.round((diferentes / pixels) * 1e6) / 1e4,
    mesmoTamanho: larguraA === larguraB && alturaA === alturaB,
    mascara,
  };
}

/**
 * Geometria do recorte do mockup, em pixels INTEIROS.
 *
 * O `.ph` fica no meio de uma página rolável, então depois de posicioná-lo a
 * caixa dele cai quase sempre numa coordenada fracionária (ex.: y = 212,5).
 * O recorte por elemento arredonda essa caixa para fora e devolve **1px a
 * mais** de altura -- o mockup saía 780×1690 onde o app saía 780×1688, e aí
 * toda linha abaixo do primeiro pixel ficava deslocada e a união de tamanhos
 * contava uma faixa inteira como diferente.
 *
 * Por isso a posição é truncada para inteiro e o tamanho é IMPOSTO: a altura
 * e a largura vêm do que a tela deve ter, não do que a caixa mediu.
 */
export function clipDoRecorte({ caixa, largura, altura }) {
  return {
    x: Math.floor(caixa.x),
    y: Math.floor(caixa.y),
    width: largura,
    height: altura,
  };
}

// ---------------------------------------------------------------------------
// Estilo: o que medimos e quanto cada diferença pesa
// ---------------------------------------------------------------------------

/**
 * Peso de cada propriedade, para o `impacto` ficar comparável entre coisas
 * de naturezas diferentes. O divisor é "quanto de diferença equivale a 1":
 * fontSize tem divisor 1, então 3px valem 3; cor tem 60, então uma distância
 * RGB de 60 vale 1.
 */
export const GRAVIDADE = {
  fontFamily: { tipo: "texto", peso: 4 },
  fontSize: { tipo: "px", divisor: 1 },
  fontWeight: { tipo: "num", divisor: 100 },
  letterSpacing: { tipo: "px", divisor: 0.5 },
  lineHeight: { tipo: "px", divisor: 2 },
  textTransform: { tipo: "texto", peso: 1.5 },
  color: { tipo: "cor", divisor: 60 },
  backgroundColor: { tipo: "cor", divisor: 60 },
  borderRadius: { tipo: "px", divisor: 3 },
  padding: { tipo: "px", divisor: 4 },
  gap: { tipo: "px", divisor: 4 },
  largura: { tipo: "px", divisor: 6 },
  altura: { tipo: "px", divisor: 6 },
  boxShadow: { tipo: "texto", peso: 1 },
};

export const PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "color",
  "backgroundColor",
  "borderRadius",
  "padding",
  "gap",
  "boxShadow",
];

/** Nenhuma propriedade sozinha vale mais que isto no impacto. */
export const TETO_POR_PROPRIEDADE = 10;

/** "R$ 430" e "R$ 150" viram a mesma chave: o dado do laboratório difere. */
export const chaveDeTexto = (t) =>
  t.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

const px = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export function corEmRgb(v) {
  const m = String(v).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1]
    .split(/[,/\s]+/)
    .filter(Boolean)
    .map(Number);
  if (p.length < 3 || p.some((n) => !Number.isFinite(n))) return null;
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}

/**
 * Família só pelo primeiro nome, sem aspas -- é o que muda a letra. O
 * next/font gera nomes como `__plus_jakarta_sans_a11773`: normalizamos para
 * `plus jakarta sans`, senão a MESMA fonte apareceria como divergência em
 * todo elemento da tela.
 */
export const familia = (v) => {
  let n = String(v).split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
  if (n.startsWith("__")) n = n.slice(2).replace(/_[0-9a-f]{4,}$/i, "");
  return n.replace(/_/g, " ").trim();
};

export function diferenca(prop, a, b) {
  const bruta = diferencaBruta(prop, a, b);
  if (!bruta) return null;
  return { ...bruta, peso: Math.min(bruta.peso, TETO_POR_PROPRIEDADE) };
}

function diferencaBruta(prop, a, b) {
  const g = GRAVIDADE[prop];
  if (!g) return null;
  if (g.tipo === "cor") {
    const ca = corEmRgb(a);
    const cb = corEmRgb(b);
    if (!ca || !cb) return a === b ? null : { peso: g.peso ?? 1, a, b };
    // Transparente dos dois lados não é divergência de cor.
    if (ca.a < 0.02 && cb.a < 0.02) return null;
    const d =
      Math.hypot(ca.r - cb.r, ca.g - cb.g, ca.b - cb.b) +
      Math.abs(ca.a - cb.a) * 120;
    return d < 2 ? null : { peso: d / g.divisor, a, b };
  }
  if (g.tipo === "px") {
    // Raio "de pílula" (999, 9999) é o mesmo desenho: achatamos em 999 para
    // não comparar números inventados entre si.
    const achata = (n) =>
      prop === "borderRadius" && n !== null && n > 900 ? 999 : n;
    const na = achata(px(a));
    const nb = achata(px(b));
    if (na === null || nb === null) return a === b ? null : { peso: 1, a, b };
    const d = Math.abs(na - nb);
    return d < 0.5 ? null : { peso: d / g.divisor, a, b };
  }
  if (g.tipo === "num") {
    const d = Math.abs(Number(a) - Number(b));
    return d < 1 ? null : { peso: d / g.divisor, a, b };
  }
  if (prop === "fontFamily") {
    return familia(a) === familia(b)
      ? null
      : { peso: g.peso, a: familia(a), b: familia(b) };
  }
  return String(a) === String(b) ? null : { peso: g.peso ?? 1, a, b };
}

/**
 * Pareia os elementos dos dois lados: primeiro pelo texto próprio (com os
 * números mascarados), depois, entre os que sobraram, pela geometria (centro
 * mais perto, tamanho parecido). Devolve os pares e o que ficou sem par.
 */
export function parear(mock, app) {
  const pares = [];
  const usadosApp = new Set();

  const porTexto = new Map();
  app.forEach((el, i) => {
    if (!el.texto) return;
    const k = chaveDeTexto(el.texto);
    if (!porTexto.has(k)) porTexto.set(k, []);
    porTexto.get(k).push(i);
  });

  const sobraMock = [];
  for (const m of mock) {
    if (!m.texto) {
      sobraMock.push(m);
      continue;
    }
    const cands = porTexto.get(chaveDeTexto(m.texto)) ?? [];
    let melhor = null;
    for (const i of cands) {
      if (usadosApp.has(i)) continue;
      const d = Math.abs(app[i].y - m.y) + Math.abs(app[i].x - m.x) * 0.5;
      if (!melhor || d < melhor.d) melhor = { i, d };
    }
    if (melhor) {
      usadosApp.add(melhor.i);
      pares.push({ mock: m, app: app[melhor.i], como: "texto" });
    } else sobraMock.push(m);
  }

  // Geometria, só para caixas (sem texto próprio) de tamanho parecido.
  for (const m of sobraMock) {
    let melhor = null;
    for (let i = 0; i < app.length; i++) {
      if (usadosApp.has(i) || app[i].texto) continue;
      const a = app[i];
      const dTam =
        Math.abs(a.largura - m.largura) / Math.max(m.largura, 1) +
        Math.abs(a.altura - m.altura) / Math.max(m.altura, 1);
      if (dTam > 0.35) continue;
      const d = Math.hypot(a.x - m.x, a.y - m.y);
      if (d > 40) continue;
      if (!melhor || d < melhor.d) melhor = { i, d };
    }
    if (melhor) {
      usadosApp.add(melhor.i);
      pares.push({ mock: m, app: app[melhor.i], como: "geometria" });
    }
  }

  const semParMock = mock.filter((m) => !pares.some((p) => p.mock === m));
  const semParApp = app.filter((_, i) => !usadosApp.has(i));
  return { pares, semParMock, semParApp };
}

/**
 * Censo de famílias tipográficas entre os elementos que mostram texto. É o
 * jeito mais direto de ver "muda muita letra": se o mockup tem uma família e
 * o app tem outra, a tela inteira diverge por fora do ranking.
 */
export function censoDeFontes(itens) {
  const conta = {};
  for (const el of itens) {
    if (!el.texto) continue;
    const f = familia(el.estilos.fontFamily);
    conta[f] = (conta[f] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(conta).sort((a, b) => b[1] - a[1]));
}

export function comparar(mock, app, areaTotal) {
  const { pares, semParMock, semParApp } = parear(mock.itens, app.itens);
  const linhas = [];
  for (const par of pares) {
    const difs = {};
    let soma = 0;
    for (const prop of PROPS) {
      const d = diferenca(prop, par.mock.estilos[prop], par.app.estilos[prop]);
      if (d) {
        difs[prop] = d;
        soma += d.peso;
      }
    }
    for (const prop of ["largura", "altura"]) {
      const d = diferenca(prop, `${par.mock[prop]}px`, `${par.app[prop]}px`);
      if (d) {
        difs[prop] = d;
        soma += d.peso;
      }
    }
    if (!soma) continue;
    const area = par.mock.largura * par.mock.altura;
    const impacto = soma * Math.sqrt(Math.max(area, 1) / areaTotal);
    linhas.push({
      texto: par.mock.texto.slice(0, 48),
      tag: par.mock.tag,
      como: par.como,
      em: `${Math.round(par.mock.x)},${Math.round(par.mock.y)}`,
      tamanho: `${Math.round(par.mock.largura)}x${Math.round(par.mock.altura)}`,
      impacto: Math.round(impacto * 1000) / 1000,
      difs,
    });
  }
  linhas.sort((a, b) => b.impacto - a.impacto);
  // O ranking geral é dominado por caixas estruturais (wrappers do React
  // contra divs do mockup). Esta segunda lista é só do que tem texto -- é o
  // que o olho vê como "mudou a letra".
  const comTexto = linhas.filter((l) => l.texto);
  return {
    fontes: {
      mockup: censoDeFontes(mock.itens),
      app: censoDeFontes(app.itens),
    },
    comTextoDivergindo: comTexto.length,
    pioresComTexto: comTexto.slice(0, 12),
    pareados: pares.length,
    semParNoMockup: semParMock.length,
    semParNoApp: semParApp.length,
    comDivergencia: linhas.length,
    impactoTotal:
      Math.round(linhas.reduce((s, l) => s + l.impacto, 0) * 1000) / 1000,
    linhas,
  };
}

// ---------------------------------------------------------------------------
// Coleta de estilo dentro da página (roda no navegador)
// ---------------------------------------------------------------------------

/**
 * Devolve, para cada elemento visível sob `raiz`, posição, tamanho, o texto
 * próprio dele e as propriedades de `props`. As coordenadas são relativas à
 * raiz, então mockup e app ficam no mesmo sistema.
 */
export const COLETAR = function ([seletorRaiz, props]) {
  const raiz = document.querySelector(seletorRaiz);
  if (!raiz) return { erro: `raiz não encontrada: ${seletorRaiz}` };
  const base = raiz.getBoundingClientRect();
  const itens = [];
  const anda = (el, profundidade) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const visivel =
      r.width >= 1 &&
      r.height >= 1 &&
      cs.visibility !== "hidden" &&
      cs.display !== "none" &&
      Number(cs.opacity) > 0.05;
    if (visivel) {
      const proprio = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.replace(/\s+/g, " ").trim())
        .join(" ")
        .trim();
      const estilos = {};
      for (const p of props) {
        if (p === "padding")
          estilos[p] = [
            cs.paddingTop,
            cs.paddingRight,
            cs.paddingBottom,
            cs.paddingLeft,
          ].join(" ");
        else if (p === "borderRadius")
          estilos[p] = [
            cs.borderTopLeftRadius,
            cs.borderTopRightRadius,
            cs.borderBottomRightRadius,
            cs.borderBottomLeftRadius,
          ].join(" ");
        else estilos[p] = cs[p];
      }
      itens.push({
        tag: el.tagName.toLowerCase(),
        profundidade,
        texto: proprio,
        x: Math.round((r.left - base.left) * 10) / 10,
        y: Math.round((r.top - base.top) * 10) / 10,
        largura: Math.round(r.width * 10) / 10,
        altura: Math.round(r.height * 10) / 10,
        estilos,
      });
    }
    for (const filho of el.children) anda(filho, profundidade + 1);
  };
  anda(raiz, 0);
  return { itens, area: base.width * base.height };
};

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

export function relatorioDeEstilos(nome, cmp, meta) {
  const l = [];
  l.push(`# Estilos: ${nome}`);
  l.push("");
  l.push(`- mockup: \`${meta.mockup}\``);
  l.push(`- app: \`${meta.app}\``);
  l.push(
    `- pareados ${cmp.pareados} · divergem ${cmp.comDivergencia} · ` +
      `só no mockup ${cmp.semParNoMockup} · só no app ${cmp.semParNoApp}`
  );
  l.push(`- impacto total: **${cmp.impactoTotal}**`);
  const fam = (c) =>
    Object.entries(c)
      .map(([f, n]) => `${f} (${n})`)
      .join(", ");
  l.push(`- famílias no mockup: ${fam(cmp.fontes.mockup)}`);
  l.push(`- famílias no app: ${fam(cmp.fontes.app)}`);
  l.push("");
  l.push(
    "Ordem por impacto = (soma das diferenças normalizadas) × √(área relativa)."
  );
  l.push("Em cada célula: **mockup** → app.");
  l.push("");
  if (cmp.pioresComTexto.length) {
    l.push(`## Só os elementos com texto (${cmp.comTextoDivergindo})`);
    l.push("");
    l.push("| impacto | texto | propriedade | mockup → app |");
    l.push("| ------- | ----- | ----------- | ------------ |");
    for (const linha of cmp.pioresComTexto)
      for (const [prop, d] of Object.entries(linha.difs))
        l.push(
          `| ${linha.impacto} | “${linha.texto}” | ${prop} | \`${d.a}\` → \`${d.b}\` |`
        );
    l.push("");
    l.push("## Todos os elementos");
    l.push("");
  }
  l.push("| # | impacto | elemento | onde | propriedade | mockup → app |");
  l.push("| - | ------- | -------- | ---- | ----------- | ------------ |");
  cmp.linhas.slice(0, 60).forEach((linha, i) => {
    Object.entries(linha.difs).forEach(([prop, d], j) => {
      l.push(
        `| ${j === 0 ? i + 1 : ""} | ${j === 0 ? linha.impacto : ""} | ` +
          `${j === 0 ? `${linha.tag}${linha.texto ? ` “${linha.texto}”` : ""}` : ""} | ` +
          `${j === 0 ? `${linha.em} · ${linha.tamanho}` : ""} | ` +
          `${prop} | \`${d.a}\` → \`${d.b}\` |`
      );
    });
  });
  if (cmp.linhas.length > 60)
    l.push(
      "",
      `_(${cmp.linhas.length - 60} elementos de impacto menor omitidos)_`
    );
  return l.join("\n");
}

// ---------------------------------------------------------------------------
// Daqui para baixo: só quando rodada como programa
// ---------------------------------------------------------------------------

const ehPrograma =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (ehPrograma) await principal();

async function principal() {
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
  const flag = (nome) => process.argv.includes(`--${nome}`);

  const OPC = {
    telas:
      arg("telas") === "todas"
        ? Object.keys(TELAS)
        : [arg("tela", "inicio")].flatMap((t) => t.split(",")),
    largura: Number(arg("largura", "390")),
    modo: arg("modo", "claro"),
    tema: arg("tema", "pink-neon"),
    baseUrl: arg(
      "base-url",
      process.env.PIXEL_BASE_URL ?? "http://localhost:3103"
    ),
    saida: resolve(ROOT, arg("saida", "docs/jornada/prints/pixel")),
    limiar: Number(arg("limiar", "0.1")),
    soPixel: flag("so-pixel"),
    inteira: flag("inteira"),
    semJornada: flag("sem-jornada"),
    json: flag("json"),
  };

  const erroDeUso = (msg) => {
    console.error(`comparar.mjs: ${msg}`);
    process.exit(2);
  };
  for (const t of OPC.telas)
    if (!TELAS[t])
      erroDeUso(
        `tela desconhecida: ${t} (use ${Object.keys(TELAS).join("|")})`
      );
  if (!ALTURA[OPC.largura])
    erroDeUso(`largura deve ser 390 ou 430, veio ${OPC.largura}`);
  if (!["claro", "escuro"].includes(OPC.modo))
    erroDeUso("modo deve ser claro ou escuro");
  if (!TEMAS.includes(OPC.tema))
    erroDeUso(`tema deve ser um de ${TEMAS.join("|")}`);
  if (!(OPC.limiar > 0 && OPC.limiar <= 1))
    erroDeUso(`limiar deve ficar entre 0 e 1, veio ${OPC.limiar}`);

  const MODO_CSS = OPC.modo === "claro" ? "light" : "dark";
  const log = (...a) => {
    if (!OPC.json) console.log(...a);
  };

  const MOCKUP = pathToFileURL(
    join(ROOT, "docs/jornada/referencias/5-telas-8-temas-claro-escuro.html")
  ).href;

  const { chromium } = createRequire(PW)("playwright");
  const browser = await chromium.launch({ executablePath: CHROME });

  /** Desenha o diff no navegador, usando o MESMO `medirPixels` dos testes. */
  async function diffDePixel(page, pngA, pngB, limiar) {
    return page.evaluate(
      async ([a, b, lim, fonteDoNucleo]) => {
        const medir = eval(`(${fonteDoNucleo})`);
        const carrega = (dados) =>
          new Promise((ok, falha) => {
            const img = new Image();
            img.onload = () => ok(img);
            img.onerror = () => falha(new Error("png ilegível"));
            img.src = `data:image/png;base64,${dados}`;
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
        const db = pinta(ib);
        const r = medir({
          a: da,
          b: db,
          larguraA: ia.width,
          alturaA: ia.height,
          larguraB: ib.width,
          alturaB: ib.height,
          limiar: lim,
        });
        const saida = document.createElement("canvas");
        saida.width = r.largura;
        saida.height = r.altura;
        const ctx = saida.getContext("2d");
        const img = ctx.createImageData(r.largura, r.altura);
        for (let p = 0; p < r.largura * r.altura; p++) {
          const o = p * 4;
          if (r.mascara[p]) {
            img.data[o] = 255;
            img.data[o + 1] = 0;
            img.data[o + 2] = 90;
            img.data[o + 3] = 255;
          } else {
            const px2 =
              (Math.floor(p / r.largura) * ia.width + (p % r.largura)) * 4;
            const cinza = (da[px2] + da[px2 + 1] + da[px2 + 2]) / 3;
            const c = 255 - (255 - cinza) * 0.18;
            img.data[o] = c;
            img.data[o + 1] = c;
            img.data[o + 2] = c;
            img.data[o + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
        return {
          largura: r.largura,
          altura: r.altura,
          pixels: r.pixels,
          diferentes: r.diferentes,
          difPct: r.difPct,
          mesmoTamanho: r.mesmoTamanho,
          png: saida.toDataURL("image/png").split(",")[1],
        };
      },
      [
        pngA.toString("base64"),
        pngB.toString("base64"),
        limiar,
        medirPixels.toString(),
      ]
    );
  }

  async function abrirMockup({ tela, largura, tema }) {
    const ctx = await browser.newContext({
      viewport: {
        width: Math.max(largura + 80, 900),
        height: ALTURA[largura] + (OPC.inteira ? 3000 : 200),
      },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(HOJE_DO_MOCKUP);
    await page.goto(MOCKUP, { waitUntil: "networkidle", timeout: 120000 });
    // A fonte do mockup vem do Google Fonts. Sem ela, TODA letra diverge e a
    // medição vira lixo -- então aqui é erro duro, não aviso.
    await page.evaluate(() => document.fonts.ready);
    const temFonte = await page.evaluate(() =>
      document.fonts.check('800 36px "Plus Jakarta Sans"')
    );
    if (!temFonte)
      throw new Error(
        "o mockup não conseguiu carregar a Plus Jakarta Sans (Google Fonts). " +
          "Sem a fonte certa a comparação não vale nada -- confira a rede."
      );

    const alvo = await page.evaluate(
      ([t, md, tm, larg, mockLarg, inteira, altura]) => {
        const raiz = document.documentElement;
        raiz.style.setProperty("--s", "1"); // zoom do mockup em 1:1
        const barra = document.querySelector(".toolbar");
        if (barra) barra.style.display = "none";
        document
          .querySelectorAll("#view-um .ph")
          .forEach((ph) => (ph.dataset.tm = tm));
        const ph = document.querySelector(
          `#view-um .ph[data-t="${t}"][data-md="${md}"]`
        );
        if (!ph) return { erro: `fase não encontrada: ${t}/${md}` };
        ph.classList.remove("compact");
        // Moldura do celular fora do recorte: o `.scaler` tem
        // `border-radius: 36px` e `overflow: hidden`, então ele ARREDONDA os
        // quatro cantos do `.ph`. O print do app tem canto reto, e isso
        // fazia os cantos divergirem SEMPRE, em toda tela e todo tema, sem
        // que nada de errado estivesse acontecendo.
        const moldura = ph.closest(".scaler");
        if (moldura) {
          moldura.style.borderRadius = "0";
          moldura.style.overflow = "visible";
          moldura.style.boxShadow = "none";
        }
        ph.style.borderRadius = "0";
        if (larg !== mockLarg) {
          const alvoLarg = `${larg}px`;
          ph.style.width = alvoLarg;
          const fone = ph.closest(".phone");
          const escala = ph.closest(".scaler");
          if (fone) fone.style.width = alvoLarg;
          if (escala) escala.style.width = alvoLarg;
        }
        // Altura da tela-alvo: o `.ph` do mockup tem 844px fixos. Em 430 o
        // app tem 932px; sem isso a barra e o FAB do mockup ficam 88px
        // acima e a faixa de baixo inteira conta como diferente.
        if (!inteira && altura !== ph.offsetHeight) {
          const alvoAlt = `${altura}px`;
          ph.style.height = alvoAlt;
          const fone = ph.closest(".phone");
          const escala = ph.closest(".scaler");
          if (fone) fone.style.height = alvoAlt;
          if (escala) escala.style.height = alvoAlt;
        }
        const scr = ph.querySelector(".scr");
        if (scr) scr.scrollTop = 0;
        if (inteira && scr) {
          const alturaReal = scr.scrollHeight;
          scr.style.position = "static";
          scr.style.overflow = "visible";
          scr.style.height = `${alturaReal}px`;
          ph.style.height = `${alturaReal}px`;
          const fone = ph.closest(".phone");
          const escala = ph.closest(".scaler");
          if (fone) fone.style.height = `${alturaReal}px`;
          if (escala) {
            escala.style.height = `${alturaReal}px`;
            escala.style.overflow = "visible";
          }
        }
        // Posição inteira: no meio da página o celular cai numa coordenada
        // fracionária (o do modo escuro fica em y = x,5), e o recorte
        // deslocava o texto inteiro meio pixel. Preso no canto da página,
        // o celular fica em (0, 0).
        // `.phone` tem transform: scale(var(--s)). Com --s = 1 ele não muda
        // nada no layout, mas põe o celular numa camada própria, e o texto
        // ali é suavizado de outro jeito (1 pixel de borda de letra aqui e
        // ali). O app não tem essa camada: sem o transform, os dois lados
        // desenham igual.
        const celular = ph.closest(".phone");
        if (celular) celular.style.transform = "none";
        const escala = ph.closest(".scaler");
        if (escala) {
          escala.style.position = "fixed";
          escala.style.left = "0";
          escala.style.top = "0";
          escala.style.zIndex = "2147483647";
        }
        window.scrollTo(0, 0);
        return { ok: true, reflow: larg !== mockLarg };
      },
      [
        tela,
        MODO_CSS,
        tema,
        largura,
        LARGURA_DO_MOCKUP,
        OPC.inteira,
        ALTURA[largura],
      ]
    );
    if (alvo.erro) throw new Error(alvo.erro);
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation:none!important;transition:none!important}",
    });
    await page.waitForTimeout(300);
    const el = page.locator(
      `#view-um .ph[data-t="${tela}"][data-md="${MODO_CSS}"]`
    );
    return { ctx, page, el, reflow: alvo.reflow };
  }

  async function abrirApp({ largura, tema }) {
    const ctx = await browser.newContext({
      viewport: { width: largura, height: ALTURA[largura] },
      deviceScaleFactor: 2,
      hasTouch: true,
    });
    await ctx.addInitScript(
      ([t, m]) => {
        try {
          localStorage.setItem("jobapp-theme", t);
          localStorage.setItem("jobapp-mode", m);
          // O recap do mês não pode cobrir a tela do print. O mês é o do
          // relógio congelado (setembro de 2026).
          localStorage.setItem("jobapp-recap-last-shown", "2026-09");
        } catch {}
      },
      [tema, MODO_CSS]
    );
    // Nenhum backend: o laboratório é 100% mock no navegador (mesma receita
    // do tests/visual/j07-matriz.mjs). Deixar `/api/**` passar deixa a Rede
    // em branco, então ela continua abortada; o aviso de sessão que isso faz
    // nascer é escondido em `esconderOQueEhSoDoLaboratorio`.
    await ctx.route("**/api/**", (r) => r.abort());
    await ctx.route(/supabase\.co/, (r) => r.abort());
    const page = await ctx.newPage();
    const erros = [];
    page.on("pageerror", (e) => erros.push(e.message.split("\n")[0]));
    // Relógio congelado ANTES do goto: o mockup desenha quarta, 23/09/2026
    // 10h, e sem isso datas, "em N dias" e o próximo atendimento mudam a
    // cada dia que a ferramenta roda.
    await page.clock.setFixedTime(HOJE_DO_MOCKUP);
    await page.bringToFront();
    await page.goto(`${OPC.baseUrl}/dev-preview/app`, {
      waitUntil: "networkidle",
      timeout: 180000,
    });
    await page.addStyleTag({
      content:
        "nextjs-portal{display:none!important;pointer-events:none!important}",
    });
    const recap = page.getByRole("button", { name: "Continuar no meu ritmo" });
    if (await recap.isVisible().catch(() => false)) {
      await recap.click();
      await page.waitForTimeout(400);
    }
    await forcarTema(page, tema);
    await esconderOQueEhSoDoLaboratorio(page);
    return { ctx, page, erros };
  }

  /**
   * O laboratório mostra avisos que não existem no app nem no mockup (sessão
   * de teste indisponível). Eles empurram a tela e falseariam o diff.
   */
  async function esconderOQueEhSoDoLaboratorio(page) {
    await page.evaluate(() => {
      // Casa pelo <strong> do próprio aviso e esconde só o <div> dele. Pegar
      // o div "que começa com esse texto" escondia o painel inteiro da Rede,
      // porque o painel também começa com o aviso.
      const marcas = ["Sessão de teste local indisponível."];
      for (const forte of document.querySelectorAll("strong")) {
        const t = forte.textContent?.trim() ?? "";
        if (!marcas.includes(t)) continue;
        const caixa = forte.closest("div");
        if (caixa) caixa.style.display = "none";
      }
    });
  }

  /**
   * No Início, o card do Cofre do mockup está no estado "Protegido". O
   * `CofreCard` só é renderizado quando o Cofre TEM PIN -- sem PIN ele
   * devolve `null` e o card simplesmente não existe, e aí a grade inteira
   * do Início fica diferente do mockup.
   *
   * Quem configura o PIN no laboratório é o `__previewLock()`. Só que ele
   * também liga a trava, e `locked && pinHash` troca a árvore inteira pelo
   * PinScreen -- ou seja, sozinho ele esconde justamente a tela que
   * queremos. Por isso o par: trava (que define o PIN) e destrava logo em
   * seguida (que devolve o Início com o PIN já configurado).
   *
   * Depois ESPERA o texto aparecer, em vez de dormir um tempo arbitrário:
   * o React remonta a árvore nas duas trocas, e capturar no meio pegava o
   * card no estado errado de forma intermitente.
   */
  async function travarParaOCardDoCofre(page) {
    const temGancho = await page.evaluate(
      () =>
        typeof window.__previewLock === "function" &&
        typeof window.__previewUnlock === "function"
    );
    if (!temGancho) return;
    await page.evaluate(() => window.__previewLock());
    await page.evaluate(() => window.__previewUnlock());
    await page
      .getByText("Protegido", { exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 15000 });
  }

  async function forcarTema(page, tema) {
    await page.evaluate(
      ([t, m]) => {
        const h = document.documentElement;
        h.setAttribute("data-theme", t);
        if (m === "light") h.setAttribute("data-mode", "light");
        else h.removeAttribute("data-mode");
      },
      [tema, MODO_CSS]
    );
  }

  async function irParaAba(page, tela, tema) {
    const mostrar = page.getByRole("button", { name: /Mostrar abas/ });
    if (await mostrar.isVisible().catch(() => false)) await mostrar.click();
    await page
      .getByRole("button", { name: TELAS[tela].nav, exact: true })
      .first()
      .click();
    await page.waitForTimeout(900);
    if (tela === "inicio") await travarParaOCardDoCofre(page);
    // O mockup das 5 telas é anterior à Jornada: sem o card dela, o Início
    // do app tem o mesmo conteúdo do mockup (o card fica no protótipo da
    // Jornada, docs/jornada/referencias/prototipo-sua-jornada.html).
    if (tela === "inicio" && OPC.semJornada)
      await page.addStyleTag({
        content: '[aria-label="Abrir sua Jornada"]{display:none!important}',
      });
    await forcarTema(page, tema);
    await esconderOQueEhSoDoLaboratorio(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation:none!important;transition:none!important}",
    });
    await page.waitForTimeout(400);
  }

  const lona = await (await browser.newContext()).newPage();
  await lona.setContent("<!doctype html><title>diff</title>");

  const resultados = [];
  const app = await abrirApp(OPC);

  for (const tela of OPC.telas) {
    const nome =
      `${tela}-${OPC.largura}-${OPC.modo}-${OPC.tema}` +
      (tela === "inicio" && OPC.semJornada ? "-sem-jornada" : "");
    const dir = join(OPC.saida, tela);
    mkdirSync(dir, { recursive: true });

    const mock = await abrirMockup({ ...OPC, tela });
    await irParaAba(app.page, tela, OPC.tema);

    // Recorte com geometria inteira e tamanho imposto (ver clipDoRecorte).
    const caixa = await mock.el.boundingBox();
    const alturaAlvo = OPC.inteira
      ? Math.round(caixa.height)
      : ALTURA[OPC.largura];
    const pngMock = await mock.page.screenshot({
      clip: clipDoRecorte({
        caixa,
        largura: OPC.largura,
        altura: alturaAlvo,
      }),
    });
    const pngApp = await app.page.screenshot({ fullPage: OPC.inteira });
    writeFileSync(join(dir, `${nome}-mockup.png`), pngMock);
    writeFileSync(join(dir, `${nome}-app.png`), pngApp);

    const d = await diffDePixel(lona, pngMock, pngApp, OPC.limiar);
    // Tamanho diferente aqui é defeito de captura, não divergência de
    // desenho: a união contaria uma faixa inteira como diferente e o número
    // sairia inflado em silêncio. Em `--inteira` as alturas são de conteúdo
    // e podem mesmo diferir, então a guarda não vale.
    if (!OPC.inteira && !d.mesmoTamanho)
      throw new Error(
        `recorte de tamanhos diferentes em ${nome}: o diff saiu ${d.largura}x${d.altura}. ` +
          "Mockup e app precisam sair do mesmo tamanho -- confira o clip do recorte."
      );
    writeFileSync(join(dir, `${nome}-diff.png`), Buffer.from(d.png, "base64"));

    let cmp = null;
    if (!OPC.soPixel) {
      const eMock = await mock.page.evaluate(COLETAR, [
        `#view-um .ph[data-t="${tela}"][data-md="${MODO_CSS}"]`,
        PROPS,
      ]);
      const eApp = await app.page.evaluate(COLETAR, ["body", PROPS]);
      if (eMock.erro || eApp.erro) throw new Error(eMock.erro ?? eApp.erro);
      cmp = comparar(eMock, eApp, eMock.area);
      writeFileSync(
        join(dir, `${nome}-estilos.md`),
        relatorioDeEstilos(nome, cmp, {
          mockup: "5-telas-8-temas-claro-escuro.html",
          app: `${OPC.baseUrl}/dev-preview/app`,
        })
      );
    }

    const r = {
      tela,
      largura: OPC.largura,
      modo: OPC.modo,
      tema: OPC.tema,
      layout: TELAS[tela].layout,
      metrica: `pixelmatch YIQ, limiar ${OPC.limiar}`,
      difPct: d.difPct,
      pixelsDiferentes: d.diferentes,
      tamanho: `${d.largura}x${d.altura}`,
      mesmoTamanho: d.mesmoTamanho,
      reflowDoMockup: mock.reflow,
      estilos: cmp && {
        fontes: cmp.fontes,
        pareados: cmp.pareados,
        comDivergencia: cmp.comDivergencia,
        semParNoMockup: cmp.semParNoMockup,
        semParNoApp: cmp.semParNoApp,
        impactoTotal: cmp.impactoTotal,
        comTextoDivergindo: cmp.comTextoDivergindo,
        pioresComTexto: cmp.pioresComTexto.slice(0, 8).map((l) => ({
          texto: l.texto,
          impacto: l.impacto,
          difs: Object.fromEntries(
            Object.entries(l.difs).map(([k, d2]) => [k, `${d2.a} -> ${d2.b}`])
          ),
        })),
        piores: cmp.linhas.slice(0, 8).map((l) => ({
          elemento: `${l.tag}${l.texto ? ` “${l.texto}”` : ""}`,
          impacto: l.impacto,
          propriedades: Object.keys(l.difs),
        })),
      },
      erros: app.erros.slice(0, 5),
    };
    writeFileSync(
      join(dir, `${nome}-resultado.json`),
      JSON.stringify(r, null, 2)
    );
    resultados.push(r);
    log(
      `${nome.padEnd(34)} diff ${String(r.difPct).padStart(7)}%  ` +
        `estilos ${cmp ? `${cmp.comDivergencia}/${cmp.pareados} (impacto ${cmp.impactoTotal})` : "-"}`
    );
    await mock.ctx.close();
  }

  await app.ctx.close();
  await browser.close();

  const resumo = {
    quando: new Date().toISOString(),
    baseUrl: OPC.baseUrl,
    metrica: `pixelmatch YIQ, limiar ${OPC.limiar}`,
    relogio: HOJE_DO_MOCKUP.toISOString(),
    meta: "difPct < 0,5",
    resultados,
  };
  mkdirSync(OPC.saida, { recursive: true });
  writeFileSync(
    join(OPC.saida, `resumo-${OPC.largura}-${OPC.modo}-${OPC.tema}.json`),
    JSON.stringify(resumo, null, 2)
  );
  if (OPC.json) console.log(JSON.stringify(resumo, null, 2));
  else {
    log("");
    log("| tela | layout | diff % | estilos divergentes | impacto |");
    log("| ---- | ------ | ------ | ------------------- | ------- |");
    for (const r of resultados)
      log(
        `| ${r.tela} | ${r.layout} | ${r.difPct}% | ` +
          `${r.estilos ? `${r.estilos.comDivergencia}/${r.estilos.pareados}` : "-"} | ` +
          `${r.estilos ? r.estilos.impactoTotal : "-"} |`
      );
  }
}
