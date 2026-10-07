"use client";

import {
  SELOS,
  type EstadoJornada,
  type Preferencias,
} from "@/lib/jornada/estado";
import {
  AJUSTES_DA_JORNADA,
  COMEMORACOES,
  DESCRICAO_PREFERENCIA,
  ESTAGIO_OCULTO,
  PREFERENCIAS,
  SELOS_OCULTOS,
  SUBTITULO_AJUSTES,
  nomeEstagio,
} from "@/lib/jornada/textos";
import { Ic } from "./IconeJornada";
import { cx } from "./JornadaPecas";
import { ICONE_DO_SELO } from "./JornadaSelos";
import s from "./jornada.module.css";

type Chave =
  | "somLigado"
  | "modoDiscreto"
  | "estagioNoPerfil"
  | "selosNoPerfil"
  | "jornadaComeco";

/** A partir de que estágio o avatar ganha a moldura (protótipo: `avatar`). */
const ESTAGIO_DA_MOLDURA = 2;

/** O avatar do protótipo (`avatar(size)`): a inicial, com a moldura a
 * partir do estágio 3. */
export function AvatarDaJornada({
  inicial,
  estagio,
  tamanho,
}: {
  inicial: string;
  estagio: number;
  tamanho: number;
}) {
  const av = (
    <span
      className={s.av}
      style={{
        width: `${tamanho}px`,
        height: `${tamanho}px`,
        fontSize: `${Math.round(tamanho * 0.42)}px`,
      }}
    >
      {inicial}
    </span>
  );
  return estagio >= ESTAGIO_DA_MOLDURA ? (
    <span className={s.avf}>{av}</span>
  ) : (
    av
  );
}

/**
 * Ajustes da Jornada na folha do protótipo (engrenagem no topo da tela,
 * `setHTML`): Sons, Modo discreto, Comemorações (Completa | Calma), estágio
 * e selos no perfil, a prévia do perfil e a Jornada de Começo. Cada linha
 * grava a preferência dela no servidor (0036, `jornada_preferencias`) pelo
 * `useJornada`.
 */
export function JornadaAjustes({
  aberto,
  estado,
  nome,
  inicial,
  onMudar,
  onFechar,
}: {
  aberto: boolean;
  estado: EstadoJornada;
  nome: string;
  inicial: string;
  onMudar: (parcial: Partial<Preferencias>) => void;
  onFechar: () => void;
}) {
  const p = estado.preferencias;
  const ligado = (chave: Chave) => p[chave] === true;
  const linha = (chave: Chave, titulo: string, descricao: string) => (
    <label className={s.sr}>
      <div className={s.grow}>
        <b>{titulo}</b>
        <small>{descricao}</small>
      </div>
      <input
        type="checkbox"
        role="switch"
        className={s.sw}
        checked={ligado(chave)}
        tabIndex={aberto ? 0 : -1}
        onChange={() => onMudar({ [chave]: !ligado(chave) })}
      />
    </label>
  );
  const calma = p.comemoracoesCalmas === true;
  // Os 3 primeiros selos que ela tem (protótipo: `shownB.slice(0, 3)`).
  const selosDoPerfil = SELOS.filter((selo) => estado.selos[selo]).slice(0, 3);
  return (
    <div className={cx(s.raiz, s.palco)}>
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
          {/* `#setList` do protótipo: o `.sr:first-of-type` conta aqui
              dentro (a linha de Comemorações é a primeira div, sem traço). */}
          <div>
            {linha("somLigado", PREFERENCIAS.som, DESCRICAO_PREFERENCIA.som)}
            {linha(
              "modoDiscreto",
              PREFERENCIAS.modoDiscreto,
              DESCRICAO_PREFERENCIA.modoDiscreto
            )}
            <div className={s.sr} style={{ cursor: "default" }}>
              <div className={s.grow}>
                <b>{COMEMORACOES.titulo}</b>
                <small>{COMEMORACOES.descricao}</small>
              </div>
              <div
                className={s.psel}
                role="radiogroup"
                aria-label={COMEMORACOES.titulo}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={!calma}
                  tabIndex={aberto ? 0 : -1}
                  className={cx(!calma && s.on)}
                  onClick={() => onMudar({ comemoracoesCalmas: false })}
                >
                  {COMEMORACOES.completa}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={calma}
                  tabIndex={aberto ? 0 : -1}
                  className={cx(calma && s.on)}
                  onClick={() => onMudar({ comemoracoesCalmas: true })}
                >
                  {COMEMORACOES.calma}
                </button>
              </div>
            </div>
            {linha(
              "estagioNoPerfil",
              PREFERENCIAS.estagioNoPerfil,
              DESCRICAO_PREFERENCIA.estagioNoPerfil
            )}
            {linha(
              "selosNoPerfil",
              PREFERENCIAS.selosNoPerfil,
              DESCRICAO_PREFERENCIA.selosNoPerfil
            )}
            <div className={s.psv}>
              <AvatarDaJornada
                inicial={inicial}
                estagio={estado.estagio}
                tamanho={40}
              />
              <div className={s.nm}>
                {nome}
                <small>
                  {p.estagioNoPerfil
                    ? nomeEstagio(estado.estagio)
                    : ESTAGIO_OCULTO}
                </small>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
                {p.selosNoPerfil ? (
                  selosDoPerfil.map((selo) => (
                    <span
                      key={selo}
                      className={cx(s.md, s.on)}
                      style={{ width: "28px", height: "28px" }}
                    >
                      <Ic n={ICONE_DO_SELO[selo]} s={14} sw={2.2} />
                    </span>
                  ))
                ) : (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--t-mut)",
                      fontWeight: 600,
                    }}
                  >
                    {SELOS_OCULTOS}
                  </span>
                )}
              </div>
            </div>
            {linha(
              "jornadaComeco",
              PREFERENCIAS.jornadaComeco,
              DESCRICAO_PREFERENCIA.jornadaComeco
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
