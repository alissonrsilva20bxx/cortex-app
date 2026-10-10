"use client";

import type { EstadoJornada } from "@/lib/jornada/estado";
import {
  FAZER,
  PASSOS_DO_COMECO,
  SECAO,
  diaDoComeco,
  emPorcento,
} from "@/lib/jornada/textos";
import { Ic } from "./IconeJornada";
import { cx, Secao } from "./JornadaPecas";
import s from "./jornada.module.css";

/** Para onde o "Fazer" de cada passo leva (protótipo: STARTER[i][1]). Os 2
 * primeiros (PIN, primeira meta) não têm botão, como no protótipo. */
export type PassoDoComeco =
  | "planejar"
  | "cofre"
  | "rede"
  | "descanso"
  | "resumo";
const FAZER_DO_PASSO: (PassoDoComeco | null)[] = [
  null,
  null,
  "planejar",
  "cofre",
  "rede",
  "descanso",
  "resumo",
];

/**
 * "Jornada de Começo" (protótipo: `starter`): 7 passos curtos, só quando
 * ela liga nos Ajustes. Cada passo feito vem do servidor (0036,
 * `comeco.passos`, lido do que ela já fez); o "Fazer" leva ao lugar do app
 * onde ela faz aquilo.
 */
export function JornadaComeco({
  estado,
  onFazer,
}: {
  estado: EstadoJornada;
  onFazer: (passo: PassoDoComeco) => void;
}) {
  if (!estado.preferencias.jornadaComeco || !estado.comeco) return null;
  const passos = estado.comeco.passos;
  const feitos = passos.filter(Boolean).length;
  const agora = passos.indexOf(false);
  return (
    <Secao titulo={SECAO.comeco} chip={diaDoComeco(feitos)} gap={6}>
      <div className={s.bar8}>
        <i
          style={{
            width: emPorcento(feitos / PASSOS_DO_COMECO.length),
            transition: "width .6s",
          }}
        />
      </div>
      <div className={s["st-list"]}>
        {PASSOS_DO_COMECO.map((texto, i) => {
          const ok = passos[i] === true;
          const eAgora = i === agora;
          const fazer = FAZER_DO_PASSO[i];
          return (
            <div key={texto} className={cx(s.st, ok ? s.ok : eAgora && s.now)}>
              <span className={s.ck}>
                {ok ? <Ic n="check" s={13} sw={3} /> : i + 1}
              </span>
              <span className={s.grow}>{texto}</span>
              {eAgora && fazer && (
                <button
                  type="button"
                  className={s.go}
                  onClick={() => onFazer(fazer)}
                >
                  {FAZER}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Secao>
  );
}
