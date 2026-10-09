"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AVISO_FALTAM_DIAS,
  computeAssinatura,
  estadoDaPilula,
  TRIAL_DIAS,
  type EstadoAssinatura,
} from "@/lib/assinatura";
import { formatBRL, totalEarnings } from "@/lib/finance";
import type { OnEscolherPlano } from "@/lib/planos";
import type { AssinaturaStatus, Job } from "@/lib/types";
import { AvisoTeste } from "./AvisoTeste";
import { PilulaTeste } from "./PilulaTeste";
import { PlanosTela } from "./PlanosTela";

/** "Já viu os planos hoje": a tela do fim do teste aparece uma vez por dia. */
const chavePlanosVistos = (userId: string) => `jobapp-planos-vistos:${userId}`;
/** "Já viu o aviso dos 2 dias": aparece uma vez só. Não é por data: os 2
 * dias contam da hora em que o teste começou e atravessam a meia-noite. */
const chaveAvisoTeste = (userId: string) => `jobapp-aviso-teste:${userId}`;
const hoje = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface Props {
  userId: string;
  /** O Início está na tela (e nada por cima: onboarding, trava, tour). */
  noInicio: boolean;
  /** Pode mostrar a tela do fim do teste (o app está aberto, sem trava nem
   * onboarding por cima). */
  podeMostrarPlanos: boolean;
  jobs: Job[];
  /** Ponto de entrada do Pagamento (ver `OnEscolherPlano` em lib/planos). */
  onEscolherPlano: OnEscolherPlano;
  /** Laboratório: força um estado do teste sem mexer no banco. */
  estadoForcado?: EstadoAssinatura | null;
  /** Laboratório: abre a tela de planos agora. */
  abrirPlanosSinal?: number;
}

/**
 * O teste grátis dentro do app (onboarding "Linha do tempo", telas 4 e 5):
 * a pílula do contador no Início e a tela de escolha de plano quando o
 * teste termina (uma vez por dia) ou pelo "Ver planos" do último dia.
 *
 * O estado vem de `configuracoes` (trial_started_at, assinatura_status), a
 * mesma leitura dos Ajustes, e o cálculo é o `computeAssinatura` de sempre.
 * Nada aqui bloqueia o app: "Agora não" fecha e segue.
 */
export function AssinaturaNoApp({
  userId,
  noInicio,
  podeMostrarPlanos,
  jobs,
  onEscolherPlano,
  estadoForcado,
  abrirPlanosSinal,
}: Props) {
  const [estado, setEstado] = useState<EstadoAssinatura | null>(null);
  const [planosAbertos, setPlanosAbertos] = useState(false);
  const [avisoAberto, setAvisoAberto] = useState(false);

  useEffect(() => {
    let vivo = true;
    supabase
      .from("configuracoes")
      .select("trial_started_at, assinatura_status")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (!vivo || !data?.trial_started_at || !data?.assinatura_status)
          return;
        setEstado(
          computeAssinatura(
            data.trial_started_at,
            data.assinatura_status as AssinaturaStatus
          )
        );
      });
    return () => {
      vivo = false;
    };
  }, [userId]);

  const efetivo = estadoForcado !== undefined ? estadoForcado : estado;

  // Teste terminou: a tela dos planos abre sozinha uma vez por dia.
  useEffect(() => {
    if (!podeMostrarPlanos || efetivo?.status !== "vencida") return;
    try {
      if (localStorage.getItem(chavePlanosVistos(userId)) === hoje()) return;
      localStorage.setItem(chavePlanosVistos(userId), hoje());
    } catch {
      /* sem storage: abre, e "Agora não" fecha */
    }
    setPlanosAbertos(true);
  }, [podeMostrarPlanos, efetivo?.status, userId]);

  useEffect(() => {
    if (abrirPlanosSinal) setPlanosAbertos(true);
  }, [abrirPlanosSinal]);

  const pilula = estadoDaPilula(efetivo);

  // O aviso que a tela 3 do onboarding promete: no Início, uma vez, no dia
  // em que a pílula mostra 2. Sem servidor e sem migration.
  const faltam = pilula?.faltam;
  useEffect(() => {
    if (!podeMostrarPlanos || !noInicio || faltam !== AVISO_FALTAM_DIAS) return;
    try {
      if (localStorage.getItem(chaveAvisoTeste(userId))) return;
      localStorage.setItem(chaveAvisoTeste(userId), String(faltam));
    } catch {
      return; /* sem storage: sem aviso, para não repetir a cada abertura */
    }
    setAvisoAberto(true);
  }, [podeMostrarPlanos, noInicio, faltam, userId]);

  return (
    <>
      {pilula && noInicio && !planosAbertos && avisoAberto && (
        <AvisoTeste
          faltam={pilula.faltam}
          onVerPlanos={() => {
            setAvisoAberto(false);
            setPlanosAbertos(true);
          }}
          onFechar={() => setAvisoAberto(false)}
        />
      )}
      {pilula && noInicio && !planosAbertos && !avisoAberto && (
        <PilulaTeste
          faltam={pilula.faltam}
          feitos={pilula.feitos}
          total={pilula.total}
          ultimo={pilula.ultimo}
          onVerPlanos={() => setPlanosAbertos(true)}
        />
      )}
      {planosAbertos && podeMostrarPlanos && (
        <PlanosTela
          diasDoTeste={efetivo?.diasDoTeste ?? TRIAL_DIAS}
          resumo={{
            atendimentos: jobs.filter((j) => j.status === "concluído").length,
            registrado:
              totalEarnings(jobs) > 0 ? formatBRL(totalEarnings(jobs)) : null,
          }}
          onEscolherPlano={(plano) => {
            setPlanosAbertos(false);
            onEscolherPlano(plano);
          }}
          onAgoraNao={() => setPlanosAbertos(false)}
        />
      )}
    </>
  );
}
