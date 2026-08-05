"use client";

import { useEffect, useState } from "react";
import { RedeTeaserGate, type GateSheet } from "./RedeTeaserGate";
import { SerialKeySheet } from "./SerialKeySheet";
import { RedeTab } from "./RedeTab";
import { supabase } from "@/lib/supabase";
import { verificarAcessoConvite } from "@/lib/rede/acesso";
import type { Usuario } from "@/lib/types";

interface Props {
  usuario: Usuario;
  onChatFocusChange?: (focused: boolean) => void;
}

/** Vitrine → código de acesso → Feed completo. Usado tanto na rota real (/)
 * quanto no shell mockado de /dev-preview/app.
 *
 * `sheet` é o único estado que decide qual dos três sheets do gate (prévia,
 * confirmação de solicitação, campo de código) está visível — centralizado
 * aqui, no pai comum, pra garantir no máximo um aberto por vez. Cada
 * BottomSheet renderiza no mesmo z-index de forma independente, então dois
 * booleanos separados (um em cada componente) já deixaram os três
 * empilharem visualmente ao mesmo tempo. */
export function RedeGatedTab({ usuario, onChatFocusChange }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [verificandoAcesso, setVerificandoAcesso] = useState(true);
  const [sheet, setSheet] = useState<GateSheet>(null);

  // Um convite já resgatado por esse usuário é a única fonte de verdade pra
  // acesso liberado — sem isso, quem já desbloqueou via SerialKeySheet numa
  // sessão anterior cai na tela de gate de novo a cada recarregamento, já
  // que `unlocked` acima é só estado local.
  //
  // ?vitrine=1 na URL força a vitrine a aparecer mesmo numa conta já
  // desbloqueada -- só pra quem está testando/mexendo no fluxo do gate
  // repetidamente sem precisar revogar o convite no banco toda hora. Não é
  // UI (ninguém digita isso sem saber que existe), então não conflita com a
  // decisão de "sem UI de admin" da ticket 03.
  useEffect(() => {
    let ativo = true;
    const forcarVitrine =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("vitrine") === "1";

    if (forcarVitrine) {
      setVerificandoAcesso(false);
      return;
    }

    verificarAcessoConvite(supabase, usuario.id).then((resultado) => {
      if (!ativo) return;
      if (resultado.unlocked) setUnlocked(true);
      setVerificandoAcesso(false);
    });
    return () => {
      ativo = false;
    };
  }, [usuario.id]);

  if (verificandoAcesso) {
    return (
      <div className="flex justify-center pt-12">
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)" }}
        />
      </div>
    );
  }

  if (unlocked) {
    return <RedeTab usuario={usuario} onChatFocusChange={onChatFocusChange} />;
  }

  return (
    <>
      <RedeTeaserGate sheet={sheet} onSheetChange={setSheet} />
      <SerialKeySheet
        open={sheet === "chave"}
        onClose={() => setSheet(null)}
        onConfirm={() => {
          setSheet(null);
          setUnlocked(true);
        }}
      />
    </>
  );
}
