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
  // ── Política do acesso lembrado ──
  // `redeCache.acessoLembrado(userId)` guarda o ÚLTIMO resultado CONCLUSIVO
  // de `verificarAcessoConvite` (true/false; `undefined` = ainda não houve
  // nenhum nesta sessão). Um resultado `indeterminado` (offline, 5xx,
  // sessão) NUNCA o altera.
  //
  //  - Validade: escopo do MÓDULO -- sobrevive ao remount do PIN e ao iOS
  //    descartar a aba do PWA; morre num cold start (reload) e some no
  //    logout/troca de conta (`limparTudo`). NÃO é persistido em
  //    localStorage de propósito: num cold start sempre revalidamos contra
  //    o servidor (spinner) ANTES de exibir qualquer conteúdo da Rede.
  //  - Uso: só decide se o `<RedeTab>` monta OTIMISTA (com o Feed cacheado)
  //    enquanto a revalidação roda em 2º plano -- em vez de repetir o
  //    spinner a cada destravamento de PIN. Nunca é autorização: cada query
  //    dentro do RedeTab passa pela RLS do servidor.
  //  - Revalidação: no mount (abaixo) e toda vez que a aba volta a ficar
  //    visível (`visibilitychange`) -- cobre "convite revogado enquanto o
  //    PWA esteve em segundo plano" mesmo sem PIN no meio. Um resultado
  //    conclusivo de "sem convite" desmonta o RedeTab e zera memória +
  //    localStorage na hora.
  //  - Janela de exposição: entre o mount otimista e a revalidação
  //    resolver, o conteúdo cacheado fica visível. Isso é uma ida ao
  //    servidor -- instantânea no caso comum; até ~7s se a rede estiver
  //    caída (3 retries do postgrest-js), mas aí o resultado é
  //    `indeterminado` e nada é descartado. Só um `200` sem convite
  //    descarta, e aí sim na mesma hora.
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

    /** Aplica um resultado de `verificarAcessoConvite`. `indeterminado`
     * (offline/5xx/sessão) não mexe em nada além de encerrar o spinner
     * inicial -- o conteúdo cacheado, se houver, continua em tela. Só um
     * resultado conclusivo troca `unlocked` e, se for "sem convite", zera
     * TODO o cache. */
    const aplicar = (resultado: {
      unlocked: boolean;
      indeterminado?: unknown;
    }) => {
      if (!ativo) return;
      if (resultado.indeterminado) {
        setVerificandoAcesso(false);
        return;
      }
      redeCache.lembrarAcesso(usuario.id, resultado.unlocked);
      if (resultado.unlocked) {
        setUnlocked(true);
      } else {
        // Resposta que CHEGOU sem convite resgatado -- acesso revogado ou
        // nunca concedido. Descarta TODO o conteúdo: desmonta o <RedeTab>
        // (some da tela) + zera cache em memória e localStorage (req 1 e 3).
        setUnlocked(false);
        redeCache.limparTudo();
        redeCachePersist.limpar(usuario.id);
      }
      setVerificandoAcesso(false);
    };

    verificarAcessoConvite(supabase, usuario.id).then(aplicar);

    // Aba volta a ficar visível (PWA saiu do 2º plano, troca de app no
    // celular): revalida. Cobre "convite revogado enquanto esteve fora"
    // mesmo quando não houve remount do PIN pra disparar o check do mount.
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      verificarAcessoConvite(supabase, usuario.id).then(aplicar);
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
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
