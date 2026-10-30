import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R21 (auditoria, acessibilidade básica): no "Novo atendimento" os rótulos
 * não estavam ligados aos campos (Data, Hora e Status sem nome no leitor de
 * tela) e Presencial/Online não diziam qual está marcado. Em Nova Despesa e
 * Nova Entrada, a data ficava sem nome e as categorias sem estado marcado.
 * Nada muda na tela.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("Novo atendimento: cada rótulo aponta para o seu campo", () => {
  const src = ler("components/jobs/JobForm.tsx");

  it("todo <label> tem htmlFor e o campo tem o id", () => {
    const labels = src.match(/<label\b[^>]*>/g) ?? [];
    expect(labels.length).toBe(7);
    for (const l of labels) expect(l).toMatch(/htmlFor=\{ids\.\w+\}/);
    for (const campo of [
      "cliente",
      "data",
      "hora",
      "valor",
      "local",
      "status",
      "observacoes",
    ])
      expect(src).toContain(`id={ids.${campo}}`);
  });

  it("Modalidade é um grupo com nome e o botão marcado diz que está marcado", () => {
    expect(src).toMatch(/role="group"\s+aria-labelledby=\{ids\.modalidade\}/);
    expect(src).toMatch(/aria-pressed=\{form\.modalidade === m\}/);
  });
});

describe("Nova Despesa e Nova Entrada", () => {
  for (const f of [
    "components/financeiro/DespesaForm.tsx",
    "components/financeiro/ReceitaForm.tsx",
  ]) {
    const src = ler(f);
    it(`${f}: a data tem nome e a categoria marcada diz que está marcada`, () => {
      expect(src).toMatch(/type="date"\s+aria-label="Data"/);
      expect(src).toMatch(/const active = categoria === c\.id;/);
      expect(src).toMatch(/key=\{c\.id\}\s+aria-pressed=\{active\}/);
    });
  }
});
