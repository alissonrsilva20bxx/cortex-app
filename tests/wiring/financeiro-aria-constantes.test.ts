import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEXTOS_FINANCEIRO } from "@/lib/textosFinanceiro";

/**
 * R23 (achado B5 da R21rev): os rótulos que só o leitor de tela lê (o
 * `aria-label` do campo de data e o nome do diálogo) estavam escritos no
 * código em DespesaForm e ReceitaForm. Fora de constante, ficam para trás
 * na tradução. O resto do texto desses formulários continua no código: é o
 * padrão antigo do arquivo, para uma passada só quando a tradução começar.
 */
const ler = (f: string) =>
  readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

const despesa = ler("components/financeiro/DespesaForm.tsx");
const receita = ler("components/financeiro/ReceitaForm.tsx");

describe("Financeiro: o rótulo do leitor de tela mora na constante", () => {
  it("os textos são os mesmos de antes", () => {
    expect(TEXTOS_FINANCEIRO.data).toBe("Data");
    expect(TEXTOS_FINANCEIRO.despesa.titulo).toBe("Nova Despesa");
    expect(TEXTOS_FINANCEIRO.receita.titulo).toBe("Nova Entrada");
  });

  it("Nova Despesa usa a constante no campo de data e no nome do diálogo", () => {
    expect(despesa).toMatch(/aria-label=\{TEXTOS_FINANCEIRO\.data\}/);
    expect(despesa).toMatch(
      /aria-label=\{TEXTOS_FINANCEIRO\.despesa\.titulo\}/
    );
    expect(despesa).not.toMatch(/aria-label="Data"/);
    expect(despesa).not.toMatch(/aria-label="Nova Despesa"/);
  });

  it("Nova Entrada usa a constante no campo de data e no nome do diálogo", () => {
    expect(receita).toMatch(/aria-label=\{TEXTOS_FINANCEIRO\.data\}/);
    expect(receita).toMatch(
      /aria-label=\{TEXTOS_FINANCEIRO\.receita\.titulo\}/
    );
    expect(receita).not.toMatch(/aria-label="Data"/);
    expect(receita).not.toMatch(/aria-label="Nova Entrada"/);
  });
});
