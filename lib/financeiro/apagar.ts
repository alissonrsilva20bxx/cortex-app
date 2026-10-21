/**
 * Apagar entrada ou despesa: tira da tela na hora e, se o banco não apagou,
 * devolve a linha ao lugar de antes. "Não apagou" é erro do banco OU nenhuma
 * linha apagada (a regra de acesso pode barrar sem dar erro). Fica em `.ts`
 * para ter teste de verdade.
 */

export type ResultadoApagar = {
  data: unknown[] | null;
  error: { message: string } | null;
};

export interface PedidoApagar<T extends { id: string }> {
  /** A lista que está na tela agora. */
  lista: readonly T[];
  id: string;
  /** Troca a lista da tela (função, para nunca pisar em outra mudança). */
  atualizar: (f: (anterior: T[]) => T[]) => void;
  /** O delete no banco, devolvendo as linhas apagadas. */
  apagar: () => PromiseLike<ResultadoApagar>;
}

/** `true` se o banco apagou; `false` se falhou (e a tela já voltou). */
export async function apagarLancamento<T extends { id: string }>({
  lista,
  id,
  atualizar,
  apagar,
}: PedidoApagar<T>): Promise<boolean> {
  const indice = lista.findIndex((x) => x.id === id);
  if (indice === -1) return true;
  const item = lista[indice];

  atualizar((anterior) => anterior.filter((x) => x.id !== id));

  let resultado: ResultadoApagar;
  try {
    resultado = await apagar();
  } catch (e) {
    resultado = {
      data: null,
      error: { message: e instanceof Error ? e.message : "falha de rede" },
    };
  }

  if (resultado.error || !resultado.data || resultado.data.length === 0) {
    console.error(
      "[apagarLancamento] não apagou:",
      resultado.error?.message ?? "nenhuma linha apagada"
    );
    atualizar((anterior) => {
      if (anterior.some((x) => x.id === id)) return anterior;
      const volta = [...anterior];
      volta.splice(Math.min(indice, volta.length), 0, item);
      return volta;
    });
    return false;
  }
  return true;
}
