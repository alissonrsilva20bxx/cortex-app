import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ABERTURA_ESTATICA_MS,
  DURACAO_DA_ABERTURA_MS,
  INICIO_DA_SAIDA_MS,
  PARADAS,
  PONTOS_DA_ROTA,
  QUADROS_DO_VIAJANTE,
} from "@/lib/entry/rotaDasMetas";

const css = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "components",
    "entry",
    "OpeningMotion.module.css"
  ),
  "utf-8"
).replace(/\r\n/g, "\n");

describe("Rota das metas: a linha do tempo de 4,0 s do desenho", () => {
  it("a abertura inteira dura 4,0 s: a saída começa aos 3,72 s e leva 280 ms", () => {
    expect(DURACAO_DA_ABERTURA_MS).toBe(4000);
    expect(INICIO_DA_SAIDA_MS + 280).toBe(DURACAO_DA_ABERTURA_MS);
  });

  it("movimento reduzido: o quadro parado é curto (menos de 1 s)", () => {
    expect(ABERTURA_ESTATICA_MS).toBeGreaterThan(0);
    expect(ABERTURA_ESTATICA_MS).toBeLessThan(1000);
  });

  it("65 pontos acendem em ordem, de 0,25 s a 2,75 s, alternando 2,4 e 1,6 de raio", () => {
    expect(PONTOS_DA_ROTA).toHaveLength(65);
    const atrasos = PONTOS_DA_ROTA.map((p) => p[3]);
    expect(atrasos[0]).toBeCloseTo(0.25, 3);
    expect(atrasos[64]).toBeCloseTo(2.75, 3);
    for (let i = 1; i < atrasos.length; i++)
      expect(atrasos[i]).toBeGreaterThan(atrasos[i - 1]);
    PONTOS_DA_ROTA.forEach(([, , r], i) => expect(r).toBe(i % 2 ? 1.6 : 2.4));
  });

  it("a rota sai do Início (60,700) e chega a PARIS (200,120)", () => {
    const [x0, y0] = PONTOS_DA_ROTA[0];
    const [x1, y1] = PONTOS_DA_ROTA[64];
    expect([x0, y0]).toEqual([60, 700]);
    expect([x1, y1]).toEqual([200, 120]);
  });

  it("as paradas são as abas, na ordem da rota, cada uma quando a rota chega nela", () => {
    expect(PARADAS.map((p) => p.nome)).toEqual([
      "Início",
      "Agenda",
      "Financeiro",
      "Cofre",
      "Jornada",
    ]);
    for (let i = 1; i < PARADAS.length; i++)
      expect(PARADAS[i].atraso).toBeGreaterThan(PARADAS[i - 1].atraso);
    expect(PARADAS[PARADAS.length - 1].atraso).toBeLessThan(2.75);
  });

  it("o ✦ do CSS percorre exatamente os quadros do desenho (41, de 2,5 em 2,5%)", () => {
    expect(QUADROS_DO_VIAJANTE).toHaveLength(41);
    const bloco = css.match(/@keyframes rotaViajante \{([\s\S]*?)\n\}/)?.[1];
    expect(bloco).toBeTruthy();
    const doCss = [
      ...bloco!.matchAll(
        /([\d.]+)% \{\s*transform: translate\(calc\(var\(--u\) \* ([-\d.]+)\),\s*calc\(var\(--u\) \* ([-\d.]+)\)\);/g
      ),
    ].map((m) => [+m[1], +m[2], +m[3]]);
    expect(doCss).toEqual(QUADROS_DO_VIAJANTE.map((q) => [...q]));
  });

  it("o ✦ viaja de 0,25 s por 2,5 s, junto com os pontos", () => {
    expect(css).toMatch(
      /rotaViajante 2\.5s 0\.25s linear both,\s*rotaViajanteLuz 2\.5s 0\.25s linear both/
    );
  });

  it("os momentos do desenho: pin aos 2,75 s, PARIS aos 3,0 s, anel aos 3,1 s, marca aos 3,2 s", () => {
    expect(css).toMatch(/animation: drop 0\.5s 2\.75s/);
    expect(css).toMatch(/animation: up 0\.45s 3s both/);
    expect(css).toMatch(/animation: ring 1s 3\.1s ease-out forwards/);
    expect(css).toMatch(/animation: fade 0\.45s 3\.2s both/);
  });
});
