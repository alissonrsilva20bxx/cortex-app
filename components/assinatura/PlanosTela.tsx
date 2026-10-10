"use client";

import { useState } from "react";
import styles from "@/components/onboarding/linhaDoTempo.module.css";
import {
  PLANOS,
  PLANO_PADRAO,
  economia,
  formatarEuro,
  percentualDesconto,
  planoPorId,
  precoPorMes,
  type OnEscolherPlano,
  type PlanoId,
} from "@/lib/planos";

interface Props {
  /** O que ela já fez no teste (os chips do cartão do topo). Só o que for
   * maior que zero aparece. */
  resumo: { atendimentos: number; registrado: string | null };
  /** Quantos dias o teste desta conta teve (7, ou 14 antes do corte). */
  diasDoTeste: number;
  /** Ponto de entrada do Pagamento: chamado com o plano marcado. */
  onEscolherPlano: OnEscolherPlano;
  /** "Agora não": fecha e continua no app. */
  onAgoraNao: () => void;
}

/**
 * Fim do teste grátis (tela 5 do desenho "Linha do tempo"): o cartão do
 * topo com o que ela fez, os 3 planos em euro (2 e 3 meses com o preço
 * cheio riscado, quanto economiza, o selo de desconto e "preço por tempo
 * limitado"), "Seus dados continuam aqui", o botão do plano marcado e
 * "Agora não". Nenhum plano Garçom.
 */
export function PlanosTela({
  resumo,
  diasDoTeste,
  onEscolherPlano,
  onAgoraNao,
}: Props) {
  const [marcado, setMarcado] = useState<PlanoId>(PLANO_PADRAO);
  const plano = planoPorId(marcado);
  const chips = [
    resumo.atendimentos > 0
      ? `${resumo.atendimentos} ${resumo.atendimentos === 1 ? "atendimento" : "atendimentos"}`
      : null,
    resumo.registrado ? `${resumo.registrado} registrados` : null,
  ].filter(Boolean) as string[];

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
            Seus {diasDoTeste} dias terminaram
          </div>
          <div className={styles.s}>
            Foi uma boa semana. Para seguir usando, escolha um plano.
          </div>
          {chips.length > 0 && (
            <div className={styles.stats}>
              {chips.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          )}
        </div>

        <div className={styles.plans} role="radiogroup" aria-label="Planos">
          {PLANOS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={styles.plan}
              role="radio"
              aria-checked={p.id === marcado}
              onClick={() => setMarcado(p.id)}
              data-plano={p.id}
            >
              {p.cheio != null && (
                <span className={styles.lim}>
                  <span className={styles.pc}>−{percentualDesconto(p)}%</span>
                  <span>preço por tempo limitado</span>
                </span>
              )}
              <span className={styles.rd} />
              <span>
                <span className={styles.nm}>{p.nome}</span>
                <span className={styles.pm}>
                  {formatarEuro(precoPorMes(p))} por mês
                </span>
              </span>
              <span className={styles.pr}>
                {p.cheio != null && <s>{formatarEuro(p.cheio)}</s>}
                <b>{formatarEuro(p.preco)}</b>
                {p.cheio != null && (
                  <span className={styles.sv}>
                    economiza {formatarEuro(economia(p))}
                  </span>
                )}
              </span>
            </button>
          ))}
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
          Continuar com {plano.nome} · {formatarEuro(plano.preco)}
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
