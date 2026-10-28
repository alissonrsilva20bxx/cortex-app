"use client";

import { useState } from "react";
import styles from "@/components/onboarding/linhaDoTempo.module.css";
import {
  PLANOS,
  PLANO_PADRAO,
  cheioDoPlano,
  economia,
  percentualDesconto,
  planoPorId,
  precoDoPlano,
  precoPorMes,
  type OnEscolherPlano,
  type PlanoId,
} from "@/lib/planos";
import { TEXTOS_PLANOS } from "@/lib/textosPlanos";
import { useFormatMoeda, useMoeda } from "@/lib/useMoeda";

interface Props {
  /** O que ela já fez no teste (os chips do cartão do topo). Só o que for
   * maior que zero aparece. */
  resumo: { atendimentos: number; registrado: string | null };
  /** Quantos dias o teste desta conta teve (7, ou 14 antes do corte). */
  diasDoTeste: number;
  /** Dias que faltam do teste, quando aberta pelo "Ver planos" no meio dele
   * (Ajustes, aviso, pílula); `null` = o teste acabou. */
  faltam: number | null;
  /** Ponto de entrada do Pagamento: chamado com o plano marcado. */
  onEscolherPlano: OnEscolherPlano;
  /** "Agora não": fecha e continua no app. */
  onAgoraNao: () => void;
}

/**
 * Fim do teste grátis (tela 5 do desenho "Linha do tempo"), ou "Ver planos"
 * no meio dele (aí o topo diz quantos dias faltam): o cartão do
 * topo com o que ela fez, os 3 planos na moeda escolhida (2 e 3 meses com o preço
 * cheio riscado, quanto economiza, o selo de desconto e "preço por tempo
 * limitado"), "Seus dados continuam aqui", o botão do plano marcado e
 * "Agora não". Nenhum plano Garçom.
 */
export function PlanosTela({
  resumo,
  diasDoTeste,
  faltam,
  onEscolherPlano,
  onAgoraNao,
}: Props) {
  const moeda = useMoeda();
  const formatMoeda = useFormatMoeda();
  const [marcado, setMarcado] = useState<PlanoId>(PLANO_PADRAO);
  const plano = planoPorId(marcado);
  const chips = [
    resumo.atendimentos > 0
      ? `${resumo.atendimentos} ${resumo.atendimentos === 1 ? "atendimento" : "atendimentos"}`
      : null,
    resumo.registrado ? `${resumo.registrado} registrados` : null,
  ].filter(Boolean) as string[];
  const topo =
    faltam != null
      ? {
          titulo: TEXTOS_PLANOS.noTeste.titulo(faltam),
          texto: TEXTOS_PLANOS.noTeste.texto,
        }
      : {
          titulo: TEXTOS_PLANOS.fim.titulo(diasDoTeste),
          texto: TEXTOS_PLANOS.fim.texto,
        };

  return (
    <div
      className={styles.ob}
      role="dialog"
      aria-modal="true"
      aria-labelledby="planos-titulo"
      data-planos
    >
      <div className={styles.tela}>
        <div className={styles.endhero}>
          <div className={styles.t} id="planos-titulo">
            {topo.titulo}
          </div>
          <div className={styles.s}>{topo.texto}</div>
          {chips.length > 0 && (
            <div className={styles.stats}>
              {chips.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          )}
        </div>

        <div className={styles.plans} role="radiogroup" aria-label="Planos">
          {PLANOS.map((p) => {
            const cheio = cheioDoPlano(p, moeda);
            return (
              <button
                key={p.id}
                type="button"
                className={styles.plan}
                role="radio"
                aria-checked={p.id === marcado}
                onClick={() => setMarcado(p.id)}
                data-plano={p.id}
              >
                {cheio != null && (
                  <span className={styles.lim}>
                    <span className={styles.pc}>
                      −{percentualDesconto(p, moeda)}%
                    </span>
                    <span>preço por tempo limitado</span>
                  </span>
                )}
                <span className={styles.rd} />
                <span>
                  <span className={styles.nm}>{p.nome}</span>
                  <span className={styles.pm}>
                    {formatMoeda(precoPorMes(p, moeda), "auto")} por mês
                  </span>
                </span>
                <span className={styles.pr}>
                  {cheio != null && <s>{formatMoeda(cheio, "auto")}</s>}
                  <b>{formatMoeda(precoDoPlano(p, moeda), "auto")}</b>
                  {cheio != null && (
                    <span className={styles.sv}>
                      economiza {formatMoeda(economia(p, moeda), "auto")}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.keep}>
          <i>✓</i>
          <span>
            <b>Seus dados continuam aqui.</b> Atendimentos, metas, Cofre e Glow
            ficam guardados.
          </span>
        </div>

        <div className={styles.grow} />
        <button
          type="button"
          className={styles.cta}
          onClick={() => onEscolherPlano(plano)}
          data-escolher-plano
        >
          Continuar com {plano.nome} · {formatMoeda(precoDoPlano(plano, moeda), "auto")}
        </button>
        <button type="button" className={styles.cta2} onClick={onAgoraNao}>
          Agora não
        </button>
        <p className={styles.fine} style={{ marginTop: 0 }}>
          Mesmo acesso a tudo em todos os planos. Cancele quando quiser.
        </p>
      </div>
    </div>
  );
}
