"use client";

import type { Preferencias } from "@/lib/jornada/estado";
import {
  AJUSTES_DA_JORNADA,
  DESCRICAO_PREFERENCIA,
  PREFERENCIAS,
  SUBTITULO_AJUSTES,
} from "@/lib/jornada/textos";
import { cx } from "./JornadaPecas";
import s from "./jornada.module.css";

type Chave = "somLigado" | "modoDiscreto";

const ROTULO: Record<Chave, string> = {
  somLigado: PREFERENCIAS.som,
  modoDiscreto: PREFERENCIAS.modoDiscreto,
};

const DESCRICAO: Record<Chave, string> = {
  somLigado: DESCRICAO_PREFERENCIA.som,
  modoDiscreto: DESCRICAO_PREFERENCIA.modoDiscreto,
};

function trocar(chave: Chave, valor: boolean): Partial<Preferencias> {
  return chave === "somLigado" ? { somLigado: valor } : { modoDiscreto: valor };
}

/**
 * Ajustes da Jornada na folha do protótipo (engrenagem no topo da tela,
 * `setHTML`): Sons e Modo discreto. A chave só grava a preferência (pelo
 * `useJornada`). As outras linhas da folha do protótipo (comemorações
 * calmas, selos no perfil, Jornada de Começo) não existem no app: ficam
 * fora (listado na PR). "Mostrar no perfil" é opt-in de outra entrega.
 */
export function JornadaAjustes({
  aberto,
  preferencias,
  onMudar,
  onFechar,
}: {
  aberto: boolean;
  preferencias: Preferencias;
  onMudar: (parcial: Partial<Preferencias>) => void;
  onFechar: () => void;
}) {
  const chaves: Chave[] = ["somLigado", "modoDiscreto"];
  return (
    <div className={s.palco}>
      <div
        className={cx(s["sheet-wrap"], aberto && s.on)}
        aria-hidden={!aberto}
      >
        <div className={s.dim} onClick={onFechar} />
        <div
          className={s.sheet}
          role="dialog"
          aria-modal="true"
          aria-label={AJUSTES_DA_JORNADA}
        >
          <div className={s.grab} />
          <h3>{AJUSTES_DA_JORNADA}</h3>
          <p className={s.sub}>{SUBTITULO_AJUSTES}</p>
          {chaves.map((chave) => (
            <label key={chave} className={s.sr}>
              <div className={s.grow}>
                <b>{ROTULO[chave]}</b>
                <small>{DESCRICAO[chave]}</small>
              </div>
              <input
                type="checkbox"
                role="switch"
                className={s.sw}
                checked={preferencias[chave]}
                tabIndex={aberto ? 0 : -1}
                onChange={() => onMudar(trocar(chave, !preferencias[chave]))}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
