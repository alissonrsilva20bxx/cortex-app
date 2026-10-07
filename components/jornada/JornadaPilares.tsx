"use client";

import { PILARES, type EstadoJornada } from "@/lib/jornada/estado";
import {
  DESCRICAO_PILAR,
  NOME_PILAR,
  SECAO,
  dePorcento,
  emPorcento,
} from "@/lib/jornada/textos";
import { Anel } from "./JornadaPecas";
import s from "./jornada.module.css";

/**
 * "Seus 4 pilares" (protótipo: o anel de cada pilar com a porcentagem).
 * A porcentagem vem do servidor (0036, `pilares`), pela regra do
 * protótipo: cada Glow do pilar soma 1/160 (no Conectar, 4% por dica),
 * até 100%. Ordem do operador (spec §11).
 */
export function JornadaPilares({ estado }: { estado: EstadoJornada }) {
  return (
    <section className={s.cx} style={{ gap: "14px" }}>
      <div className={s.ch}>
        <h3>{SECAO.pilares}</h3>
      </div>
      <div className={s.pil}>
        {PILARES.map((pilar) => {
          const fracao = dePorcento(estado.pilares?.[pilar] ?? 0);
          return (
            <div key={pilar} className={s.pi}>
              <span className={s.rg}>
                <Anel tamanho={50} traco={5} fracao={fracao} />
                <span>{emPorcento(fracao)}</span>
              </span>
              <div>
                <b>{NOME_PILAR[pilar]}</b>
                <small>{DESCRICAO_PILAR[pilar]}</small>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
