"use client";

import type { Acao, AcaoDaDica, EstadoJornada } from "@/lib/jornada/estado";
import {
  LINHA_GLOW,
  NOME_PILAR,
  NOTA,
  SECAO,
  UMA_VEZ_POR_MES,
  limiteDoDia,
  maisGlow,
} from "@/lib/jornada/textos";
import { Ic, Icf, type NomeIcone } from "./IconeJornada";
import { Nota } from "./JornadaPecas";
import s from "./jornada.module.css";

/** As linhas de ação, na ordem do protótipo (`wc`). */
const ACOES_DA_TABELA: [NomeIcone, Acao | AcaoDaDica][] = [
  ["cal", "planejar"],
  ["receipt", "despesa"],
  ["coins", "guardar_meta"],
  ["shieldp", "comprovante_cofre"],
  ["moon", "descanso"],
  ["bulb", "dica_ajudou"],
];

/** A faísca do `ptsTag` do protótipo (11px). */
const FAISCA = 11;

/** "+5 ✦" (`ptsTag` do protótipo). */
export function Pts({ glow }: { glow: number }) {
  return (
    <span className={s.pts}>
      {maisGlow(glow)} <Icf n="spark" s={FAISCA} />
    </span>
  );
}

function Linha({
  icone,
  texto,
  apoio,
  glow,
}: {
  icone: NomeIcone;
  texto: string;
  apoio: string;
  glow: number;
}) {
  return (
    <div className={s.r}>
      <span className={s.ri}>
        <Ic n={icone} s={16} sw={2.2} />
      </span>
      <div className={s.grow}>
        {texto}
        <small>{apoio}</small>
      </div>
      <Pts glow={glow} />
    </div>
  );
}

/**
 * "O que dá Glow" (protótipo): o Glow, o pilar e o limite do dia de cada
 * ação, e os prêmios de uma vez (meta, marco, capítulo). Tudo do servidor
 * (0036: `glowPorAcao` sai de `jornada_regra`; `premios`). Sem os dados
 * (servidor antigo), a seção não aparece.
 */
export function JornadaOQueDaGlow({ estado }: { estado: EstadoJornada }) {
  const { glowPorAcao, premios } = estado;
  if (!glowPorAcao || !premios) return null;
  return (
    <section className={s.cx} style={{ gap: "4px" }}>
      <div className={s.ch} style={{ marginBottom: "4px" }}>
        <h3>{SECAO.oQueDaGlow}</h3>
      </div>
      <div className={s.wc}>
        {ACOES_DA_TABELA.map(([icone, acao]) => {
          const regra = glowPorAcao[acao];
          if (!regra) return null;
          return (
            <Linha
              key={acao}
              icone={icone}
              texto={LINHA_GLOW[acao as keyof typeof LINHA_GLOW]}
              apoio={`${regra.pilar ? NOME_PILAR[regra.pilar] : ""} · ${limiteDoDia(regra.limite)}`}
              glow={regra.glow}
            />
          );
        })}
        <Linha
          icone="target"
          texto={LINHA_GLOW.meta}
          apoio={NOME_PILAR.prosperar}
          glow={premios.meta}
        />
        <Linha
          icone="coins"
          texto={LINHA_GLOW.marco}
          apoio={NOME_PILAR.prosperar}
          glow={premios.marco}
        />
        <Linha
          icone="star"
          texto={LINHA_GLOW.capitulo}
          apoio={UMA_VEZ_POR_MES}
          glow={premios.capitulo}
        />
      </div>
      <Nota texto={NOTA.oQueDaGlow} style={{ marginTop: "8px" }} />
    </section>
  );
}
