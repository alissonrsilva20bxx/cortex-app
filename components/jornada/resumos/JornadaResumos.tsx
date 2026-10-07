"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { EstadoJornada, TipoPeriodo } from "@/lib/jornada/estado";
import {
  FECHAR,
  LETRAS_DOS_DIAS,
  RECAP,
  RESUMO_ABA,
  dinheiroEscondido,
  money,
  nomeEnfeite,
  nomeEstagio,
} from "@/lib/jornada/textos";
import { Ic, Icf } from "../IconeJornada";
import { ICONE_DO_ENFEITE } from "../JornadaColecao";
import { cx } from "../JornadaPecas";
import {
  faltaProProximo,
  marcasDaSemana,
  mesesDaColecao,
  missoesFeitas,
} from "../progresso";
import { contador } from "./leitura";
import s from "../jornada.module.css";

/** Quanto cada story fica na tela (protótipo: 5,5 s). */
const TEMPO_DO_STORY_MS = 5500;
/** O resumo do ano só aparece depois de um ano na Jornada (protótipo). */
const MESES_PRO_RESUMO_DO_ANO = 12;

/** Os meses que ela já viveu na Jornada: um capítulo por mês, desde o
 * primeiro, sem contar o mês em curso (fechado ou em branco, todos contam). */
export function mesesNaJornada(estado: EstadoJornada, hoje: Date): number {
  return mesesDaColecao(estado, hoje).filter((m) => m.situacao !== "atual")
    .length;
}

/**
 * Os botões dos resumos no fim da tela (`.rbtns` do protótipo): Semana e
 * Mês sempre; Ano só depois de 12 meses na Jornada.
 */
export function BotoesDosResumos({
  estado,
  hoje,
  onAbrir,
}: {
  estado: EstadoJornada;
  hoje: Date;
  onAbrir: (tipo: TipoPeriodo) => void;
}) {
  const tipos: TipoPeriodo[] =
    mesesNaJornada(estado, hoje) >= MESES_PRO_RESUMO_DO_ANO
      ? ["semana", "mes", "ano"]
      : ["semana", "mes"];
  return (
    <div className={s.rbtns}>
      {tipos.map((tipo) => (
        <button
          key={tipo}
          type="button"
          className={s["recap-btn"]}
          onClick={() => onAbrir(tipo)}
        >
          <Icf n="spark" s={14} />
          {RESUMO_ABA[tipo]}
        </button>
      ))}
    </div>
  );
}

/** As peças de um story, na ordem do protótipo (`slides()`). */
const K = (t: ReactNode) => <div className={s["rc-k"]}>{t}</div>;
const Big = (t: ReactNode) => <div className={s["rc-big"]}>{t}</div>;
const T = (t: ReactNode) => <div className={s["rc-t"]}>{t}</div>;
const S = (t: ReactNode) => <div className={s["rc-s"]}>{t}</div>;

function Compartilhar(k: string, texto: string) {
  return (
    <div className={s["rc-share"]}>
      <span className={s.k}>{k}</span>
      <b>{texto}</b>
      <small>{RECAP.semNome}</small>
    </div>
  );
}

/** Os stories de cada resumo, só com os contadores do período (spec §8).
 * Cada story é a lista de peças, na ordem em que o protótipo as põe. */
export function storiesDoResumo(
  estado: EstadoJornada,
  tipo: TipoPeriodo,
  hoje: Date
): ReactNode[][] {
  const periodo = estado.periodos.corrente[tipo];
  const fortes = contador(periodo, "dias_fortes");
  const guardou = contador(periodo, "guardar_meta");
  const glow = contador(periodo, "glow");
  const ateProximo = RECAP.ateProximo(
    faltaProProximo(estado),
    nomeEstagio(estado.estagio + 1)
  );
  // Prosperar: a meta de dinheiro dela (0036, `dinheiro`), como o
  // protótipo; com o Modo discreto, o valor some (`hidM`). Sem o dado
  // (servidor antigo), as vezes que ela guardou no período.
  const dinheiro = estado.dinheiro;
  const meta = dinheiro?.meta ?? null;
  const valor = (n: number) =>
    estado.preferencias.modoDiscreto ? dinheiroEscondido() : money(n);
  const prosperarSemDados = [
    K(RECAP.prosperar),
    Big(guardou),
    T(RECAP.vezesGuardando(guardou)),
    S(RECAP.futuro),
  ];
  const prosperar =
    meta && meta.alvo > 0
      ? [
          K(RECAP.prosperar),
          Big(valor(meta.atual)),
          T(RECAP.naMeta(meta.nome)),
          S(RECAP.jaECaminho(meta.atual / meta.alvo)),
        ]
      : prosperarSemDados;
  const prosperarNoMes = dinheiro
    ? [
        K(RECAP.prosperar),
        Big(valor(dinheiro.totalGuardado)),
        T(RECAP.guardadosNasMetas),
        S(RECAP.agoraMeta(dinheiro.metasConcluidas, meta?.nome ?? null)),
      ]
    : prosperarSemDados;
  const prosperarNoAno = dinheiro
    ? [
        K(RECAP.prosperar),
        Big(valor(dinheiro.totalGuardado)),
        T(RECAP.guardadosDeVerdade),
        S(RECAP.metasConcluidasPonto(dinheiro.metasConcluidas)),
      ]
    : prosperarSemDados;

  if (tipo === "mes") {
    const capitulo = estado.capitulo;
    const mes = capitulo?.mes ?? hoje.getMonth() + 1;
    return [
      [
        K(RECAP.seuMes(mes)),
        Big(fortes),
        T(RECAP.diasFortesNoMes(fortes)),
        S(RECAP.cadaUmNoMes),
      ],
      capitulo?.fechado
        ? [
            K(RECAP.capituloDe(mes)),
            <div key="o" className={s["rc-ornb"]}>
              <Ic n={ICONE_DO_ENFEITE[mes - 1]} s={46} sw={2} />
            </div>,
            T(RECAP.entrouNaColecao(nomeEnfeite(mes))),
            S(RECAP.enfeitesAteAgora(estado.colecao.length)),
          ]
        : [
            K(RECAP.capituloDe(mes)),
            Big(
              RECAP.missoesDe(
                capitulo ? missoesFeitas(capitulo) : 0,
                capitulo?.missoes.length ?? 0
              )
            ),
            T(RECAP.missoesFeitas),
            S(RECAP.seNaoFechar),
          ],
      prosperarNoMes,
      [
        K(RECAP.glowNoMes),
        Big(`+${glow}`),
        T(RECAP.voceEstaEm(nomeEstagio(estado.estagio))),
        S(`${ateProximo}.`),
      ],
      [
        K(RECAP.mesQueVem),
        T(RECAP.capituloNovo),
        Compartilhar(RECAP.esteMes, RECAP.diasCuidando(fortes)),
      ],
    ];
  }

  if (tipo === "ano") {
    const meses = mesesDaColecao(estado, hoje);
    return [
      [
        K(RECAP.seuAno),
        Big(mesesNaJornada(estado, hoje)),
        T(RECAP.mesesNaJornada),
        S(RECAP.idasEVindas),
      ],
      [
        K(RECAP.suaColecao),
        Big(estado.colecao.length),
        T(RECAP.enfeites),
        <div key="o" className={s["rc-orns"]}>
          {meses
            .filter((m) => m.situacao !== "atual")
            .map((m) => (
              <span
                key={`${m.ano}-${m.mes}`}
                className={cx(m.situacao === "branco" && s.off)}
              >
                <Ic n={ICONE_DO_ENFEITE[m.mes - 1]} s={16} sw={2.2} />
              </span>
            ))}
        </div>,
        S(RECAP.mesesEmBrancoNaoTiraram),
      ],
      prosperarNoAno,
      [
        K(RECAP.conectar),
        Big(estado.ajudou),
        T(RECAP.vezesAjudou),
        S(RECAP.eProtegeu(estado.protegeu)),
      ],
      [
        K(RECAP.glow),
        Big(estado.glowTotal),
        T(`${nomeEstagio(estado.estagio)}.`),
        S(RECAP.nadaZera),
      ],
      [K(RECAP.praGuardar), Compartilhar(RECAP.meuAno, RECAP.umAnoCuidando)],
    ];
  }

  return [
    [
      K(RECAP.suaSemana),
      Big(fortes),
      T(RECAP.diasFortes(fortes)),
      S(RECAP.apareceu),
      // A fileira da semana (protótipo: `.rc-week`), das marcas do servidor.
      <div key="w" className={s["rc-week"]}>
        {marcasDaSemana(estado).map((marca, i) => (
          <span key={i} className={cx(marca === "forte" && s.s)}>
            {marca === "descanso" ? (
              <Ic n="moon" s={14} sw={2.4} />
            ) : (
              LETRAS_DOS_DIAS[i]
            )}
          </span>
        ))}
      </div>,
    ],
    prosperar,
    [
      K(RECAP.conectar),
      Big(estado.ajudou),
      T(RECAP.mulheresAjudou),
      S(RECAP.soVoceVe),
    ],
    [
      K(RECAP.glowNaSemana),
      Big(`+${glow}`),
      T(`${ateProximo}.`),
      S(RECAP.cadaUmDeles),
    ],
    [
      K(RECAP.proximaSemana),
      T(RECAP.passoPequeno),
      Compartilhar(RECAP.estaSemana, RECAP.umPassoDeCada(fortes)),
    ],
  ];
}

/**
 * O resumo em stories (`#ovRecap` do protótipo): barra de segmentos,
 * fechar, tocar à esquerda/direita pra voltar/avançar, e cada story passa
 * sozinho depois de 5,5 s.
 */
export function JornadaRecap({
  estado,
  tipo,
  hoje,
  onFechar,
}: {
  estado: EstadoJornada;
  tipo: TipoPeriodo;
  hoje: Date;
  onFechar: () => void;
}) {
  const stories = storiesDoResumo(estado, tipo, hoje);
  const [atual, setAtual] = useState(0);
  const ir = useCallback(
    (i: number) => setAtual(Math.max(0, Math.min(stories.length - 1, i))),
    [stories.length]
  );

  useEffect(() => {
    if (atual >= stories.length - 1) return;
    const t = setTimeout(() => ir(atual + 1), TEMPO_DO_STORY_MS);
    return () => clearTimeout(t);
  }, [atual, ir, stories.length]);

  return (
    <div className={cx(s.raiz, s.palco)}>
      <div
        className={cx(s.ov, s.on, s.ovRecap)}
        role="dialog"
        aria-modal="true"
        aria-label={RESUMO_ABA[tipo]}
      >
        <div className={s["rc-seg"]}>
          {stories.map((_, k) => (
            <i
              key={k}
              className={cx(k < atual && s.done, k === atual && s.cur)}
            >
              <b />
            </i>
          ))}
        </div>
        <button
          type="button"
          className={s["rc-x"]}
          aria-label={FECHAR}
          onClick={onFechar}
        >
          <Ic n="x" s={22} sw={2.4} />
        </button>
        {/* `key` refaz a entrada (rcin) a cada story, como o protótipo. */}
        <div key={atual} className={s["rc-body"]}>
          {stories[atual].map((peca, i) => (
            <Fragment key={i}>{peca}</Fragment>
          ))}
        </div>
        <div className={s["rc-tap"]}>
          <span onClick={() => ir(atual - 1)} />
          <span onClick={() => ir(atual + 1)} />
          <span onClick={() => ir(atual + 1)} />
        </div>
      </div>
    </div>
  );
}
