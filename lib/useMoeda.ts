"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  MOEDA_PADRAO,
  assinarMoeda,
  formatMoeda,
  moedaSalva,
  type Moeda,
} from "@/lib/moeda";

/** A moeda escolhida neste aparelho; a tela redesenha quando ela muda. */
export function useMoeda(): Moeda {
  return useSyncExternalStore(assinarMoeda, moedaSalva, () => MOEDA_PADRAO);
}

/** `formatMoeda` já com a moeda escolhida: `fmt(valor)` ou `fmt(valor, 2)`. */
export function useFormatMoeda(): (valor: number, casas?: number | "auto") => string {
  const moeda = useMoeda();
  return useCallback(
    (valor: number, casas: number | "auto" = 0) => formatMoeda(valor, moeda, casas),
    [moeda]
  );
}
