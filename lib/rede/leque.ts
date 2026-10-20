/**
 * O par de fotos em leque (modelo Doca, components/rede/LequeFotos.tsx).
 * Lógica pura, testada em tests/lib/redeDoca.test.ts.
 */

/** Altura do leque pela largura do cartão: fechado, a foto da frente
 * (58% da largura, 4:5) mais o giro e a dica; aberto, as duas lado a lado
 * (49% cada) e a dica embaixo. Sem largura medida ainda, um valor seguro
 * para 390 px. */
export function alturaDoLeque(largura: number, aberto: boolean): number {
  if (largura <= 0) return aberto ? 254 : 290;
  return aberto
    ? Math.round(largura * 0.49 * 1.25 + 46)
    : Math.round(largura * 0.58 * 1.25 + 46);
}
