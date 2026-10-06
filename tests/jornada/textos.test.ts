import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CURRENCY,
  LOCALE,
  NOME_PILAR,
  ROTULO_ACAO,
  SELO,
  glowGanho,
  money,
  nomeEnfeite,
  nomeEstagio,
  nomeMes,
  textoMissao,
} from "../../lib/jornada/textos";
import { ACOES, PILARES, SELOS, TIPOS_MISSAO } from "../../lib/jornada/estado";

/**
 * J11 (#161) — todo texto visível e toda moeda da Jornada moram em
 * `lib/jornada/textos.ts` (spec, decisão 17 e §9). Este teste lê os outros
 * arquivos da Jornada e falha se algum tiver texto de interface ou símbolo
 * de moeda. Vale também pras telas que vierem depois (J12 em diante): todo
 * arquivo novo em `components/jornada/` e `lib/jornada/` entra na varredura.
 */

const ROOT = join(__dirname, "..", "..");
const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");

function arquivos(dir: string): string[] {
  if (!existsSync(join(ROOT, dir))) return [];
  const out: string[] = [];
  for (const nome of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${nome}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...arquivos(rel));
    else if (/\.(ts|tsx)$/.test(rel)) out.push(rel);
  }
  return out;
}

const VARRIDOS = [
  ...arquivos("lib/jornada"),
  ...arquivos("components/jornada"),
].filter((f) => f !== "lib/jornada/textos.ts");

/** Tira comentários pra varrer só código. */
function soCodigo(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/^\s*["']use (client|server)["'];?\s*$/gm, ""); // diretivas do React
}

/** Todos os literais de texto ("...", '...', `...`) do código. */
function literais(codigo: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  for (const m of codigo.matchAll(re)) out.push(m[1] ?? m[2] ?? m[3] ?? "");
  return out;
}

/** Parece texto de interface: tem letra acentuada, ou duas palavras separadas por espaço. */
function pareceTextoVisivel(s: string): boolean {
  const semInterpolacao = s.replace(/\$\{[^}]*\}/g, " ");
  return (
    /[À-ÿ]/.test(semInterpolacao) ||
    /[A-Za-zÀ-ÿ]{2,}\s+[A-Za-zÀ-ÿ]{2,}/.test(semInterpolacao)
  );
}

describe("nenhum texto visível nem moeda fora de lib/jornada/textos.ts", () => {
  it("a varredura encontra os arquivos da Jornada", () => {
    expect(VARRIDOS).toEqual(
      expect.arrayContaining([
        "lib/jornada/estado.ts",
        "lib/jornada/cliente.ts",
        "lib/jornada/cache.ts",
        "components/jornada/useJornada.ts",
      ])
    );
  });

  it.each(VARRIDOS)("%s não tem símbolo nem código de moeda", (arquivo) => {
    const codigo = soCodigo(read(arquivo));
    expect(codigo).not.toMatch(/€|R\$|\bEUR\b|\bBRL\b|currency/);
    expect(codigo).not.toMatch(/Intl\.NumberFormat|toLocaleString/);
  });

  it.each(VARRIDOS)("%s não tem texto de interface", (arquivo) => {
    const achados = literais(soCodigo(read(arquivo))).filter(
      pareceTextoVisivel
    );
    expect(achados).toEqual([]);
  });
});

describe("textos.ts cobre tudo o que as telas vão mostrar", () => {
  it("idioma e moeda num bloco só", () => {
    expect(LOCALE).toBe("pt-BR");
    expect(CURRENCY).toBe("EUR");
    expect(money(1000)).toMatch(/€/);
    expect(money(1000)).toMatch(/1\.000/);
  });

  it("todo pilar, ação, selo e tipo de missão tem texto", () => {
    for (const p of PILARES) expect(NOME_PILAR[p]).toBeTruthy();
    for (const a of ACOES) expect(ROTULO_ACAO[a]).toBeTruthy();
    for (const s of SELOS) expect(SELO[s].nome).toBeTruthy();
    for (const t of TIPOS_MISSAO) expect(textoMissao(t, 3)).toMatch(/3/);
  });

  it("estágios: os 5 nomes e Icônica II, III depois (nada zera)", () => {
    expect([0, 1, 2, 3, 4].map(nomeEstagio)).toEqual([
      "Começando",
      "Em movimento",
      "Organizada",
      "Prosperando",
      "Icônica",
    ]);
    expect(nomeEstagio(5)).toBe("Icônica II");
    expect(nomeEstagio(6)).toBe("Icônica III");
  });

  it("missões no singular e no plural, com as frases da spec", () => {
    expect(textoMissao("planejar_dias", 8)).toBe("Planejar 8 dias");
    expect(textoMissao("dica_protegeu", 1)).toBe(
      "Sua dica proteger alguém 1 vez"
    );
    expect(textoMissao("guardar_semanas", 3)).toBe(
      "Guardar dinheiro em 3 semanas"
    );
    expect(textoMissao("comprovantes_cofre", 4)).toBe(
      "Guardar 4 comprovantes no Cofre"
    );
  });

  it("os 12 meses e os 12 enfeites", () => {
    expect(nomeMes(1)).toBe("janeiro");
    expect(nomeMes(12)).toBe("dezembro");
    expect(nomeEnfeite(10)).toBe("Lua de outubro");
  });

  it("o número de Glow vem de fora (o texto só escreve)", () => {
    expect(glowGanho(15)).toBe("+15 Glow");
    expect(glowGanho(1200)).toBe("+1.200 Glow");
  });
});
