"use client";

import { MARCOS_DINHEIRO, type EstadoJornada } from "@/lib/jornada/estado";
import {
  MARCOS_DO_TOTAL,
  SECAO,
  money,
  textoMarco,
} from "@/lib/jornada/textos";
import { Ic } from "./IconeJornada";
import { cx, Secao } from "./JornadaPecas";
import s from "./jornada.module.css";

/**
 * "Seu dinheiro" (`moneyHTML` do protótipo): os marcos do total guardado.
 * O protótipo também mostra a meta atual (nome, quanto já tem, barra), o
 * total guardado, quantas metas ela concluiu e uma nota com o Glow de cada
 * coisa. Nada disso está no estado da Jornada (spec §8 guarda só os
 * marcos batidos) e o Glow é regra do servidor: fica fora até o operador
 * decidir (listado na PR).
 */
export function JornadaDinheiro({ estado }: { estado: EstadoJornada }) {
  return (
    <Secao titulo={SECAO.dinheiro} gap={12}>
      <div className={s.lbl} style={{ fontSize: "11px", marginTop: "4px" }}>
        {MARCOS_DO_TOTAL}
      </div>
      <div className={s.miles}>
        {MARCOS_DINHEIRO.map((marco) => {
          const batido = estado.marcos.includes(marco);
          return (
            <div
              key={marco}
              aria-label={textoMarco(marco)}
              className={cx(s.mile, batido && s.on)}
            >
              {batido ? (
                <Ic n="check" s={14} sw={3} />
              ) : (
                <Ic n="lock" s={13} sw={2.2} />
              )}
              {money(marco)}
            </div>
          );
        })}
      </div>
    </Secao>
  );
}
