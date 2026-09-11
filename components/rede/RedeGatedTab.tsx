"use client";

import { useEffect, useState } from "react";
import { RedeTeaserGate, type GateSheet } from "./RedeTeaserGate";
import { SerialKeySheet } from "./SerialKeySheet";
import { RedeTab } from "./RedeTab";
import { supabase } from "@/lib/supabase";
import { verificarAcessoConvite, type AcessoConvite } from "@/lib/rede/acesso";
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
  // ── Política do acesso lembrado (limite explícito) ──
  // `verificarAcessoConvite` classifica cada resposta em `unlocked` +
  // `motivo`. `redeCache` guarda só o resultado CONCLUSIVO (`200`) com um
  // carimbo de tempo; `acessoConfirmadoValido` diz se esse carimbo ainda
  // está dentro da janela `ACESSO_CONFIRMADO_TTL_MS` (90s).
  //
  //  - **Dentro da validade:** ao destravar o PIN o `<RedeTab>` monta na
  //    hora com o Feed cacheado, e a revalidação roda em 2º plano. Nunca é
  //    autorização -- cada query do RedeTab passa pela RLS do servidor.
  //  - **Vencida (ou nunca confirmado nesta sessão de JS):** spinner, e a
  //    revalidação roda ANTES de exibir qualquer conteúdo privado. Cold
  //    start cai sempre aqui (o carimbo é memória, não é persistido).
  //  - **`indisponivel`** (offline / 5xx): não conclui nada. Preserva o
  //    conteúdo em tela SÓ enquanto o acesso confirmado seguir válido;
  //    passou de 90s sem uma confirmação nova, o conteúdo privado SAI da
  //    tela (não fica lembrado indefinidamente em cima de indeterminados).
  //  - **`sessao`** (401 e o refresh da sessão falhou), **`negado`** (403 /
  //    4xx), **`sem_convite`** (200 sem convite): DERRUBAM -- desmontam o
  //    RedeTab e zeram memória + localStorage na hora. Perda de
  //    autorização tira o conteúdo privado da tela; não usamos "a RLS
  //    filtraria" como desculpa pra continuar exibindo dado local.
  //  - **Revalidação extra:** ao a aba voltar a ficar visível
  //    (`visibilitychange`) e ao reconectar (`online`) -- cobre revogação
  //    com o PWA em 2º plano, sem depender de um remount do PIN.
  const [unlocked, setUnlocked] = useState(() =>
    redeCache.acessoConfirmadoValido(usuario.id)
  );
  const [verificandoAcesso, setVerificandoAcesso] = useState(
    () => !redeCache.acessoConfirmadoValido(usuario.id)
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

    const derrubar = () => {
      // Perdeu (ou nunca teve) autorização: conteúdo privado sai da tela +
      // zera memória e localStorage.
      setUnlocked(false);
      redeCache.limparTudo();
      redeCachePersist.limpar(usuario.id);
      setVerificandoAcesso(false);
    };

    /** Aplica um resultado de `verificarAcessoConvite`. */
    const aplicar = (resultado: AcessoConvite) => {
      if (!ativo) return;
      if (resultado.unlocked) {
        redeCache.lembrarAcesso(usuario.id, true);
        setUnlocked(true);
        setVerificandoAcesso(false);
        return;
      }
      if (resultado.motivo === "indisponivel") {
        // Não conclui nada. Se ainda há um acesso confirmado dentro da
        // validade, segue mostrando o conteúdo cacheado; senão, o conteúdo
        // privado não pode ficar em tela sem confirmação -- vai pro gate
        // (SEM zerar o cache: offline pode se recuperar).
        if (redeCache.acessoConfirmadoValido(usuario.id)) {
          setVerificandoAcesso(false);
        } else {
          setUnlocked(false);
          setVerificandoAcesso(false);
        }
        return;
      }
      // "sem_convite" | "sessao" | "negado" -> derruba.
      derrubar();
    };

    verificarAcessoConvite(supabase, usuario.id).then(aplicar);

    // Revalida quando a aba volta a ficar visível (PWA saiu do 2º plano,
    // troca de app no celular) e quando a conexão volta -- cobre "convite
    // revogado enquanto esteve fora" sem depender de um remount do PIN.
    const revalidar = () => {
      if (document.visibilityState !== "visible") return;
      verificarAcessoConvite(supabase, usuario.id).then(aplicar);
    };
    document.addEventListener("visibilitychange", revalidar);
    window.addEventListener("online", revalidar);

    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", revalidar);
      window.removeEventListener("online", revalidar);
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
