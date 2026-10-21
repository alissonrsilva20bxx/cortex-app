"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listarWishlistItems } from "@/lib/rede/wishlist";
import { desejoPrincipal } from "@/lib/desejo/desejo";
import { useAoMudarDesejos } from "@/lib/desejo/eventos";

/** Ela tem um Desejo ativo (o mesmo "principal" do card Desejo)? Enquanto
 * carrega, ou se a leitura falha, vale `true`: o "Próximo passo" da Jornada
 * só pula o guardar quando se sabe que não há Desejo. */
export function useTemDesejoAtivo(userId: string | undefined): boolean {
  const [tem, setTem] = useState(true);
  const carregar = useCallback(async () => {
    if (!userId) return;
    try {
      const itens = await listarWishlistItems(supabase, userId);
      setTem(desejoPrincipal(itens) !== null);
    } catch (e) {
      console.error("[useTemDesejoAtivo]", e);
    }
  }, [userId]);
  useEffect(() => {
    void carregar();
  }, [carregar]);
  useAoMudarDesejos(carregar);
  return tem;
}
