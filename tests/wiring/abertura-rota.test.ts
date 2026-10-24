import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Abertura "Rota das metas" (proposta 2 aprovada), terminando no movimento
 * da marca Arcelle (7,5 s). Fiação a partir do
 * código; o pixel contra o desenho (0, 1, 2, 3 e 3,6 s, claro/escuro, e o
 * quadro parado do movimento reduzido) e a ausência de flash no início
 * ficam em tests/visual/pixel/abertura.mjs; a linha do tempo, em
 * tests/lib/rotaDasMetas.test.ts.
 */

const ROOT = join(__dirname, "..", "..");
const ler = (...p: string[]) =>
  readFileSync(join(ROOT, ...p), "utf-8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
const tsx = semComentarios(ler("components", "entry", "OpeningMotion.tsx"));
const css = semComentarios(
  ler("components", "entry", "OpeningMotion.module.css")
);
const page = ler("app", "page.tsx");
const login = ler("app", "login", "page.tsx");

function regra(seletor: string): string {
  const esc = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  if (!m) throw new Error(`Regra ${seletor} não encontrada`);
  return m[1];
}

describe("a lógica de antes continua: quando mostra, uma vez por aba", () => {
  it("mesma chave de sessão, lida no render (lazy init) e gravada no efeito", () => {
    expect(tsx).toMatch(
      /export const SEEN_THIS_TAB_KEY = "jobapp-entry-motion-seen";/
    );
    expect(tsx).toMatch(
      /useState\(\s*\(\) =>\s*typeof window !== "undefined" &&\s*sessionStorage\.getItem\(SEEN_THIS_TAB_KEY\) === "1"\s*\)/
    );
    expect(tsx).toMatch(/sessionStorage\.setItem\(SEEN_THIS_TAB_KEY, "1"\);/);
  });

  it("já vista nesta aba: sai na hora", () => {
    expect(tsx).toMatch(/const delay = alreadySeenThisTab\s*\?\s*0/);
  });

  it("Início e login continuam usando a mesma abertura", () => {
    expect(page).toMatch(
      /<OpeningMotion onDone=\{\(\) => setEntryDone\(true\)\} \/>/
    );
    expect(login).toMatch(
      /<OpeningMotion onDone=\{\(\) => setStage\("login"\)\} \/>/
    );
  });
});

describe("7,5 s, contados da 1ª pintura", () => {
  it("a saída começa em INICIO_DA_SAIDA_MS menos o que a cena já andou", () => {
    expect(tsx).toMatch(
      /const decorrido = tempoDaCena\(palcoRef\.current\);[\s\S]{0,240}: Math\.max\(0, INICIO_DA_SAIDA_MS - decorrido\);/
    );
    expect(tsx).toMatch(/const SAIDA_MS = 280;/);
    expect(tsx).toMatch(/onDoneRef\.current\(\), SAIDA_MS\)/);
  });

  it("o relógio é a animação do palco (começa no HTML do servidor)", () => {
    expect(tsx).toMatch(/palco\?\.getAnimations\?\.\(\)\[0\]\?\.startTime/);
    // não `currentTime`: sem nada mudando na tela ele para de andar
    expect(tsx).toMatch(/const t = performance\.now\(\) - inicio;/);
    expect(regra(".palco")).toMatch(/animation: relogio 7\.5s linear both;/);
    expect(tsx).toMatch(/<div ref=\{palcoRef\} className=\{styles\.palco\}/);
  });
});

describe("movimento reduzido: versão estática curta", () => {
  it("usa o tempo curto do quadro parado", () => {
    expect(tsx).toMatch(
      /: reducedMotion\s*\?\s*Math\.max\(0, ABERTURA_ESTATICA_MS - decorrido\)/
    );
  });

  it("o CSS para todas as animações da cena e esconde o ✦ e o anel", () => {
    const bloco = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/
    )?.[1];
    expect(bloco).toBeTruthy();
    expect(bloco).toMatch(/\.palco \* \{\s*animation: none !important;/);
    // o relógio (invisível) do palco segue contando o quadro parado
    expect(bloco).not.toMatch(/\.palco,/);
    expect(css).toMatch(
      /@keyframes relogio \{\s*from,\s*to \{\s*visibility: visible;/
    );
    expect(bloco).toMatch(/\.traveler,\s*\.destring \{\s*display: none;/);
  });
});

describe("nunca trava a entrada: pular ao tocar", () => {
  it("tocar em qualquer lugar da tela pula", () => {
    expect(tsx).toMatch(
      /className=\{`\$\{styles\.motionScreen\}[^`]*`\}\s*aria-label="Abertura da Arcelle"\s*onClick=\{skip\}/
    );
  });

  it("o botão Pular continua, com alvo de 44px", () => {
    expect(tsx).toMatch(
      /<button className=\{styles\.skip\} type="button" onClick=\{skip\}>\s*Pular/
    );
    expect(regra(".skip")).toMatch(/min-height: 44px;/);
    expect(regra(".skip")).toMatch(/env\(safe-area-inset-top, 0px\)/);
  });

  it("teclado: Esc, Enter ou Espaço pulam", () => {
    expect(tsx).toMatch(
      /e\.key === "Escape" \|\| e\.key === "Enter" \|\| e\.key === " "/
    );
  });

  it("pular só antecipa a saída (a mesma transição e o mesmo onDone)", () => {
    expect(tsx).toMatch(/function skip\(\) \{\s*setLeaving\(true\);\s*\}/);
  });
});

describe("sem flash branco; tema claro/escuro e os 8 temas", () => {
  it("o fundo é o do tema desde o 1º quadro: escuro no escuro, claro no claro", () => {
    expect(regra(".motionScreen")).toMatch(/var\(--t-redebg\);/);
    expect(css).toMatch(
      /:global\(\[data-mode="light"\]\) \.motionScreen \{[\s\S]*?var\(--t-phbg\);/
    );
  });

  it("a saída não desfoca (o desfoque mostrava o fundo preto do <html> nas bordas)", () => {
    expect(regra(".motionLeaving")).not.toMatch(/filter/);
    expect(regra(".motionLeaving")).toMatch(/opacity: 0;/);
    expect(regra(".motionLeaving")).toMatch(/transform: scale\(1\.02\);/);
  });

  it("cores só pelos tokens do app; fixas só o branco do ícone do Início e o rosa da marca", () => {
    const hex = css.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    expect(new Set(hex.map((h) => h.toLowerCase()))).toEqual(
      new Set(["#fff", "#ff2d78", "#d6105c"])
    );
    // o rosa da marca só na marca: #FF2D78 no escuro, #D6105C (fundo claro) no claro
    expect(regra(".marca")).toMatch(/--rosa-marca: #ff2d78;/);
    expect(css).toMatch(
      /:global\(\[data-mode="light"\]\) \.marca \{\s*--rosa-marca: #d6105c;\s*\}/
    );
    expect(css.match(/#ff2d78|#d6105c/gi)).toHaveLength(2);
    expect(css).not.toMatch(/rgba\(255,\s*45,\s*120/);
    expect(css).toMatch(
      /color-mix\(in srgb, var\(--t-acc\) 30%, transparent\)/
    );
  });
});

describe("a cena do desenho", () => {
  it("o atlas em inglês: LONDON, RIO e o destino PARIS", () => {
    expect(tsx).toMatch(/LONDON<small>51\.5072° N<\/small>/);
    expect(tsx).toMatch(/RIO<small>22\.9068° S<\/small>/);
    expect(tsx).toMatch(
      /<b>PARIS<\/b>\s*<small>48\.8566° N · a viagem<\/small>/
    );
  });

  it("os pontos e as paradas vêm dos dados extraídos do desenho", () => {
    expect(tsx).toMatch(/PONTOS_DA_ROTA\.map\(\(\[x, y, r, atraso\], i\)/);
    expect(tsx).toMatch(/style=\{\{ animationDelay: `\$\{atraso\}s` \}\}/);
    expect(tsx).toMatch(/PARADAS\.map\(\(p\) =>/);
    expect(tsx).toMatch(/animationDelay: `\$\{p\.atraso\}s`/);
  });

  it("escala única: 1px do desenho = --u, o palco é o quadro de 390×844", () => {
    expect(regra(".motionScreen")).toMatch(
      /--u: min\(calc\(100vw \/ 390\), calc\(100vh \/ 844\)\);/
    );
    expect(regra(".palco")).toMatch(/width: calc\(var\(--u\) \* 390\);/);
    expect(regra(".palco")).toMatch(/height: calc\(var\(--u\) \* 844\);/);
  });

  it("a marca e a frase do app no fim", () => {
    expect(tsx).toMatch(/<MarcaArcelle \/>\s*<\/>/);
    expect(tsx).toMatch(/<\/svg>\s*<i>feito para a sua realidade<\/i>/);
    // o fim antigo (nome em texto) saiu
    expect(tsx).not.toMatch(/<b>Arcelle<\/b>/);
  });

  it("a marca é a da arte final: a arca, os 5 perfis e o nome em contorno", () => {
    expect(tsx).toMatch(/from "@\/lib\/marcaArcelle"/);
    expect(tsx).toMatch(/<path className=\{styles\.arca\} d=\{ARCA\} \/>/);
    expect(tsx).toMatch(
      /\{ d: ROSTO_FORA \},\s*\{ d: ROSTO_MEIO \},\s*\{ d: ROSTO_CENTRO \},\s*\{ d: ROSTO_MEIO, espelho: true \},\s*\{ d: ROSTO_FORA, espelho: true \},/
    );
    // o perfil espelhado anima num <g> por fora (senão a animação apaga o espelho)
    expect(tsx).toMatch(
      /<g key=\{i\} className=\{styles\.perfil\}>\s*<path transform=\{ESPELHO\} d=\{r\.d\} \/>/
    );
    expect(tsx).toMatch(/className=\{styles\.rostos\} transform="translate\(10 41\) scale\(\.1\)"/);
    expect(tsx).toMatch(/NOME_ARC\.map[\s\S]{0,120}styles\.arc\b/);
    expect(tsx).toMatch(/NOME_ELLE\.map[\s\S]{0,120}styles\.elle\b/);
    expect(regra(".elle")).toMatch(/fill: var\(--rosa-marca\);/);
    expect(regra(".arc")).toMatch(/fill: var\(--t-ink\);/);
  });

  it("a marca fica embaixo, abaixo do rótulo do Início, sem cobrir a rota", () => {
    expect(regra(".marca")).toMatch(/top: calc\(var\(--u\) \* 744\);/);
    // rótulo do Início: parada em y 700 (topo 677) + 52 + ~14 de letra
    const inicio = 700 - 23 + 52 + 14;
    expect(744).toBeGreaterThan(inicio);
  });

  it("o símbolo com arca passa dos 64 px da especificação (tela de 390)", () => {
    const largura = Number(regra(".marca svg").match(/width: calc\(var\(--u\) \* ([\d.]+)\);/)?.[1]);
    expect(tsx).toMatch(/<svg viewBox="8 14 238 84">/);
    // arca de y 16,5 a 95,5 (traço de 7) no viewBox de 238 de largura
    expect(((95.5 - 16.5) * largura) / 238).toBeGreaterThan(64);
  });

  it("movimento reduzido: a marca aparece inteira e parada (sem animação, a arca já desenhada)", () => {
    // .palco * { animation: none } vale para a marca; a arca só some pelo
    // dashoffset da animação, então sem ela fica inteira
    expect(regra(".arca")).not.toMatch(/stroke-dashoffset/);
    expect(regra(".perfil")).not.toMatch(/opacity/);
  });
});
