import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R25 (sobra da R23): a frase "Nova Despesa" já morava na constante
 * (`lib/textosFinanceiro.ts`), mas continuava escrita no código no título
 * do formulário (DespesaForm) e no rótulo da folha que o FAB abre. Agora
 * sai da constante nos dois lugares: trocar o nome (ou traduzir) é uma
 * linha só. Este teste varre o código do app e falha se o literal voltar.
 */
const RAIZ = process.cwd();

/** Só o código que vai ao ar. A maquete de iPhone
 * (components/ios-prototype) é referência visual, não entra no app
 * (capitão, 27/10). */
const PASTAS = ["app", "components", "lib"];
const IGNORAR = [join("components", "ios-prototype")];
/** O único arquivo onde a frase pode estar escrita: a própria constante. */
const DONO_DO_TEXTO = join("lib", "textosFinanceiro.ts");

function arquivosDe(dir: string): string[] {
  const saida: string[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (IGNORAR.includes(caminho)) continue;
      saida.push(...arquivosDe(caminho));
    } else if (/\.(ts|tsx)$/.test(entrada.name)) {
      saida.push(caminho);
    }
  }
  return saida;
}

const ler = (f: string) =>
  readFileSync(join(RAIZ, f), "utf8").replace(/\r\n/g, "\n");

/** Comentário não chega à tela (o comentário do FAB cita a frase para
 * contar o bug antigo). */
function ehComentario(linha: string): boolean {
  const t = linha.trim();
  return (
    t.startsWith("//") ||
    t.startsWith("/*") ||
    t.startsWith("*") ||
    t.startsWith("{/*")
  );
}

describe("Nova Despesa: o texto mora na constante", () => {
  it("nenhum arquivo do app escreve o literal fora da constante", () => {
    const achados: string[] = [];
    for (const arquivo of PASTAS.flatMap((p) => arquivosDe(join(RAIZ, p)))) {
      const rel = relative(RAIZ, arquivo);
      if (rel === DONO_DO_TEXTO) continue;
      ler(rel)
        .split("\n")
        .forEach((linha, i) => {
          if (!ehComentario(linha) && linha.includes("Nova Despesa")) {
            achados.push(`${rel}:${i + 1}`);
          }
        });
    }
    expect(achados).toEqual([]);
  });

  it("o título que a pessoa lê no formulário vem da constante", () => {
    const fonte = ler("components/financeiro/DespesaForm.tsx");
    const titulos = [...fonte.matchAll(/<h3([\s\S]*?)<\/h3>/g)].map(
      (m) => m[1]
    );
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toContain("{TEXTOS_FINANCEIRO.despesa.titulo}");
  });

  it("o rótulo da folha do FAB na sub-aba saidas vem da mesma constante", () => {
    expect(ler("components/FAB.tsx")).toMatch(
      /saidas:\s*\{[\s\S]*?label:\s*TEXTOS_FINANCEIRO\.despesa\.titulo/
    );
  });
});
