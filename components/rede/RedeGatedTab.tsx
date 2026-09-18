"use client";

import { useCallback, useEffect, useState } from "react";
import { RedeTeaserGate, type GateSheet } from "./RedeTeaserGate";
import { SerialKeySheet } from "./SerialKeySheet";
import { RedeTab } from "./RedeTab";
import { supabase } from "@/lib/supabase";
import { verificarAcessoConvite, type AcessoConvite } from "@/lib/rede/acesso";
import * as redeCache from "@/lib/rede/redeCache";
import * as redeCachePersist from "@/lib/rede/redeCachePersist";
import type { Usuario } from "@/lib/types";

// ── TEMP-TIMING [rede-timing-v2] ──────────────────────────────────────────
// Diagnóstico temporário pro reteste do flash PIN→Rede no iPhone. Remover
// (junto com `DiagPanel`, `DiagInfo`, `DIAG_TAG` e os pontos marcados
// abaixo) assim que o usuário tiver copiado o resultado do aparelho real --
// não é pra sobreviver ao merge. Sem segredos: só timestamps relativos,
// durações e o hash curto do commit servido (já público no histórico).
const DIAG_TAG = "rede-timing-v2-2026-09-18";

interface DiagInfo {
  origem: "memoria" | "persistencia" | "ausente";
  idadeCarimboMs: number | null;
  carimboUnlocked: boolean | null;
  motivoVerificando: string;
  duracaoRevalidacaoMs: number | null;
  versao: string;
}

function motivoVerificandoAcesso(
  carimbo: { unlocked: boolean; confirmadoEm: number } | null,
  valido: boolean
): string {
  if (valido) return "n/a — acesso já válido, não entrou no spinner";
  if (!carimbo) return "sem-carimbo (nunca confirmado nesta conta)";
  if (!carimbo.unlocked)
    return "carimbo-negativo (última checagem não liberou)";
  return "carimbo-expirado (mais de 90s desde confirmadoEm)";
}

function formatarDiag(d: DiagInfo): string {
  return [
    `[${DIAG_TAG}] ${new Date().toISOString()}`,
    `origem do carimbo: ${d.origem}`,
    `idade do carimbo no desbloqueio: ${d.idadeCarimboMs === null ? "sem carimbo" : `${d.idadeCarimboMs} ms (${(d.idadeCarimboMs / 1000).toFixed(1)}s)`}`,
    `carimbo unlocked: ${d.carimboUnlocked === null ? "n/a" : d.carimboUnlocked}`,
    `motivo verificandoAcesso=true: ${d.motivoVerificando}`,
    `duração da revalidação: ${d.duracaoRevalidacaoMs === null ? "ainda não resolveu / não disparou" : `${d.duracaoRevalidacaoMs} ms`}`,
    `versão servida: ${d.versao}`,
  ].join("\n");
}

/** Painel fixo, sempre renderizado (nas 3 ramificações do gate) pra não
 * sumir no meio da transição que estamos medindo. Cópia com fallback pra
 * seleção manual -- clipboard API pode ser restrita dentro do PWA
 * standalone do iOS. */
function DiagPanel({ diag }: { diag: DiagInfo }) {
  const [aberto, setAberto] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const texto = formatarDiag(diag);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setStatus("Copiado!");
    } catch {
      setStatus(
        "Não copiou sozinho — selecione o texto abaixo e copie manualmente."
      );
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        style={{
          position: "fixed",
          top: 8,
          right: 8,
          zIndex: 99999,
          fontSize: 20,
          background: "rgba(0,0,0,0.7)",
          border: "1px solid #666",
          borderRadius: 999,
          width: 36,
          height: 36,
          color: "#fff",
        }}
      >
        🐞
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        right: 8,
        zIndex: 99999,
        background: "rgba(0,0,0,0.9)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.4,
        padding: 10,
        borderRadius: 10,
        border: "1px solid #444",
        maxHeight: "45vh",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <strong style={{ color: "#fff" }}>
          diagnóstico temporário (rede-timing)
        </strong>
        <button
          onClick={() => setAberto(false)}
          style={{
            color: "#fff",
            background: "none",
            border: "none",
            fontSize: 14,
          }}
        >
          ×
        </button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", margin: 0, color: "#0f0" }}>
        {texto}
      </pre>
      <div
        style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}
      >
        <button
          onClick={copiar}
          style={{
            background: "#0f0",
            color: "#000",
            border: "none",
            borderRadius: 6,
            padding: "6px 10px",
            fontWeight: "bold",
          }}
        >
          Copiar diagnóstico
        </button>
        {status && <span style={{ color: "#fff" }}>{status}</span>}
      </div>
      <textarea
        readOnly
        value={texto}
        onClick={(e) => e.currentTarget.select()}
        style={{
          width: "100%",
          marginTop: 8,
          background: "#111",
          color: "#0f0",
          fontFamily: "monospace",
          fontSize: 10,
          border: "1px solid #444",
          borderRadius: 6,
        }}
        rows={8}
      />
    </div>
  );
}
// ── fim TEMP-TIMING [rede-timing-v2] ───────────────────────────────────────

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
  // TEMP-TIMING [rede-timing-v2] -- captura ANTES de qualquer hidratação
  // mexer na memória (corpo do componente roda antes dos useState abaixo no
  // mount). `diagAntes` só reflete o mount de verdade -- ver comentário no
  // topo do arquivo sobre por que isso é seguro mesmo recalculando a cada
  // render.
  const diagAntes = redeCache.acessoLembrado(usuario.id);
  const diagPersistido = redeCachePersist.carregarAcesso(usuario.id);

  // ── Política do acesso lembrado (limite explícito) ──
  // `verificarAcessoConvite` classifica cada resposta em `unlocked` +
  // `motivo`. `redeCache` guarda só o resultado CONCLUSIVO (`200`) com um
  // carimbo de tempo; `acessoConfirmadoValido` diz se esse carimbo ainda
  // está dentro da janela `ACESSO_CONFIRMADO_TTL_MS` (90s).
  //
  //  - **Dentro da validade:** ao destravar o PIN o `<RedeTab>` monta na
  //    hora com o Feed cacheado, e a revalidação roda em 2º plano. Nunca é
  //    autorização -- cada query do RedeTab passa pela RLS do servidor. O
  //    carimbo é hidratado de `redeCachePersist` no mount (ver useState
  //    abaixo), então isso vale tanto na mesma sessão de JS quanto num
  //    documento novo (reload, iOS descartou a aba em 2º plano) -- a
  //    janela de 90s não muda, só sobrevive ao documento como o resto do
  //    cache da Rede já sobrevive.
  //  - **Vencida (nesta sessão OU no carimbo persistido):** spinner, e a
  //    revalidação roda ANTES de exibir qualquer conteúdo privado.
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
  const [unlocked, setUnlocked] = useState(() => {
    // Hidrata a memória com o carimbo persistido ANTES de checar validade --
    // só tem efeito no 1º render desta conta nesta sessão de JS (documento
    // novo); se já há algo em memória (mesma sessão), hidratarAcesso é nulo.
    const persistido = redeCachePersist.carregarAcesso(usuario.id);
    redeCache.hidratarAcesso(usuario.id, persistido);
    return redeCache.acessoConfirmadoValido(usuario.id);
  });
  const [verificandoAcesso, setVerificandoAcesso] = useState(
    () => !redeCache.acessoConfirmadoValido(usuario.id)
  );
  const [sheet, setSheet] = useState<GateSheet>(null);

  // TEMP-TIMING [rede-timing-v2] -- snapshot fixado no mount (mesma lógica
  // de "só a 1ª chamada importa" que unlocked/verificandoAcesso já usam).
  const [diag, setDiag] = useState<DiagInfo>(() => {
    const carimbo = diagAntes ?? diagPersistido ?? null;
    const valido = redeCache.acessoConfirmadoValido(usuario.id);
    return {
      origem: diagAntes
        ? "memoria"
        : diagPersistido
          ? "persistencia"
          : "ausente",
      idadeCarimboMs: carimbo ? Date.now() - carimbo.confirmadoEm : null,
      carimboUnlocked: carimbo ? carimbo.unlocked : null,
      motivoVerificando: motivoVerificandoAcesso(carimbo, valido),
      duracaoRevalidacaoMs: null,
      versao: `${DIAG_TAG} · commit ${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "n/d"}`,
    };
  });

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
  // Carimba `unlocked=true` em memória E em localStorage com o MESMO
  // instante -- as duas cópias precisam concordar sobre "há quanto tempo"
  // pra um documento novo (hidratarAcesso) recalcular o TTL certo depois.
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
      // (conta já desbloqueada, mas dentro da validade de 90s) -- sem isto,
      // `unlocked` já nasceria `true` no useState acima e a vitrine nunca
      // apareceria num reload com esta flag.
      setUnlocked(false);
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
        lembrarAcessoConfirmado();
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

    // TEMP-TIMING [rede-timing-v2] -- só a chamada inicial (a que decide o
    // 1º frame pós-PIN) é cronometrada; revalidações por visibilitychange/
    // online não sobrescrevem esse número.
    const inicioRevalidacaoInicial = performance.now();
    verificarAcessoConvite(supabase, usuario.id).then((resultado) => {
      const duracaoMs = Math.round(
        performance.now() - inicioRevalidacaoInicial
      );
      setDiag((d) => ({ ...d, duracaoRevalidacaoMs: duracaoMs }));
      aplicar(resultado);
    });

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
  }, [usuario.id, lembrarAcessoConfirmado]);

  if (verificandoAcesso) {
    return (
      <>
        <DiagPanel diag={diag} />
        <div className="flex justify-center pt-12">
          <div
            className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--accent)" }}
          />
        </div>
      </>
    );
  }

  if (unlocked) {
    return (
      <>
        <DiagPanel diag={diag} />
        <RedeTab
          usuario={usuario}
          active={active}
          onChatFocusChange={onChatFocusChange}
        />
      </>
    );
  }

  return (
    <>
      <DiagPanel diag={diag} />
      <RedeTeaserGate sheet={sheet} onSheetChange={setSheet} />
      <SerialKeySheet
        open={sheet === "chave"}
        onClose={() => setSheet(null)}
        onConfirm={() => {
          setSheet(null);
          setUnlocked(true);
          lembrarAcessoConfirmado();
        }}
      />
    </>
  );
}
