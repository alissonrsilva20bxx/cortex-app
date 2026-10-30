/** Rótulos que só o leitor de tela lê nos formulários de dinheiro
 * (components/financeiro/DespesaForm.tsx e ReceitaForm.tsx): o nome do
 * diálogo e o `aria-label` do campo de data, que não tem rótulo visível.
 * Fora de constante, esses textos ficam para trás na tradução.
 *
 * O resto do texto desses dois formulários (título, categorias, botões,
 * avisos) continua no código, como nos outros campos do mesmo padrão
 * antigo: entra na mesma passada da tradução. */
export const TEXTOS_FINANCEIRO = {
  despesa: { titulo: "Nova Despesa" },
  receita: { titulo: "Nova Entrada" },
  data: "Data",
} as const;
