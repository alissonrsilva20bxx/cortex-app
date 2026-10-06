import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as textos from "../../lib/jornada/textos";
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

/**
 * Lista de classes CSS (`"flex items-center gap-2"`, `"w-full sm:px-4"`):
 * todos os pedaços minúsculos, sem acento, e pelo menos um com `-`, `:` ou
 * `[`, como toda classe utilitária. Não é texto de interface. Frase de
 * verdade ("dias fortes", "último dia") não passa por aqui.
 */
function ehListaDeClasses(s: string): boolean {
  const pedacos = s.trim().split(/\s+/).filter(Boolean);
  return (
    pedacos.length > 0 &&
    pedacos.every((p) => /^[a-z0-9!:_\-[\]/.%&>()#=,]+$/.test(p)) &&
    pedacos.some((p) => /[-:[]/.test(p))
  );
}

/** Parece texto de interface: tem letra acentuada, ou duas palavras separadas por espaço. */
function pareceTextoVisivel(s: string): boolean {
  const semInterpolacao = s.replace(/\$\{[^}]*\}/g, " ");
  if (ehListaDeClasses(semInterpolacao)) return false;
  return (
    /[À-ÿ]/.test(semInterpolacao) ||
    /[A-Za-zÀ-ÿ]{2,}\s+[A-Za-zÀ-ÿ]{2,}/.test(semInterpolacao)
  );
}

describe("o detector de texto de interface", () => {
  it.each([
    "flex items-center gap-2",
    "w-full rounded-2xl active:opacity-70",
    "grid grid-cols-[minmax(0,1fr)] gap-[var(--space-section)]",
  ])("classe CSS não é texto: %s", (classe) => {
    expect(pareceTextoVisivel(classe)).toBe(false);
  });

  it.each(["dias fortes", "último dia", "Sua Jornada", "Sem conexão agora"])(
    "frase é texto: %s",
    (frase) => {
      expect(pareceTextoVisivel(frase)).toBe(true);
    }
  );
});

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

describe("nenhum texto vazio em textos.ts", () => {
  /** Todo texto de um valor exportado (string direto ou dentro de objeto). */
  function textosDe(valor: unknown, caminho: string): [string, string][] {
    if (typeof valor === "string") return [[caminho, valor]];
    if (valor && typeof valor === "object" && !Array.isArray(valor)) {
      return Object.entries(valor).flatMap(([k, v]) =>
        textosDe(v, `${caminho}.${k}`)
      );
    }
    return [];
  }

  const todos = Object.entries(textos).flatMap(([nome, valor]) =>
    textosDe(valor, nome)
  );

  it("a varredura encontra os textos e os blocos de textos", () => {
    const nomes = todos.map(([c]) => c);
    expect(nomes).toEqual(
      expect.arrayContaining([
        "CARREGANDO",
        "SECAO.pilares",
        "SELO.planejadora.nome",
      ])
    );
  });

  it.each(todos.filter(([c]) => !/\.unidade$/.test(c)))(
    "%s não é vazio",
    (_caminho, texto) => {
      expect(texto.trim()).not.toBe("");
    }
  );

  it("unidade vazia só nos selos de nível único (Primeiros passos, Em casa, Um ano)", () => {
    const vazias = todos
      .filter(([c, t]) => /\.unidade$/.test(c) && t === "")
      .map(([c]) => c);
    expect(vazias).toEqual([
      "SELO.primeiros_passos.unidade",
      "SELO.em_casa.unidade",
      "SELO.um_ano.unidade",
    ]);
  });
});
