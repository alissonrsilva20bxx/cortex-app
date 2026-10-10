"use client";

import type { EstadoJornada } from "@/lib/jornada/estado";
import {
  NOTA,
  SECAO,
  contagemEnfeites,
  rotuloMesColecao,
} from "@/lib/jornada/textos";
import { Ic, type NomeIcone } from "./IconeJornada";
import { cx, Nota, Secao } from "./JornadaPecas";
import { mesesDaColecao } from "./progresso";
import s from "./jornada.module.css";

/** O ícone do enfeite de cada mês (protótipo: ORN), janeiro a dezembro. */
export const ICONE_DO_ENFEITE: NomeIcone[] = [
  "spark",
  "heart",
  "sprout",
  "bulb",
  "palette",
  "sun",
  "pulse",
  "coins",
  "bell",
  "moon",
  "sprout",
  "star",
];

/**
 * "Sua coleção" (`collectionHTML` do protótipo): um enfeite por mês, desde
 * o primeiro mês dela. Fechado = dourado; em branco = tracejado; o mês
 * atual = tracejado no acento.
 */
export function JornadaColecao({
  estado,
  hoje,
}: {
  estado: EstadoJornada;
  hoje: Date;
}) {
  const meses = mesesDaColecao(estado, hoje);
  const temBranco = meses.some((m) => m.situacao === "branco");
  return (
    <Secao
      titulo={SECAO.colecao}
      chip={contagemEnfeites(estado.colecao.length)}
      gap={14}
    >
      <div className={s.coll}>
        {meses.map((m) => {
          const fechado = m.situacao === "fechado";
          return (
            <div
              key={`${m.ano}-${m.mes}`}
              className={cx(s.co, fechado && s.got)}
            >
              <span
                className={cx(
                  s.orn,
                  !fechado && s.off,
                  m.situacao === "atual" && s.now
                )}
              >
                <Ic n={ICONE_DO_ENFEITE[m.mes - 1]} s={20} sw={2.2} />
              </span>
              {rotuloMesColecao(m.ano, m.mes)}
            </div>
          );
        })}
      </div>
      {temBranco && <Nota texto={NOTA.mesesEmBranco} />}
    </Secao>
  );
}
