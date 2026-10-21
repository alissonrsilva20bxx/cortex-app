import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { apagarLancamento } from "@/lib/financeiro/apagar";

/**
 * Apagar entrada/despesa: a linha sai da tela na hora e volta, no mesmo
 * lugar, se o banco não apagou (erro, nenhuma linha apagada ou rede caída).
 */

type Linha = { id: string; descricao: string };
const lista: Linha[] = [
  { id: "a", descricao: "Aluguel" },
  { id: "b", descricao: "Material" },
  { id: "c", descricao: "Estacionamento" },
];

/** Uma "tela" de mentira: guarda a lista e deixa ver cada estado pelo caminho. */
function tela(inicial: Linha[]) {
  let atual = inicial;
  const historico: string[][] = [];
  return {
    atualizar: (f: (a: Linha[]) => Linha[]) => {
      atual = f(atual);
      historico.push(atual.map((x) => x.id));
    },
    get atual() {
      return atual;
    },
    historico,
  };
}

describe("apagarLancamento", () => {
  it("o banco apagou: a linha sai da tela e fica fora", async () => {
    const t = tela(lista);
    const ok = await apagarLancamento({
      lista,
      id: "b",
      atualizar: t.atualizar,
      apagar: async () => ({ data: [{ id: "b" }], error: null }),
    });
    expect(ok).toBe(true);
    expect(t.atual.map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("a linha sai da tela ANTES de o banco responder", async () => {
    const t = tela(lista);
    let naHora: string[] = [];
    await apagarLancamento({
      lista,
      id: "a",
      atualizar: t.atualizar,
      apagar: async () => {
        naHora = t.atual.map((x) => x.id);
        return { data: [{ id: "a" }], error: null };
      },
    });
    expect(naHora).toEqual(["b", "c"]);
  });

  it("erro do banco: a linha volta para o mesmo lugar", async () => {
    const t = tela(lista);
    const ok = await apagarLancamento({
      lista,
      id: "b",
      atualizar: t.atualizar,
      apagar: async () => ({ data: null, error: { message: "sem permissão" } }),
    });
    expect(ok).toBe(false);
    expect(t.atual.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("nenhuma linha apagada (regra de acesso barrou sem erro): volta", async () => {
    const t = tela(lista);
    const ok = await apagarLancamento({
      lista,
      id: "c",
      atualizar: t.atualizar,
      apagar: async () => ({ data: [], error: null }),
    });
    expect(ok).toBe(false);
    expect(t.atual.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("rede caída (a chamada lança): volta", async () => {
    const t = tela(lista);
    const ok = await apagarLancamento({
      lista,
      id: "a",
      atualizar: t.atualizar,
      apagar: async () => {
        throw new Error("Failed to fetch");
      },
    });
    expect(ok).toBe(false);
    expect(t.atual.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("se a lista recarregou no meio e já tem a linha, não duplica", async () => {
    const t = tela(lista);
    const ok = await apagarLancamento({
      lista,
      id: "b",
      atualizar: t.atualizar,
      apagar: async () => {
        t.atualizar(() => [...lista]); // recarga trouxe tudo de novo
        return { data: null, error: { message: "x" } };
      },
    });
    expect(ok).toBe(false);
    expect(t.atual.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("FinanceiroTab: a lixeira pede confirmação e confere o resultado", () => {
  const src = readFileSync(
    join(__dirname, "..", "..", "components/financeiro/FinanceiroTab.tsx"),
    "utf-8"
  );

  it("a lixeira só abre a confirmação (não apaga)", () => {
    expect(src).toMatch(
      /function deleteDespesa\(id: string\) \{[\s\S]*?setApagando\(/
    );
    expect(src).toMatch(
      /function deleteReceita\(id: string\) \{[\s\S]*?setApagando\(/
    );
    expect(src).not.toMatch(
      /function delete(Despesa|Receita)[\s\S]{0,200}\.delete\(\)/
    );
  });

  it("só 'Apagar' no sheet apaga, pelo helper que confere erro e linhas apagadas", () => {
    expect(src).toMatch(/if \(apagando\) void confirmarApagar\(apagando\)/);
    expect(src).toContain('.delete().eq("id", alvo.id).select("id")');
    expect(src).toContain("apagarLancamento(");
    expect(src).toContain("toast.error(APAGAR.falhou)");
  });

  it("apagou de verdade: avisa a página (só no sucesso), que sobe financeiroRefreshKey para o Início refazer a meta", () => {
    expect(src).toMatch(
      /if \(!ok\) toast\.error\(APAGAR\.falhou\);\s*else onLancamentoApagado\?\.\(\);/
    );
    const pagina = readFileSync(
      join(__dirname, "..", "..", "app/page.tsx"),
      "utf-8"
    );
    expect(pagina).toContain(
      "onLancamentoApagado={() => setFinanceiroRefreshKey((k) => k + 1)}"
    );
  });
});
