"use client";

import type { EstadoJornada } from "@/lib/jornada/estado";
import {
  DIAS_FORTES_DO_RITMO,
  LEGENDA_RITMO,
  LETRAS_DOS_DIAS,
  NOTA,
  SECAO,
  chipRitmo,
} from "@/lib/jornada/textos";
import { Ic } from "./IconeJornada";
import { cx, Nota, Secao } from "./JornadaPecas";
import { diasFortesDaSemana, indiceDeHoje, marcasDaSemana } from "./progresso";
import s from "./jornada.module.css";

/**
 * A fileira dos 7 dias (`weekHTML` do protótipo): forte (check), descanso
 * (lua), hoje (anel) ou vazio. As marcas vêm do servidor (0036,
 * `semana.dias`). `grande` é a da tela; a pequena é a do resumo.
 */
export function SemanaDeBolinhas({
  estado,
  hoje,
  grande,
}: {
  estado: EstadoJornada;
  hoje: Date;
  grande: boolean;
}) {
  const marcas = marcasDaSemana(estado);
  const hojeI = indiceDeHoje(hoje);
  return (
    <div className={cx(s.week, grande && s.bigweek)}>
      {LETRAS_DOS_DIAS.map((letra, i) => {
        const marca = marcas[i];
        const classe =
          marca === "forte"
            ? s.strong
            : marca === "descanso"
              ? s.rest
              : i === hojeI && s.today;
        return (
          <div key={i} className={cx(s.day, i === hojeI && s["is-today"])}>
            <span className={cx(s.dot, classe)}>
              {marca === "forte" ? (
                <Ic n="check" s={grande ? 18 : 15} sw={3} />
              ) : marca === "descanso" ? (
                <Ic n="moon" s={grande ? 16 : 13} sw={2.4} />
              ) : null}
            </span>
            {letra}
          </div>
        );
      })}
    </div>
  );
}

/** "Ritmo da semana" (protótipo, logo depois do estágio). */
export function JornadaRitmo({
  estado,
  hoje,
}: {
  estado: EstadoJornada;
  hoje: Date;
}) {
  const fortes = diasFortesDaSemana(estado);
  return (
    <Secao titulo={SECAO.ritmo} chip={chipRitmo(fortes)} gap={12}>
      <SemanaDeBolinhas estado={estado} hoje={hoje} grande />
      <div className={s.legend}>
        <span>
          <i style={{ background: "var(--t-acc)" }} />
          {LEGENDA_RITMO.forte}
        </span>
        <span>
          <i style={{ background: "var(--t-soft)" }} />
          {LEGENDA_RITMO.descanso}
        </span>
        <span>
          <i style={{ boxShadow: "inset 0 0 0 2px var(--t-acc)" }} />
          {LEGENDA_RITMO.hoje}
        </span>
      </div>
      <Nota
        texto={fortes >= DIAS_FORTES_DO_RITMO ? NOTA.ritmoCompleto : NOTA.ritmo}
      />
    </Secao>
  );
}
