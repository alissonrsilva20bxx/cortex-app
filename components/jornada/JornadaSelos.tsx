"use client";

import { SELOS, type EstadoJornada, type SeloId } from "@/lib/jornada/estado";
import { NOTA, SECAO, SELO, contagemSelos } from "@/lib/jornada/textos";
import { Ic, type NomeIcone } from "./IconeJornada";
import { cx, Nota, Secao } from "./JornadaPecas";
import s from "./jornada.module.css";

/** O ícone de cada selo (protótipo: BADGES), na ordem da spec §5. */
export const ICONE_DO_SELO: Record<SeloId, NomeIcone> = {
  primeiros_passos: "sprout",
  planejadora: "sun",
  mao_amiga: "bulb",
  semana_firme: "pulse",
  rumo_a_meta: "coins",
  tudo_guardado: "receipt",
  descansar_conta: "moon",
  guardia: "shield",
  em_casa: "home",
  mes_a_mes: "star",
  um_ano: "crown",
};

/** Os 3 níveis de um selo (I, II, III), como os 3 pontinhos do protótipo. */
const NIVEIS = ["I", "II", "III"] as const;

/** Selo de um nível só (sem contador): Primeiros passos, Em casa, Um ano. */
function temNiveis(selo: SeloId): boolean {
  return SELO[selo].unidade !== "";
}

/**
 * "Selos" (protótipo: a medalha, o nome e os pontinhos de nível). O nível
 * de cada selo vem do servidor. O protótipo também escreve o contador
 * até o próximo nível ("3/10"); o corte de cada nível é regra do servidor
 * e não vem no estado, então fica fora (listado na PR).
 */
export function JornadaSelos({ estado }: { estado: EstadoJornada }) {
  const conquistados = SELOS.filter((selo) => estado.selos[selo]).length;
  return (
    <Secao
      titulo={SECAO.selos}
      chip={contagemSelos(conquistados, SELOS.length)}
      gap={14}
    >
      <div className={s.badges}>
        {SELOS.map((selo) => {
          const nivel = estado.selos[selo] ?? 0;
          const tem = nivel > 0;
          return (
            <div key={selo} className={cx(s.bd, !tem && s.off)}>
              <span className={cx(s.md, tem ? s.on : s.off)}>
                {tem ? (
                  <Ic n={ICONE_DO_SELO[selo]} s={24} sw={2.2} />
                ) : (
                  <Ic n="lock" s={18} sw={2.2} />
                )}
              </span>
              {SELO[selo].nome}
              {temNiveis(selo) && (
                <span className={s.pips}>
                  {NIVEIS.map((p, i) => (
                    <i key={p} className={cx(i < nivel && s.on)} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <Nota texto={NOTA.selos} />
    </Secao>
  );
}
