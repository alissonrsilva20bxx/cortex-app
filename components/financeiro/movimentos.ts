/**
 * As movimentações do Financeiro (Recentes e Mais lançamentos). Fica em
 * `.ts` (não `.tsx`) pra ter teste de verdade: o vitest deste projeto roda
 * em "node", sem JSX -- mesmo motivo do components/home/inicioAgenda.ts.
 */
import { diaDoDinheiro } from "@/lib/finance";
import type { Job, Despesa, ReceitaAvulsa } from "@/lib/types";

export interface Movement {
  id: string;
  desc: string;
  valor: number;
  data: string;
  positive: boolean;
}

/**
 * Movimentações recentes — 100% dado real (jobs concluídos + receitas
 * avulsas + despesas), nunca as 3 linhas fixas que o protótipo usa como
 * ilustração (um atendimento, uma assinatura, outro atendimento). Só
 * leitura: ao
 * contrário do protótipo (onde tocar uma linha abre o sheet "novo-movimento"
 * pra editar), aqui não há um fluxo real de "editar movimentação genérica"
 * — jobs se editam pela Agenda, despesas/receitas pelas próprias sub-abas
 * Entradas/Saídas (listar/criar/excluir, preservadas intactas). Inventar
 * um clique que leva a lugar nenhum seria pior que não ter clique nenhum;
 * por isso as linhas são `<div>`, não `<button>`.
 */
export function buildMovements(
  jobs: Job[],
  despesas: Despesa[],
  receitas: ReceitaAvulsa[]
): Movement[] {
  const jobM: Movement[] = jobs
    .filter((j) => j.status === "concluído")
    .map((j) => ({
      id: `job-${j.id}`,
      desc: j.clienteNome,
      valor: j.valor,
      // Entra no extrato no dia em que o dinheiro entrou (migration 0037).
      data: diaDoDinheiro(j),
      positive: true,
    }));
  const recM: Movement[] = receitas.map((r) => ({
    id: `rec-${r.id}`,
    desc: r.descricao,
    valor: r.valor,
    data: r.data,
    positive: true,
  }));
  const despM: Movement[] = despesas.map((d) => ({
    id: `desp-${d.id}`,
    desc: d.descricao,
    valor: d.valor,
    data: d.data,
    positive: false,
  }));
  return [...jobM, ...recM, ...despM]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 10);
}
