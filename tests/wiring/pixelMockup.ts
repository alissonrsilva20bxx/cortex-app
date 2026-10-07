/**
 * Peças comuns dos testes de pixel que leem o PRÓPRIO mockup normativo
 * (docs/jornada/referencias/5-telas-8-temas-claro-escuro.html):
 * pixel-financeiro.test.ts e pixel-inicio.test.ts.
 *
 *  - `celular(tela)`: o HTML do celular de uma tela no mockup;
 *  - `Mockup`: acha um elemento do celular (pelo texto, pelo fim do
 *    estilo, pelo pai) e devolve o `style=""` dele como objeto;
 *  - `esperarEstilo`: o fonte do app tem um objeto de estilo com todos os
 *    valores do mockup (constantes `...NOME` resolvidas, inclusive entre
 *    os arquivos passados juntos);
 *  - `variaveisDoMockup` / `variaveisDoApp`: os tokens `--t-*` dos dois
 *    lados, por tema e modo.
 *
 * Não é teste (não termina em .test.ts): o vitest só roda `*.test.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
export const read = (p: string) =>
  readFileSync(join(ROOT, p), "utf-8").replace(/\r\n/g, "\n");

export const MOCKUP = read(
  "docs/jornada/referencias/5-telas-8-temas-claro-escuro.html"
);
export const CSS = read("styles/globals.css");

export const TEMAS = [
  "grafite",
  "pink-neon",
  "purple",
  "crimson",
  "ocean",
  "gold",
  "emerald",
  "midnight",
] as const;

export type Estilo = Record<string, string>;

/** O celular de uma tela no mockup (pink-neon), até o próximo celular. */
export function celular(tela: string, modo: "light" | "dark" = "light") {
  const ini = MOCKUP.indexOf(
    `<div class="ph" data-t="${tela}" data-tm="pink-neon" data-md="${modo}"`
  );
  if (ini === -1) throw new Error(`celular ${tela}/${modo} não achado`);
  const fim = MOCKUP.indexOf('<div class="ph"', ini + 10);
  return MOCKUP.slice(ini, fim === -1 ? undefined : fim);
}

const camel = (p: string) => p.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
/** Sem aspas e sem espaço: "repeat(2, minmax(0, 1fr))" = repeat(2,minmax(0,1fr)). */
export const norm = (v: string) => v.replace(/["'\s]/g, "");
export const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `font-size: 36px;font-weight:800` -> { fontSize: "36px", fontWeight: "800" }.
 * Propriedade repetida: vale a última (como no navegador). */
export function cssInline(estilo: string): Estilo {
  const out: Estilo = {};
  for (const d of estilo.split(";")) {
    const i = d.indexOf(":");
    if (i === -1) continue;
    out[camel(d.slice(0, i).trim())] = norm(d.slice(i + 1));
  }
  return out;
}

/** Localizadores de elemento dentro de um celular do mockup. */
export function Mockup(html: string) {
  return {
    html,
    /** O estilo do elemento cujo texto próprio começa com `texto`
     * (um `<svg>` antes do texto é pulado). */
    doTexto(texto: string): Estilo {
      const m = html.match(
        new RegExp(
          `<(\\w+)[^>]*? style="([^"]*)"[^>]*>\\s*(?:<svg[\\s\\S]*?</svg>)?${escapar(texto)}`
        )
      );
      if (!m) throw new Error(`"${texto}" não está no mockup`);
      return cssInline(m[2]);
    },
    /** O estilo inteiro do primeiro elemento cujo style contém `pedaco`. */
    doConteiner(pedaco: string): Estilo {
      const m = html.match(
        new RegExp(`style="([^"]*${escapar(pedaco)}[^"]*)"`)
      );
      if (!m) throw new Error(`nenhum style do mockup contém "${pedaco}"`);
      return cssInline(m[1]);
    },
    /** O estilo do primeiro elemento cujo style termina em `fim`. */
    queTermina(fim: string): Estilo {
      const m = html.match(new RegExp(`style="([^"]*${escapar(fim)})"`));
      if (!m) throw new Error(`nenhum style do mockup termina em "${fim}"`);
      return cssInline(m[1]);
    },
    /** O estilo do elemento que abre logo antes de `filho` (o pai dele). */
    doPai(filho: string): Estilo {
      const i = html.indexOf(filho);
      if (i === -1) throw new Error(`"${filho}" não está no mockup`);
      const m = html.slice(0, i).match(/style="([^"]*)">\s*$/);
      if (!m)
        throw new Error(`"${filho}" não abre logo depois de um pai com style`);
      return cssInline(m[1]);
    },
  };
}

/** Separa por vírgula de nível zero (fora de aspas, parênteses e chaves). */
function partes(corpo: string): string[] {
  const out: string[] = [];
  let nivel = 0;
  let aspas: string | null = null;
  let atual = "";
  for (const c of corpo) {
    if (aspas) {
      if (c === aspas) aspas = null;
    } else if (c === '"' || c === "'" || c === "`") aspas = c;
    else if ("([{".includes(c)) nivel++;
    else if (")]}".includes(c)) nivel--;
    else if (c === "," && nivel === 0) {
      out.push(atual);
      atual = "";
      continue;
    }
    atual += c;
  }
  if (atual.trim()) out.push(atual);
  return out.map((p) => p.trim()).filter(Boolean);
}

/**
 * Todos os objetos de estilo de um fonte: `style={{ ... }}` e
 * `[export] const NOME[: CSSProperties] = { ... }`, com os `...NOME`
 * resolvidos.
 */
export function objetosDeEstilo(src: string): Estilo[] {
  /** O corpo entre `{` (em `abre`) e a `}` que o fecha. */
  const corpoDe = (abre: number): string => {
    let nivel = 0;
    for (let i = abre; i < src.length; i++) {
      if (src[i] === "{") nivel++;
      else if (src[i] === "}" && --nivel === 0) return src.slice(abre + 1, i);
    }
    return "";
  };
  const constantes: Record<string, string> = {};
  for (const m of src.matchAll(/const (\w+)(?:: CSSProperties)? = \{/g))
    constantes[m[1]] = corpoDe(m.index! + m[0].length - 1);
  const corpos = [
    ...Object.values(constantes),
    // `style={{` -> a chave de dentro está 7 caracteres depois do "s".
    ...[...src.matchAll(/style=\{\{/g)].map((m) => corpoDe(m.index! + 7)),
  ];
  const ler = (corpo: string, fundo = 0): Estilo => {
    const out: Estilo = {};
    for (const p of partes(corpo)) {
      if (p.startsWith("...")) {
        const nome = p.slice(3).trim();
        if (constantes[nome] && fundo < 3)
          Object.assign(out, ler(constantes[nome], fundo + 1));
        continue;
      }
      const i = p.indexOf(":");
      if (i === -1) continue;
      out[p.slice(0, i).trim()] = norm(p.slice(i + 1));
    }
    return out;
  };
  return corpos.map((c) => ler(c));
}

/** Um valor do fonte bate com o do mockup: igual, ou um dos lados de um
 * ternário (`sobe ? "var(--t-gsoft)" : "var(--t-rsoft)"`). */
function bate(fonte: string | undefined, mockup: string): boolean {
  if (fonte === undefined) return false;
  if (fonte === mockup) return true;
  return fonte.includes("?") && fonte.split(/[?:]/).some((l) => l === mockup);
}

/**
 * O fonte tem um objeto de estilo com todos os valores do mockup. Os
 * arquivos são lidos juntos, então uma constante exportada de um (ex.:
 * `CARD_PEQUENO` de pecasMockup.tsx) é resolvida no outro.
 */
export function esperarEstilo(
  arquivos: string[],
  esperado: Estilo,
  descricao: string,
  ignorar: string[] = []
) {
  const alvo = Object.entries(esperado).filter(([k]) => !ignorar.includes(k));
  const objetos = objetosDeEstilo(arquivos.map(read).join("\n"));
  const achou = objetos.some((o) => alvo.every(([k, v]) => bate(o[k], v)));
  if (!achou) {
    // Mensagem útil: o objeto mais parecido e o que falta nele.
    const melhor = objetos
      .map((o) => ({ o, falta: alvo.filter(([k, v]) => !bate(o[k], v)) }))
      .sort((a, b) => a.falta.length - b.falta.length)[0];
    throw new Error(
      `${descricao}: nenhum estilo em ${arquivos.join(", ")} tem ` +
        `${JSON.stringify(Object.fromEntries(alvo))}; o mais perto falta ` +
        `${JSON.stringify(Object.fromEntries(melhor?.falta ?? []))}`
    );
  }
}

/** `--t-*` de um corpo de regra CSS. A última declaração do bloco do
 * mockup vem sem ";". */
function variaveis(corpo: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of corpo.matchAll(/(--t-[\w-]+)\s*:\s*([^;]+?)\s*(?=;|$)/g))
    out[m[1]] = m[2].replace(/\s+/g, "");
  return out;
}

export function variaveisDoMockup(
  tema: string,
  modo: "light" | "dark"
): Record<string, string> | null {
  const m = MOCKUP.match(
    new RegExp(
      `\\.ph\\[data-tm="${tema}"\\]\\[data-md="${modo}"\\]\\s*\\{([^}]*)\\}`
    )
  );
  return m ? variaveis(m[1]) : null;
}

export function variaveisDoApp(
  tema: string,
  modo: "light" | "dark"
): Record<string, string> | null {
  const bloco = CSS.slice(
    CSS.indexOf("/* ── Tokens do mockup normativo (--t-*)")
  );
  const seletor =
    modo === "light"
      ? `[data-mode="light"][data-theme="${tema}"]`
      : `[data-theme="${tema}"]`;
  // O seletor exato abre uma regra (sozinho ou numa lista com vírgula).
  const regra = [...bloco.matchAll(/([^{}]+)\{([^}]*)\}/g)].find((r) =>
    r[1].split(",").some((s) => s.trim() === seletor)
  );
  return regra ? variaveis(regra[2]) : null;
}

/** Todos os `var(--t-*)` que um fonte usa. */
export function tokensUsados(src: string): string[] {
  return [
    ...new Set([...src.matchAll(/var\((--t-[\w-]+)\)/g)].map((m) => m[1])),
  ];
}
