"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { listarWishlistItems, type WishlistItem } from "@/lib/rede/wishlist";
import {
  desejoPrincipal,
  progressoDesejo,
  textoPrazo,
} from "@/lib/desejo/desejo";
import { useAoMudarDesejos } from "@/lib/desejo/eventos";
import { TEXTOS_DESEJO as T } from "@/lib/desejo/textos";
import { formatEUR } from "@/lib/guardar/valor";
import { InicioCard } from "./InicioCard";
import {
  CARD_PEQUENO,
  IconeCard,
  ROTULO_CARD,
  VALOR_CARD,
} from "./pecasMockup";

interface Props {
  userId: string;
  onGoToMetas: () => void;
}

function IconeDesejo() {
  return (
    <IconeCard>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </IconeCard>
  );
}

/**
 * Card "Desejo" da Início: o Desejo principal (mesma regra da Jornada),
 * com o mesmo progresso de Finanças e da Rede. Tocar leva a Finanças ›
 * Metas, onde o Desejo é criado e editado.
 */
export function DesejoCard({ userId, onGoToMetas }: Props) {
  const [itens, setItens] = useState<WishlistItem[] | null>(null);

  const carregar = useCallback(async () => {
    try {
      setItens(await listarWishlistItems(supabase, userId));
    } catch (e) {
      console.error("[DesejoCard] carregar:", e);
      setItens((atual) => atual ?? []);
    }
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useAoMudarDesejos(carregar);

  const lista = itens ?? [];
  const principal = desejoPrincipal(lista);

  if (!principal) {
    return (
      <InicioCard onClick={onGoToMetas} style={CARD_PEQUENO}>
        <IconeDesejo />
        <span style={ROTULO_CARD}>{T.nome}</span>
        <span style={{ fontSize: "13px", fontWeight: 700 }}>
          {lista.length > 0 ? T.todosConquistados : T.criar}
        </span>
      </InicioCard>
    );
  }

  const pct = progressoDesejo(principal.valorAtual, principal.valorAlvo);
  const prazo = textoPrazo(principal.prazo);
  const valores = T.deAte(
    formatEUR(principal.valorAtual),
    formatEUR(principal.valorAlvo)
  );

  return (
    <InicioCard
      onClick={onGoToMetas}
      ariaLabel={`${T.nome}: ${principal.nome}, ${valores}`}
      style={CARD_PEQUENO}
    >
      <IconeDesejo />
      <span style={ROTULO_CARD}>{T.nome}</span>
      <span style={{ ...VALOR_CARD, fontSize: "15px" }}>{principal.nome}</span>
      <span style={{ fontSize: "12px", fontWeight: 600 }}>{valores}</span>
      <div
        aria-hidden
        style={{
          height: "5px",
          borderRadius: "3px",
          background: "var(--t-line)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "5px",
            background: "var(--t-acc)",
          }}
        />
      </div>
      {prazo && (
        <span style={{ ...ROTULO_CARD, fontSize: "11px" }}>{prazo}</span>
      )}
    </InicioCard>
  );
}
