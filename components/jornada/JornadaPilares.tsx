"use client";

import { PILARES, type EstadoJornada } from "@/lib/jornada/estado";
import {
  DESCRICAO_PILAR,
  NOME_PILAR,
  SECAO,
  emPorcento,
} from "@/lib/jornada/textos";
import { Anel } from "./JornadaPecas";
import s from "./jornada.module.css";

/**
 * "Seus 4 pilares" (protótipo: o anel de cada pilar com a porcentagem).
 * O app guarda o Glow de cada pilar (spec §8); o anel mostra a parte do
 * Glow total que veio de cada um. É o número que existe; o protótipo não
 * define o que a porcentagem dele mede (listado na PR).
 */
export function JornadaPilares({ estado }: { estado: EstadoJornada }) {
  const total = PILARES.reduce((soma, p) => soma + estado.glowPorPilar[p], 0);
  return (
    <section className={s.cx} style={{ gap: "14px" }}>
      <div className={s.ch}>
        <h3>{SECAO.pilares}</h3>
      </div>
      <div className={s.pil}>
        {PILARES.map((pilar) => {
          const fracao = total > 0 ? estado.glowPorPilar[pilar] / total : 0;
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
