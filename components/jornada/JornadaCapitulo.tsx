"use client";

import type { Capitulo, TipoMissao } from "@/lib/jornada/estado";
import {
  NOTA,
  emPorcento,
  nomeEnfeite,
  prazoCapitulo,
  premioCapitulo,
  progressoMissao,
  textoMissao,
  tituloCapitulo,
} from "@/lib/jornada/textos";
import { Ic, type NomeIcone } from "./IconeJornada";
import { cx, Nota, Secao } from "./JornadaPecas";
import { diasRestantes } from "./progresso";
import { ICONE_DO_ENFEITE } from "./JornadaColecao";
import s from "./jornada.module.css";

/** O ícone de cada missão (protótipo: o da ação que ela conta). */
const ICONE_DA_MISSAO: Record<TipoMissao, NomeIcone> = {
  planejar_dias: "cal",
  lancar_despesas: "receipt",
  tirar_descansos: "moon",
  guardar_semanas: "coins",
  comprovantes_cofre: "shieldp",
  dias_fortes: "pulse",
  semanas_firmes: "pulse",
  dica_ajudou: "bulb",
  dica_protegeu: "bulb",
  dica_ajudou_ou_protegeu: "bulb",
};

/**
 * "Capítulo de <mês>" (`chapterHTML` do protótipo): as 3 missões com a
 * barra de cada uma, o enfeite do mês e a nota. As missões e o progresso
 * vêm do servidor (spec §6).
 */
export function JornadaCapitulo({
  capitulo,
  hoje,
  premio,
}: {
  capitulo: Capitulo;
  hoje: Date;
  /** O Glow do capítulo fechado (0036, `premios.capitulo`). */
  premio?: number;
}) {
  const icone = ICONE_DO_ENFEITE[capitulo.mes - 1];
  return (
    <Secao
      titulo={tituloCapitulo(capitulo.mes)}
      chip={prazoCapitulo(diasRestantes(capitulo, hoje), capitulo.fechado)}
      gap={14}
    >
      <div className={s.mis}>
        {capitulo.missoes.map((missao) => {
          const feito = Math.min(missao.progresso, missao.alvo);
          const ok = feito >= missao.alvo;
          return (
            <div key={missao.tipo} className={cx(s.mi, ok && s.ok)}>
              <span className={s.mic}>
                {ok ? (
                  <Ic n="check" s={15} sw={3} />
                ) : (
                  <Ic n={ICONE_DA_MISSAO[missao.tipo]} s={15} sw={2.2} />
                )}
              </span>
              <div className={s.grow}>
                {textoMissao(missao.tipo, missao.alvo)}
                <div className={s.bar8}>
                  <i
                    style={{
                      width: emPorcento(feito / missao.alvo),
                    }}
                  />
                </div>
              </div>
              <span className={s.n}>
                {progressoMissao(missao.progresso, missao.alvo)}
              </span>
            </div>
          );
        })}
      </div>
      <div className={s.prize}>
        <span
          className={cx(
            s.orn,
            !capitulo.fechado && s.off,
            !capitulo.fechado && s.now
          )}
        >
          <Ic n={icone} s={20} sw={2.2} />
        </span>
        <div className={s.grow}>
          <b>{nomeEnfeite(capitulo.mes)}</b>
          <small>{premioCapitulo(capitulo.fechado, premio)}</small>
        </div>
      </div>
      <Nota texto={NOTA.capitulo} />
    </Secao>
  );
}
