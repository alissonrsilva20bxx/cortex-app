/**
 * Percentual de uma meta: quanto entrou no período sobre o valor-alvo,
 * limitado a 100. É exatamente a conta que `MetasTab` sempre fez; vive
 * aqui pra o card "Meta" do Financeiro (Jornada J04) usar a MESMA conta,
 * não uma cópia que pode divergir.
 */
export function progressoMeta(atual: number, alvo: number): number {
  return Math.min(100, (atual / alvo) * 100);
}
