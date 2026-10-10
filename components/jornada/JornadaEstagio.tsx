"use client";

import type { EstadoJornada } from "@/lib/jornada/estado";
import {
  CHEIO,
  NOME_GLOW,
  emPorcento,
  nomeEstagio,
  rotuloEstagio,
} from "@/lib/jornada/textos";
import { Ic, Icf, type NomeIcone } from "./IconeJornada";
import { cx } from "./JornadaPecas";
import { faltaProProximo, fracaoDoEstagio } from "./progresso";
import s from "./jornada.module.css";

/** Os 5 degraus da trilha, com o ícone de cada um (protótipo: STAGES). */
const ICONE_DO_DEGRAU: NomeIcone[] = [
  "sprout",
  "pulse",
  "layers",
  "star",
  "crown",
];
/** O último degrau da trilha é a Icônica; depois dela vêm os níveis. */
const ULTIMO_DEGRAU = ICONE_DO_DEGRAU.length - 1;

/**
 * O topo da tela (`.hero` do protótipo): estágio, Glow, a barra até o
 * próximo e a trilha dos 5 estágios. Tudo vem do estado: o servidor manda
 * o estágio e os cortes (`glowInicioEstagio`, `glowProximoEstagio`).
 */
export function JornadaEstagio({ estado }: { estado: EstadoJornada }) {
  const degrau = Math.min(estado.estagio, ULTIMO_DEGRAU);
  const fracao = fracaoDoEstagio(estado);
  // Preenchimento da trilha: os degraus já passados e o andado no atual.
  const preenchido =
    (degrau + (degrau < ULTIMO_DEGRAU ? fracao : 0)) / ULTIMO_DEGRAU;
  return (
    <section className={s.hero}>
      <div>
        <div className={s["h-eye"]}>{rotuloEstagio(estado.estagio)}</div>
        <div className={s["h-stage"]}>{nomeEstagio(estado.estagio)}</div>
      </div>
      <div className={s["h-sp"]}>
        <span className={s.spk}>
          <Icf n="spark" s={26} />
        </span>
        <b>{estado.glowTotal}</b>
        <span>{NOME_GLOW}</span>
      </div>
      <div className={s.hbar}>
        <i style={{ width: emPorcento(fracao, 1) }} />
      </div>
      <div className={s["h-cap"]}>
        <b>{faltaProProximo(estado)}</b> {NOME_GLOW} até{" "}
        <b>{nomeEstagio(estado.estagio + 1)}</b>
      </div>
      <div className={s.trail}>
        <span
          className={s.fill}
          style={{
            width: `calc((${CHEIO} - 26px) * ${preenchido.toFixed(3)})`,
          }}
        />
        {ICONE_DO_DEGRAU.map((icone, i) => {
          const feito = i < degrau;
          const atual = i === degrau;
          return (
            <div
              key={icone}
              className={cx(s.tn, feito && s.done, atual && s.cur)}
            >
              <span className={s.c}>
                {feito ? (
                  <Ic n="check" s={14} sw={3} />
                ) : (
                  <Ic n={icone} s={13} sw={2.2} />
                )}
              </span>
              {/* No último degrau, depois de Icônica: "Icônica II, III…" */}
              {i === ULTIMO_DEGRAU && estado.estagio > ULTIMO_DEGRAU
                ? nomeEstagio(estado.estagio)
                : nomeEstagio(i)}
            </div>
          );
        })}
      </div>
    </section>
  );
}
