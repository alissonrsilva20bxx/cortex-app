"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

/** A cada 60s (enquanto `estado === "liberado"` ou `"semRede"`) confere se o
 * teto de confiança do carimbo (24h, `ACESSO_CONFIRMADO_TTL_MS`) foi
 * cruzado, e tenta revalidar de novo mesmo sem nenhum `visibilitychange`/
 * `online` disparar -- cobre a tela ficando aberta e em foco pela janela
 * toda sem nunca sair de primeiro plano. 60s é granularidade suficiente pra
 * um teto de 24h; não precisa ser exato ao segundo. */
const INTERVALO_CHECAGEM_TETO_MS = 60_000;

type EstadoGate =
  | "verificando" // nunca confirmado nesta conta (ou carimbo sem corroboração
  //   nenhuma há mais de 24h) -- aguardando a 1ª resposta decisiva.
  | "liberado" // conteúdo confiado: confirmação positiva dentro do teto.
  | "semRede" // tentativa(s) resultaram "indisponivel" e não há carimbo
  //   válido pra confiar -- continua tentando, NUNCA mostra o gate de
  //   convite (falha de rede não é "sem convite").
  | "semAcesso"; // resposta decisiva negativa (ou vitrine forçada/logout
//   simulado): vitrine + campo de código.

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
  // ── Política do acesso lembrado (teto de confiança, não "validade curta") ──
  // `verificarAcessoConvite` classifica cada resposta em `unlocked` +
  // `motivo`. `redeCache` guarda só o resultado CONCLUSIVO (`200`) com um
  // carimbo de tempo; `acessoConfirmadoValido` diz se esse carimbo ainda
  // está dentro do teto `ACESSO_CONFIRMADO_TTL_MS` (24h -- ver o porquê no
  // cabeçalho de `redeCache.ts`).
  //
  // Três coisas que ANTES estavam todas amarradas nesse teto, e que este
  // componente agora trata como decisões independentes (retest do usuário,
  // T121, 11–18/09): validade dos DADOS em cache (não é problema deste
  // componente -- é `STALE_MS`/SWR no `RedeTab`, nunca bloqueia nada);
  // MOMENTO de revalidar o acesso (sempre, incondicional -- não depende do
  // teto); e quando OCULTAR o conteúdo privado (só em resposta decisiva, não
  // em "o carimbo está velho").
  //
  //  - **`liberado`:** há uma confirmação positiva dentro do teto de 24h
  //    (memória ou persistida -- `hidratarAcesso` no mount cobre documento
  //    novo). O `<RedeTab>` monta na hora com o Feed cacheado, revalidando
  //    em 2º plano. Nunca é autorização -- cada query do RedeTab passa pela
  //    RLS do servidor.
  //  - **`verificando`:** nunca houve confirmação nesta conta, OU o teto de
  //    24h foi cruzado sem NENHUMA corroboração nova -- aguarda a 1ª
  //    resposta antes de mostrar qualquer conteúdo privado. Sem isto, uma
  //    conta que nunca mais conseguisse confirmar acesso (sempre offline, ou
  //    o app nunca mais reaberto em 1º plano) ficaria autorizada localmente
  //    pra sempre -- é uma rede de segurança de última instância, não o
  //    gatilho comum do dia a dia (esse é o TTL curto que causava o flash;
  //    não existe mais).
  //  - **`semRede`:** tentativa(s) de revalidar voltaram `indisponivel`
  //    (offline/5xx) e não há carimbo válido pra confiar. Continua tentando
  //    (mount, volta de 2º plano, reconexão, timer de 60s) -- NUNCA mostra o
  //    gate de "peça seu convite" nesse estado: falha de rede não é "sem
  //    convite", e dado já existente no localStorage não isenta a interface
  //    de proteger o que mostra enquanto não há confirmação nenhuma.
  //  - **`semAcesso`:** resposta DECISIVA -- `sessao` (401 sem refresh
  //    possível), `negado` (403/4xx) ou `sem_convite` (200 sem convite) --
  //    ou vitrine forçada (`?vitrine=1`). Zera memória + localStorage na
  //    hora; perda de autorização tira o conteúdo privado da tela.
  //  - **Revalidação extra:** ao a aba voltar a ficar visível
  //    (`visibilitychange`), ao reconectar (`online`) e a cada 60s enquanto
  //    liberado/semRede (cobre a tela nunca sair de 1º plano) -- nenhuma
  //    dessas depende de um remount do PIN.
  //
  // Janela de revogação (online): limitada pela duração da PRÓPRIA consulta
  // — não é instantânea, numa rede lenta pode passar de 1s (medido: 860ms
  // num caso real). O pior caso não é "24h", é "até a próxima consulta
  // TERMINAR", e essa consulta já dispara a cada mount/foreground/reconexão.
  // Offline: sem tentativa possível, o conteúdo cacheado permanece em tela
  // até reconectar -- isto NÃO é uma exposição nova: os mesmos posts já
  // ficam em `localStorage` por até 24h (cache de dados, independente desta
  // política) para o SWR funcionar; quem tem acesso físico ao aparelho
  // offline já os veria de um jeito ou de outro. O que esta política decide
  // é só se a INTERFACE oculta ou não enquanto não há confirmação -- dado
  // já existir em disco não torna essa proteção irrelevante.
  const [estado, setEstado] = useState<EstadoGate>(() => {
    // Hidrata a memória com o carimbo persistido ANTES de checar o teto --
    // só tem efeito no 1º render desta conta nesta sessão de JS (documento
    // novo); se já há algo em memória (mesma sessão), hidratarAcesso é nulo.
    const persistido = redeCachePersist.carregarAcesso(usuario.id);
    redeCache.hidratarAcesso(usuario.id, persistido);
    return redeCache.acessoConfirmadoValido(usuario.id)
      ? "liberado"
      : "verificando";
  });
  const [sheet, setSheet] = useState<GateSheet>(null);
  // Lido de dentro do intervalo de 60s (closure de longa duração) sem
  // precisar recriar o efeito a cada mudança de estado.
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  // Bump manual (botão "Tentar novamente" no estado `semRede`) força o
  // efeito abaixo a rodar de novo e disparar uma tentativa na hora -- mesmo
  // padrão de `conversationsReloadKey` no `RedeTab`.
  const [tentativaManual, setTentativaManual] = useState(0);

  // Um convite já resgatado por esse usuário é a única fonte de verdade pra
  // acesso liberado — sem isso, quem já desbloqueou via SerialKeySheet numa
  // sessão anterior cai na tela de gate de novo a cada recarregamento, já
  // que `estado` acima é só estado local.
  //
  // ?vitrine=1 na URL força a vitrine a aparecer mesmo numa conta já
  // desbloqueada -- só pra quem está testando/mexendo no fluxo do gate
  // repetidamente sem precisar revogar o convite no banco toda hora. Não é
  // UI (ninguém digita isso sem saber que existe), então não conflita com a
  // decisão de "sem UI de admin" da ticket 03.
  // Carimba `unlocked=true` em memória E em localStorage com o MESMO
  // instante -- as duas cópias precisam concordar sobre "há quanto tempo"
  // pra um documento novo (hidratarAcesso) recalcular o teto certo depois.
  // Chamado SÓ em resposta positiva de verdade -- nunca em leitura de
  // cache, abertura do app ou erro/indisponibilidade (senão o teto de 24h
  // se estenderia sem nenhuma corroboração real).
  const lembrarAcessoConfirmado = useCallback((): void => {
    const confirmadoEm = Date.now();
    redeCache.lembrarAcesso(usuario.id, true, confirmadoEm);
    redeCachePersist.salvarAcesso(usuario.id, true, confirmadoEm);
  }, [usuario.id]);

  useEffect(() => {
    // Trocar de conta (ou 1ª vinculação) limpa o cache em memória da conta
    // anterior antes de qualquer leitura do RedeTab.
    redeCache.vincularUsuario(usuario.id);

    let ativo = true;
    const forcarVitrine =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("vitrine") === "1";

    if (forcarVitrine) {
      // Força a vitrine mesmo com um carimbo hidratado de `redeCachePersist`
      // (conta já desbloqueada, mas dentro do teto de 24h) -- sem isto,
      // `estado` já nasceria `liberado` no useState acima e a vitrine nunca
      // apareceria num reload com esta flag.
      setEstado("semAcesso");
      return;
    }

    const derrubar = () => {
      // Perdeu (ou nunca teve) autorização: conteúdo privado sai da tela +
      // zera memória e localStorage.
      setEstado("semAcesso");
      redeCache.limparTudo();
      redeCachePersist.limpar(usuario.id);
    };

    /** Aplica um resultado de `verificarAcessoConvite`. */
    const aplicar = (resultado: AcessoConvite) => {
      if (!ativo) return;
      if (resultado.unlocked) {
        lembrarAcessoConfirmado();
        setEstado("liberado");
        return;
      }
      if (resultado.motivo === "indisponivel") {
        // Não conclui nada -- nunca é "sem convite". Se ainda há um acesso
        // confirmado dentro do teto de 24h, segue mostrando o conteúdo
        // cacheado; senão, fica tentando de novo (`semRede`), SEM cair no
        // gate de convite -- falha de rede não é motivo pra pedir convite
        // de novo pra quem já tem um.
        setEstado(
          redeCache.acessoConfirmadoValido(usuario.id) ? "liberado" : "semRede"
        );
        return;
      }
      // "sem_convite" | "sessao" | "negado" -> derruba.
      derrubar();
    };

    const revalidarAgora = () => {
      verificarAcessoConvite(supabase, usuario.id).then(aplicar);
    };

    revalidarAgora();

    // Revalida quando a aba volta a ficar visível (PWA saiu do 2º plano,
    // troca de app no celular) e quando a conexão volta -- cobre "convite
    // revogado enquanto esteve fora" sem depender de um remount do PIN.
    const aoFicarVisivel = () => {
      if (document.visibilityState !== "visible") return;
      revalidarAgora();
    };
    document.addEventListener("visibilitychange", aoFicarVisivel);
    window.addEventListener("online", revalidarAgora);

    // Cobre a tela ficando aberta e em foco pela janela toda: sem isto, uma
    // conta sem NENHUMA corroboração nova por 24h só sairia do estado
    // `liberado` no próximo remount/visibilitychange/reconexão -- que pode
    // nunca vir se ninguém tocar no aparelho.
    const checagemTeto = setInterval(() => {
      if (!ativo) return;
      if (
        estadoRef.current === "liberado" &&
        !redeCache.acessoConfirmadoValido(usuario.id)
      ) {
        setEstado("verificando");
        revalidarAgora();
      } else if (estadoRef.current === "semRede") {
        revalidarAgora();
      }
    }, INTERVALO_CHECAGEM_TETO_MS);

    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoFicarVisivel);
      window.removeEventListener("online", revalidarAgora);
      clearInterval(checagemTeto);
    };
  }, [usuario.id, lembrarAcessoConfirmado, tentativaManual]);

  if (estado === "verificando" || estado === "semRede") {
    return (
      <div className="flex flex-col items-center gap-3 pt-12 px-6 text-center">
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)" }}
        />
        {estado === "semRede" && (
          <>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Sem conexão no momento. Tentando de novo…
            </p>
            <button
              onClick={() => setTentativaManual((k) => k + 1)}
              className="text-xs font-semibold active:opacity-70"
              style={{ color: "var(--accent)", minHeight: "44px" }}
            >
              Tentar novamente
            </button>
          </>
        )}
      </div>
    );
  }

  if (estado === "liberado") {
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
          setEstado("liberado");
          lembrarAcessoConfirmado();
        }}
      />
    </>
  );
}
