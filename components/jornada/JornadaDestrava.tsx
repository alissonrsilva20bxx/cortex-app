"use client";

import type { EstadoJornada } from "@/lib/jornada/estado";
import {
  CHEIO,
  NOTA,
  itensDoEstagio,
  nomeEstagio,
  tituloDestrava,
  type ItemDestravado,
} from "@/lib/jornada/textos";
import { Icf } from "./IconeJornada";
import { cx, Nota, Secao } from "./JornadaPecas";
import s from "./jornada.module.css";

/**
 * A prévia de cada item (`unlockPreview(kind, size)` do protótipo):
 * moldura = o avatar com o aro em gradiente; tema = o círculo no tom
 * fundo; ícone = o quadrado com a faísca.
 */
export function PreviaDoItem({
  tipo,
  tamanho,
  inicial,
  className,
}: {
  tipo: ItemDestravado["tipo"];
  tamanho: number;
  /** A inicial dela no avatar da moldura (no protótipo, "B" de Bella). */
  inicial: string;
  className?: string;
}) {
  const lado = `${tamanho}px`;
  if (tipo === "moldura")
    return (
      <span
        className={cx(s.pv, className)}
        style={{
          width: lado,
          height: lado,
          background:
            "conic-gradient(from 210deg,#ffd9a0,var(--t-acc),#f7b6c8,#ffd9a0)",
          padding: "3px",
        }}
      >
        <span
          className={s.av}
          style={{
            width: CHEIO,
            height: CHEIO,
            fontSize: `${Math.round(tamanho * 0.38)}px`,
            border: "2px solid var(--t-card)",
          }}
        >
          {inicial}
        </span>
      </span>
    );
  if (tipo === "tema")
    return (
      <span
        className={cx(s.pv, className)}
        style={{
          width: lado,
          height: lado,
          background: "linear-gradient(135deg,var(--t-deep2),#3a0820)",
          boxShadow: "inset 0 0 0 3px rgba(255,255,255,.25)",
        }}
      />
    );
  return (
    <span
      className={cx(s.pv, s.sq, className)}
      style={{
        width: lado,
        height: lado,
        background: "linear-gradient(140deg,var(--t-acc),var(--t-deep))",
        color: "#fff",
      }}
    >
      <Icf n="spark" s={Math.round(tamanho * 0.45)} />
    </span>
  );
}

/**
 * "Destrava em <próximo estágio>" (protótipo): os 3 itens que o próximo
 * degrau dá (moldura, tema, ícone — os mesmos tipos que o servidor grava
 * em `jornada_destravados`, spec §4) e a nota de que nada é tirado.
 */
export function JornadaDestrava({
  estado,
  inicial,
}: {
  estado: EstadoJornada;
  inicial: string;
}) {
  const proximo = estado.estagio + 1;
  return (
    <Secao titulo={tituloDestrava(nomeEstagio(proximo))} gap={14}>
      <div className={s.unl}>
        {itensDoEstagio(proximo).map((item) => (
          <div key={item.tipo} className={s.un}>
            <PreviaDoItem tipo={item.tipo} tamanho={54} inicial={inicial} />
            {item.nome}
            <small>{item.descricao}</small>
          </div>
        ))}
      </div>
      <Nota texto={NOTA.estagio} />
    </Secao>
  );
}
