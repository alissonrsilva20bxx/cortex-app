"use client";

import { MARCOS_DINHEIRO, type EstadoJornada } from "@/lib/jornada/estado";
import {
  MARCO_ESCONDIDO,
  META_ATUAL,
  SECAO,
  contagemMetas,
  dinheiroEscondido,
  emPorcento,
  marcosDoTotal,
  metaDeAte,
  money,
  notaDinheiro,
  textoMarco,
} from "@/lib/jornada/textos";
import { Ic } from "./IconeJornada";
import { cx, Secao } from "./JornadaPecas";
import s from "./jornada.module.css";

/**
 * "Seu dinheiro" (`moneyHTML` do protótipo): quantas metas ela concluiu, a
 * meta atual (nome, quanto já tem, barra), o total guardado, os marcos e a
 * nota com o Glow de cada coisa. Tudo do servidor (0036: `dinheiro`, das
 * metas de verdade dela; `premios`). Com o Modo discreto, os valores somem
 * (protótipo: `moneyHidden`).
 */
export function JornadaDinheiro({ estado }: { estado: EstadoJornada }) {
  const dinheiro = estado.dinheiro;
  const meta = dinheiro?.meta ?? null;
  const escondido = estado.preferencias.modoDiscreto;
  const fracao =
    meta && meta.alvo > 0 ? Math.min(1, meta.atual / meta.alvo) : 0;
  const nota = estado.premios
    ? notaDinheiro(estado.premios.meta, estado.premios.marco)
    : null;
  return (
    <Secao
      titulo={SECAO.dinheiro}
      chip={dinheiro ? contagemMetas(dinheiro.metasConcluidas) : undefined}
      gap={12}
    >
      {meta && (
        <>
          <div className={s.mrow}>
            <div>
              <span className={s.lbl} style={{ fontSize: "11px" }}>
                {META_ATUAL}
              </span>
              <b>{meta.nome}</b>
            </div>
            <span className={s.n}>
              {escondido
                ? dinheiroEscondido()
                : metaDeAte(meta.atual, meta.alvo)}
            </span>
          </div>
          <div className={s.bar8}>
            <i
              style={{
                width: emPorcento(fracao),
                transition: "width .6s",
              }}
            />
          </div>
        </>
      )}
      <div className={s.lbl} style={{ fontSize: "11px", marginTop: "4px" }}>
        {marcosDoTotal(
          escondido ? dinheiroEscondido() : money(dinheiro?.totalGuardado ?? 0)
        )}
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
              {escondido ? MARCO_ESCONDIDO : money(marco)}
            </div>
          );
        })}
      </div>
      {nota && (
        <div className={s.note}>
          {nota[0]}
          <b>{nota[1]}</b>
          {nota[2]}
          <b>{nota[3]}</b>
          {nota[4]}
        </div>
      )}
    </Secao>
  );
}
