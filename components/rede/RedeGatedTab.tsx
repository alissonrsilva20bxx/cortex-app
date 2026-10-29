"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { RedeRenovacao } from "./RedeRenovacao";
import { RedeTab } from "./RedeTab";
import { supabase } from "@/lib/supabase";
import { verificarAcessoRede, type AcessoRede } from "@/lib/rede/acessoRede";
import * as redeCache from "@/lib/rede/redeCache";
import * as redeCachePersist from "@/lib/rede/redeCachePersist";
import type { Usuario } from "@/lib/types";
import type { RedeAcessoTour } from "@/lib/appTour";

interface Props {
  usuario: Usuario;
  /** Se a aba Rede é a selecionada agora (`activeTab === "rede"` no pai).
   * Repassado até o `RedeTab` pra restaurar a rolagem só quando a Rede
   * está de fato visível. */
  active?: boolean;
  /** Incrementa a cada toque na aba Rede JÁ ativa (gesto do iOS: volta a
   * pilha pra raiz / rola o Feed pro topo). */
  reselectSignal?: number;
  /** Incrementa a cada toque no "+" da Rede (Postar): abre o compositor. */
  postarSignal?: number;
  onChatFocusChange?: (focused: boolean) => void;
  /** Avisa o pai se a Rede está liberada ou na tela de renovação -- o tour
   * do app troca os passos do feed/perfil pelos da renovação. */
  onAcessoChange?: (acesso: RedeAcessoTour) => void;
  /** Foto do perfil da Rede (null = sem foto ou sem acesso). */
  onFotoPerfilChange?: (url: string | null) => void;
  /** Modelo Doca: a casinha do cabeçalho da Rede volta ao Início. */
  onSairDaRede?: () => void;
  /** Vai para Finanças › Metas, onde o Desejo é criado e editado. */
  onAbrirDesejos?: () => void;
  /** Modelo Doca: mostra a barra própria da Rede (só com acesso). */
  barraDoca?: boolean;
  /** Tela de renovação: abre a escolha de plano (a mesma dos Ajustes). */
  onVerPlanos?: () => void;
  /** Incrementa depois do Pagamento: confere o acesso de novo na hora. */
  recarregarSinal?: number;
}

/** Layout effect no navegador; no servidor, um effect comum (não roda). */
const useEfeitoDeLayout =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Enquanto `estado === "semRede"`, tenta de novo nesse intervalo mesmo sem
 * nenhum `visibilitychange`/`online` disparar -- não há "prazo exato" pra
 * esperar aqui (já está falhando), então é só uma cadência de retry. */
const INTERVALO_RETRY_SEM_REDE_MS = 30_000;

type EstadoGate =
  | "verificando" // nunca confirmado nesta conta (ou carimbo sem corroboração
  //   nenhuma há mais de 24h) -- aguardando a 1ª resposta decisiva.
  | "liberado" // conteúdo confiado: confirmação positiva dentro do teto.
  | "semRede" // tentativa(s) resultaram "indisponivel" e não há carimbo
  //   válido pra confiar -- continua tentando, NUNCA mostra a tela de
  //   renovação (falha de rede não é "teste acabou").
  | "semAcesso"; // resposta decisiva negativa (teste acabou sem
//   assinatura, sessão perdida ou vitrine forçada): tela de renovação.

/** Teste em dia ou assinatura ativa → Feed completo; teste acabou sem
 * assinatura → tela de renovação (só a Rede para; o resto do app segue).
 * Sem código e sem fila (capitão, 27/10). A regra é a de
 * `lib/rede/acessoRede.ts`. Usado tanto na rota real (/) quanto no shell
 * mockado de /dev-preview/app. */
export function RedeGatedTab({
  usuario,
  active = true,
  reselectSignal,
  postarSignal,
  onChatFocusChange,
  onAcessoChange,
  onFotoPerfilChange,
  onSairDaRede,
  onAbrirDesejos,
  barraDoca,
  onVerPlanos,
  recarregarSinal,
}: Props) {
  // ── Política do acesso lembrado (teto de confiança, não "validade curta") ──
  // `verificarAcessoRede` classifica cada resposta em `unlocked` +
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
  //    (mount, volta de 2º plano, reconexão, timer de 60s) -- NUNCA mostra a
  //    tela de renovação nesse estado: falha de rede não é "teste acabou",
  //    e dado já existente no localStorage não isenta a interface de
  //    proteger o que mostra enquanto não há confirmação nenhuma.
  //  - **`semAcesso`:** resposta DECISIVA -- `sessao` (401 sem refresh
  //    possível), `negado` (403/4xx) ou `vencido` (200, teste acabou sem
  //    assinatura) -- ou vitrine forçada (`?vitrine=1`). Zera memória +
  //    localStorage na hora; perda de autorização tira o conteúdo privado
  //    da tela.
  //  - **Fim do teste com o app aberto:** liberado pelo teste, a resposta
  //    traz o instante em que ele acaba (`validoAte`); um timer confere de
  //    novo nessa hora, sem esperar a próxima volta do 2º plano.
  //  - **Revalidação extra:** ao a aba voltar a ficar visível
  //    (`visibilitychange`, que já confere o teto na hora antes de disparar
  //    a consulta), ao reconectar (`online`), num timer exato agendado pro
  //    instante em que o teto de 24h vence (não polling -- `setTimeout` pro
  //    prazo restante, recalculado a cada nova confirmação) e, em
  //    `semRede`, retry periódico -- nenhuma dessas depende de um remount
  //    do PIN.
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
  //
  // Só a memória no 1º render (mesma sessão de JS: o remount do PIN já nasce
  // `liberado`). O carimbo do localStorage NÃO é lido aqui: o servidor não o
  // tem e desenha `verificando`; ler no 1º render da hidratação fazia o
  // navegador desenhar o Feed no lugar (erro de hidratação ao recarregar a
  // página, o "1 error" do preview, #50). Ele entra no efeito de layout logo
  // abaixo, depois da hidratação e antes da 1ª pintura, como no RedeTab.
  const [estado, setEstado] = useState<EstadoGate>(() =>
    redeCache.acessoConfirmadoValido(usuario.id) ? "liberado" : "verificando"
  );
  // Documento novo: hidrata a memória com o carimbo persistido (se já há
  // algo em memória, hidratarAcesso é nulo) e, dentro do teto, libera.
  useEfeitoDeLayout(() => {
    const persistido = redeCachePersist.carregarAcesso(usuario.id);
    redeCache.hidratarAcesso(usuario.id, persistido);
    if (redeCache.acessoConfirmadoValido(usuario.id)) {
      setEstado((atual) => (atual === "verificando" ? "liberado" : atual));
    }
  }, [usuario.id]);
  /** Liberado pelo teste: quando ele acaba (ms); null = sem prazo. */
  const [validoAte, setValidoAte] = useState<number | null>(null);
  // Bump manual (botão "Tentar novamente" no estado `semRede`) força o
  // efeito abaixo a rodar de novo e disparar uma tentativa na hora -- mesmo
  // padrão de `conversationsReloadKey` no `RedeTab`.
  const [tentativaManual, setTentativaManual] = useState(0);
  // Ponte pros efeitos de baixo (timer do teto, retry de semRede)
  // chamarem a MESMA `revalidarAgora` do efeito de mount atual, sem precisar
  // depender de `estado` nas deps desse efeito (que reconstruiria os
  // listeners de visibilitychange/online toda hora à toa).
  const revalidarAgoraRef = useRef<() => void>(() => {});

  // O banco (configuracoes + convite antigo, pela regra de
  // `lib/rede/acessoRede.ts`) é a única fonte de verdade pra acesso
  // liberado -- `estado` acima é só estado local.
  //
  // ?vitrine=1 na URL força a tela de renovação mesmo numa conta liberada
  // -- só pra quem está testando o fluxo sem mexer no banco. Não é UI
  // (ninguém digita isso sem saber que existe).
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

    /** Aplica um resultado de `verificarAcessoRede`. */
    const aplicar = (resultado: AcessoRede) => {
      if (!ativo) return;
      if (resultado.unlocked) {
        lembrarAcessoConfirmado();
        setValidoAte(resultado.validoAte ?? null);
        setEstado("liberado");
        return;
      }
      if (resultado.motivo === "indisponivel") {
        // Não conclui nada -- nunca é "teste acabou". Se ainda há um acesso
        // confirmado dentro do teto de 24h, segue mostrando o conteúdo
        // cacheado; senão, fica tentando de novo (`semRede`), SEM cair na
        // tela de renovação -- falha de rede não é motivo pra cobrar de
        // quem está em dia.
        setEstado(
          redeCache.acessoConfirmadoValido(usuario.id) ? "liberado" : "semRede"
        );
        return;
      }
      // "vencido" | "sessao" | "negado" -> derruba.
      derrubar();
    };

    const revalidarAgora = () => {
      verificarAcessoRede(supabase, usuario.id).then(aplicar);
    };
    revalidarAgoraRef.current = revalidarAgora;

    revalidarAgora();

    // Revalida quando a aba volta a ficar visível (PWA saiu do 2º plano,
    // troca de app no celular) e quando a conexão volta -- cobre "teste
    // acabou enquanto esteve fora" sem depender de um remount do PIN.
    // Confere o teto ANTES de disparar a consulta: se já cruzou (o timer
    // abaixo não dispara enquanto a aba está em 2º plano -- `setTimeout` de
    // página oculta é jogado pra trás pelo navegador), reflete isso na hora
    // em vez de deixar `liberado` em tela até a consulta terminar.
    const aoFicarVisivel = () => {
      if (document.visibilityState !== "visible") return;
      if (!redeCache.acessoConfirmadoValido(usuario.id)) {
        setEstado((atual) => (atual === "liberado" ? "verificando" : atual));
      }
      revalidarAgora();
    };
    document.addEventListener("visibilitychange", aoFicarVisivel);
    window.addEventListener("online", revalidarAgora);

    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoFicarVisivel);
      window.removeEventListener("online", revalidarAgora);
    };
  }, [usuario.id, lembrarAcessoConfirmado, tentativaManual, recarregarSinal]);

  // Liberado pelo teste: confere de novo no instante em que ele acaba (o
  // banco para de liberar nessa hora; a tela acompanha). Teto do
  // `setTimeout` (~24,8 dias) folgado: o teste dura no máximo 14.
  useEffect(() => {
    if (estado !== "liberado" || validoAte === null) return;
    const t = setTimeout(
      () => revalidarAgoraRef.current(),
      Math.min(Math.max(0, validoAte - Date.now()) + 1000, 2_000_000_000)
    );
    return () => clearTimeout(t);
  }, [estado, validoAte]);

  // Timer exato pro instante em que o teto de 24h vence -- reagendado toda
  // vez que `estado` volta a `liberado` (ou seja, toda vez que há um
  // `confirmadoEm` novo). Substitui polling: dispara uma única vez, na hora
  // certa, em vez de conferir a cada X segundos até 24h se completarem.
  useEffect(() => {
    if (estado !== "liberado") return;
    const restante = redeCache.tempoRestanteAteTeto(usuario.id);
    if (restante === null) return; // defensivo -- não deveria acontecer liberado sem carimbo
    const t = setTimeout(
      () => {
        if (!redeCache.acessoConfirmadoValido(usuario.id)) {
          setEstado("verificando");
          revalidarAgoraRef.current();
        }
      },
      Math.max(0, restante)
    );
    return () => clearTimeout(t);
  }, [estado, usuario.id]);

  // Enquanto `semRede`, tenta de novo periodicamente -- não há um "instante
  // exato" pra esperar aqui (diferente do timer do teto acima), só cadência
  // de retry até a rede voltar ou `visibilitychange`/`online` resolverem
  // antes.
  useEffect(() => {
    if (estado !== "semRede") return;
    const t = setInterval(() => {
      revalidarAgoraRef.current();
    }, INTERVALO_RETRY_SEM_REDE_MS);
    return () => clearInterval(t);
  }, [estado]);

  const onAcessoChangeRef = useRef(onAcessoChange);
  onAcessoChangeRef.current = onAcessoChange;
  const onFotoPerfilChangeRef = useRef(onFotoPerfilChange);
  onFotoPerfilChangeRef.current = onFotoPerfilChange;
  useEffect(() => {
    // Perdeu o acesso: o Início volta pra foto da conta.
    if (estado === "semAcesso") onFotoPerfilChangeRef.current?.(null);
    onAcessoChangeRef.current?.(
      estado === "liberado"
        ? "liberado"
        : estado === "semAcesso"
          ? "bloqueado"
          : "pendente"
    );
  }, [estado]);

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
        reselectSignal={reselectSignal}
        postarSignal={postarSignal}
        onChatFocusChange={onChatFocusChange}
        onFotoPerfilChange={onFotoPerfilChange}
        onSairDaRede={onSairDaRede}
        onAbrirDesejos={onAbrirDesejos}
        barraDoca={barraDoca}
      />
    );
  }

  return <RedeRenovacao onVerPlanos={onVerPlanos} />;
}
