"use client";

import { useEffect, useState } from "react";
import { RedeTeaserGate, type GateSheet } from "./RedeTeaserGate";
import { SerialKeySheet } from "./SerialKeySheet";
import { RedeTab } from "./RedeTab";
import { supabase } from "@/lib/supabase";
import { verificarAcessoConvite } from "@/lib/rede/acesso";
import * as redeCache from "@/lib/rede/redeCache";
import * as redeCachePersist from "@/lib/rede/redeCachePersist";
import type { Usuario } from "@/lib/types";

interface Props {
  usuario: Usuario;
  /** Se a aba Rede é a selecionada agora (`activeTab === "rede"` no pai).
   * Repassado até o `RedeTab` pra restaurar a rolagem só quando a Rede
   * está de fato visível. */
  active?: boolean;
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
export function RedeGatedTab({
  usuario,
  active = true,
  onChatFocusChange,
}: Props) {
  // Resultado REAL mais recente de `verificarAcessoConvite` nesta sessão
  // (sobrevive ao remount do PIN). `true` ⇒ renderiza o Feed na hora e
  // revalida em segundo plano, em vez de mostrar o spinner de novo. NUNCA
  // é autorização: cada query dentro do RedeTab ainda passa pela RLS do
  // servidor; se o acesso foi revogado, a revalidação abaixo derruba o
  // conteúdo e volta pro gate.
  const acessoLembrado = redeCache.acessoLembrado(usuario.id);
  const [unlocked, setUnlocked] = useState(acessoLembrado === true);
  const [verificandoAcesso, setVerificandoAcesso] = useState(
    acessoLembrado === undefined
  );
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
    // Trocar de conta (ou 1ª vinculação) limpa o cache em memória da conta
    // anterior antes de qualquer leitura do RedeTab.
    redeCache.vincularUsuario(usuario.id);

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

      if (resultado.erro) {
        // Falha de rede: não rebaixa nem limpa nada. Se já havia acesso
        // lembrado, o Feed cacheado continua em tela (req 4).
        setVerificandoAcesso(false);
        return;
      }

      redeCache.lembrarAcesso(usuario.id, resultado.unlocked);
      if (resultado.unlocked) {
        setUnlocked(true);
      } else {
        // Resposta real de "sem convite resgatado": acesso revogado (ou
        // nunca teve). Descarta todo o conteúdo cacheado (req 3).
        setUnlocked(false);
        redeCache.limparTudo();
        redeCachePersist.limpar(usuario.id);
      }
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
    return (
      <RedeTab
        usuario={usuario}
        active={active}
        onChatFocusChange={onChatFocusChange}
      />
    );
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
          redeCache.lembrarAcesso(usuario.id, true);
        }}
      />
    </>
  );
}
