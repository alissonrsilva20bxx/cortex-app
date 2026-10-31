/** Rótulos dos formulários de dinheiro (components/financeiro/DespesaForm.tsx
 * e ReceitaForm.tsx): o nome do diálogo, o `aria-label` do campo de data,
 * que não tem rótulo visível, e o título que a pessoa lê na Nova Despesa --
 * o mesmo texto que o FAB usa no rótulo da folha (components/FAB.tsx, R25).
 * Fora de constante, esses textos ficam para trás na tradução.
 *
 * O resto do texto dos dois formulários (o título da Nova Entrada, as
 * categorias, os botões, os avisos) continua no código, como nos outros
 * campos do mesmo padrão antigo: entra na mesma passada da tradução. */
export const TEXTOS_FINANCEIRO = {
  despesa: { titulo: "Nova Despesa" },
  receita: { titulo: "Nova Entrada" },
  data: "Data",
} as const;
