"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { lojaDaUsuaria, type RetratoJornada } from "@/lib/jornada/cliente";
import type {
  Acao,
  Comemoracao,
  ErroJornada,
  EstadoJornada,
  Preferencias,
} from "@/lib/jornada/estado";

/**
 * O hook que as telas da Jornada usam (J12 em diante). Nenhuma tela precisa
 * saber que existe Supabase: tudo passa por aqui (J11, #161).
 *
 * - `estado`: o estado atual (ou `null` antes da 1ª carga sem cache).
 * - `carregando`: só `true` quando não há nada pra mostrar ainda.
 * - `erro`: código do último problema (texto em `lib/jornada/textos.ts`).
 * - `registrar(acao)`: registra uma ação e devolve as comemorações que o
 *   servidor mandou. Nunca lança; sem rede, o pedido é guardado e reenviado.
 * - `registrarAbertura()`: chame ao abrir a tela "Sua Jornada" (selo
 *   Primeiros passos). Conta uma vez por abertura do app; é a ÚNICA chamada
 *   segura de fazer num efeito.
 * - `fila` / `proximaComemoracao`: comemorações pendentes, na ordem do
 *   servidor. Persistem entre aberturas do app.
 * - `consumirComemoracao(id)`: tira uma da fila depois de tocada.
 * - `salvarPreferencias(parcial)`: grava som, Modo discreto ou perfil. A
 *   chave muda na hora; se o servidor recusar, volta e devolve `false`.
 *
 * Seguro a montar duas vezes (StrictMode): o efeito só CARREGA e reenvia
 * pendentes, e a loja reaproveita a chamada em andamento. Registrar nunca
 * acontece num efeito.
 */
export interface UsoJornada {
  estado: EstadoJornada | null;
  carregando: boolean;
  erro: ErroJornada | null;
  fila: Comemoracao[];
  proximaComemoracao: Comemoracao | null;
  registrar: (acao: Acao) => Promise<Comemoracao[]>;
  registrarAbertura: () => Promise<Comemoracao[]>;
  consumirComemoracao: (id: string) => void;
  salvarPreferencias: (parcial: Partial<Preferencias>) => Promise<boolean>;
  recarregar: () => Promise<void>;
}

/** No servidor e na hidratação: nada do cache (evita diferença servidor × cliente). */
const RETRATO_SERVIDOR: RetratoJornada = {
  estado: null,
  carregando: true,
  erro: null,
  fila: [],
  pendentes: 0,
};

export function useJornada(userId: string): UsoJornada {
  const loja = useMemo(() => lojaDaUsuaria(userId), [userId]);
  const retrato = useSyncExternalStore(
    loja.assinar,
    loja.retrato,
    () => RETRATO_SERVIDOR
  );

  useEffect(() => {
    void loja.carregar();
    void loja.enviarPendentes();
  }, [loja]);

  const registrar = useCallback((acao: Acao) => loja.registrar(acao), [loja]);
  const registrarAbertura = useCallback(() => loja.registrarAbertura(), [loja]);
  const consumirComemoracao = useCallback(
    (id: string) => loja.consumir(id),
    [loja]
  );
  const salvarPreferencias = useCallback(
    (parcial: Partial<Preferencias>) => loja.salvarPreferencias(parcial),
    [loja]
  );
  const recarregar = useCallback(() => loja.carregar(), [loja]);

  return {
    estado: retrato.estado,
    carregando: retrato.carregando,
    erro: retrato.erro,
    fila: retrato.fila,
    proximaComemoracao: retrato.fila[0] ?? null,
    registrar,
    registrarAbertura,
    consumirComemoracao,
    salvarPreferencias,
    recarregar,
  };
}
