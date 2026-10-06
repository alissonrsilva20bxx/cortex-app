"use client";

/**
 * O host da comemoração da Jornada (J13): liga a fila do hook da J11
 * (`useJornada`) ao palco que toca, de uma em uma, na ordem do servidor.
 *
 * Montagem (é da J15, no app autenticado, UMA vez):
 *
 *   import { ComemoracaoHost } from "@/components/jornada/celebracao/ComemoracaoHost";
 *   <ComemoracaoHost userId={usuario.id} />
 *
 * Não toca nada até o estado da Jornada estar carregado: sem saber se o
 * Modo discreto está ligado, a comemoração espera (é a promessa de
 * discrição -- nada chamativo antes de saber que pode).
 */

import { useEffect, useState } from "react";

import { useJornada } from "@/components/jornada/useJornada";

import { ComemoracaoPalco } from "./ComemoracaoPalco";

function useMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aplicar = () => setReduzido(mq.matches);
    aplicar();
    mq.addEventListener?.("change", aplicar);
    return () => mq.removeEventListener?.("change", aplicar);
  }, []);
  return reduzido;
}

export function ComemoracaoHost({ userId }: { userId: string }) {
  const { estado, fila, consumirComemoracao } = useJornada(userId);
  const movimentoReduzido = useMovimentoReduzido();

  if (!estado) return null;

  return (
    <ComemoracaoPalco
      fila={fila}
      consumir={consumirComemoracao}
      ambiente={{
        somLigado: estado.preferencias.somLigado,
        modoDiscreto: estado.preferencias.modoDiscreto,
        movimentoReduzido,
      }}
    />
  );
}
