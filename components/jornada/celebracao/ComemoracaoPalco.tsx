"use client";

/**
 * Toca a fila de comemoração, DE UMA EM UMA, na ordem que veio (J13).
 * Apresentacional: recebe a fila, o ambiente (som, Modo discreto, movimento
 * reduzido) e a função de consumir. Quem liga isso ao hook da J11 é o
 * `ComemoracaoHost`; o laboratório pode montar este direto com uma fila de
 * exemplo.
 *
 * Linha do tempo de cada forma = a do protótipo aprovado (`small`, `medal`,
 * `bigShow`), com os tempos de `TEMPOS` (decidir.ts).
 */

import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import type { Comemoracao } from "@/lib/jornada/estado";
import { liberarAudio, tocarSom, vibrar } from "@/lib/jornada/som";
import { COMEMORACAO, NOME_GLOW, itensDoEstagio } from "@/lib/jornada/textos";

import { Ic, Icf, type NomeIcone } from "../IconeJornada";
import { ICONE_DO_ENFEITE } from "../JornadaColecao";
import { PreviaDoItem } from "../JornadaDestrava";
import { cx } from "../JornadaPecas";
import { ICONE_DO_SELO } from "../JornadaSelos";
import s from "../jornada.module.css";
import {
  type Ambiente,
  type Plano,
  type TextosComemoracao,
  TEMPOS,
  planoDaComemoracao,
  proximaParaTocar,
  textosDaComemoracao,
  tituloDoAviso,
} from "./decidir";
import { criarParticulas, type Particulas } from "./particulas";
import { useComemoracaoPausada } from "./pausa";
import {
  adiadasDaSessao,
  liberarAdiadas,
  primeiraVezDoConsumo,
  primeiraVezDoSom,
} from "./sessao";

export interface PropsPalco {
  fila: readonly Comemoracao[];
  ambiente: Ambiente;
  consumir: (id: string) => void;
  /** Inicial dela (a moldura nos itens do estágio novo). */
  inicial: string;
  /** "Ver minha Jornada" no estágio novo (protótipo); sem ele, "Continuar". */
  onVerJornada?: () => void;
}

/** Etapas visuais: 0 entrando, 1 anel/carimbo, 3 pico, 4 detalhes, 5 pronto. */
type Etapa = 0 | 1 | 3 | 4 | 5;

interface Atual {
  c: Comemoracao;
  plano: Plano;
  textos: TextosComemoracao;
}

interface Aviso {
  id: string;
  titulo: string;
  apoio: string;
  neutro: boolean;
  icone: "brilho" | "ok" | NomeIcone;
}

/** A faísca da pílula "+N ✦ Glow" do selo (protótipo: `icf(spark, 12)`). */
const TAMANHO_FAISCA_PILULA = 12;

const ARCO = 477.5; // circunferência do anel (r = 76), como no protótipo

/** Os ícones do estágio na trilha (protótipo: STAGES). */
const ICONE_DO_ESTAGIO: NomeIcone[] = [
  "sprout",
  "pulse",
  "layers",
  "star",
  "crown",
];

/** O ícone da medalha (protótipo: o do selo; o enfeite do mês no capítulo;
 * moedas no marco). */
function iconeDaMedalha(c: Comemoracao): NomeIcone {
  if (c.tipo === "selo" && c.selo) return ICONE_DO_SELO[c.selo];
  if (c.tipo === "capitulo" && c.capitulo)
    return ICONE_DO_ENFEITE[c.capitulo.mes - 1];
  return "coins";
}

/** O ícone do anel: antes do pico, o de onde ela veio; no pico, o novo
 * (protótipo: `icFrom` / `icTo`). Meta: alvo → moedas. */
function iconeDoAnel(c: Comemoracao, pico: boolean): NomeIcone {
  if (c.tipo === "meta") return pico ? "coins" : "target";
  const ultimo = ICONE_DO_ESTAGIO.length - 1;
  const nivel = c.estagio ?? 0;
  if (pico) return ICONE_DO_ESTAGIO[Math.min(nivel, ultimo)];
  return nivel > ultimo ? "crown" : ICONE_DO_ESTAGIO[Math.max(0, nivel - 1)];
}

/** O nome letra a letra (`lettersHTML` do protótipo). */
function Letras({ texto }: { texto: string }) {
  let n = 0;
  return (
    <>
      {texto.split(" ").map((palavra, i) => (
        // O espaço fica FORA da palavra (inline-block corta espaço do fim),
        // como o `join(' ')` do protótipo.
        <Fragment key={i}>
          {i > 0 && " "}
          <span className={s.w}>
            {palavra.split("").map((ch, j) => (
              <i key={j} style={{ animationDelay: `${n++ * 45}ms` }}>
                {ch}
              </i>
            ))}
          </span>
        </Fragment>
      ))}
    </>
  );
}

export function ComemoracaoPalco({
  fila,
  ambiente,
  consumir,
  inicial,
  onVerJornada,
}: PropsPalco) {
  const [, setVersao] = useState(0);
  const [atual, setAtual] = useState<Atual | null>(null);
  const [etapa, setEtapa] = useState<Etapa>(0);
  const [podeSeguir, setPodeSeguir] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [treme, setTreme] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [avisoOn, setAvisoOn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fxRef = useRef<Particulas | null>(null);
  const ambienteRef = useRef(ambiente);
  ambienteRef.current = ambiente;
  // Timers do aviso ficam FORA da linha do tempo do item: a fila segue
  // (consome) antes do aviso sumir, e a troca de item não pode cancelar o
  // "esconder" -- senão o último aviso ficava na tela.
  const avisoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Uma camada de cada vez (#196): com o recap do mês (ou outra camada que
  // pausa) aberto, nada toca e nada é consumido; a fila retoma depois.
  const pausada = useComemoracaoPausada();
  const adiadas = adiadasDaSessao(fila);
  const proxima = pausada ? null : proximaParaTocar(fila, adiadas);
  const proximaId = proxima?.id ?? null;
  const proximaRef = useRef(proxima);
  proximaRef.current = proxima;

  // Áudio liberado no primeiro toque; voltar ao primeiro plano = nova abertura.
  useEffect(() => {
    const toque = () => liberarAudio();
    const visivel = () => {
      if (document.visibilityState === "visible") {
        liberarAdiadas();
        setVersao((v) => v + 1);
      }
    };
    document.addEventListener("pointerdown", toque, { passive: true });
    document.addEventListener("visibilitychange", visivel);
    return () => {
      document.removeEventListener("pointerdown", toque);
      document.removeEventListener("visibilitychange", visivel);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const fx = criarParticulas(canvasRef.current);
    fxRef.current = fx;
    return () => {
      fx.parar();
      fxRef.current = null;
    };
  }, []);

  useEffect(
    () => () => {
      avisoTimers.current.forEach(clearTimeout);
    },
    []
  );

  const mostrarAviso = useCallback((a: Aviso, duracaoMs: number) => {
    avisoTimers.current.forEach(clearTimeout);
    setAviso(a);
    setAvisoOn(false);
    avisoTimers.current = [
      setTimeout(() => setAvisoOn(true), 16),
      setTimeout(() => setAvisoOn(false), duracaoMs),
      // depois da transição de saída (.55s), tira do DOM
      setTimeout(
        () =>
          setAviso((atualAviso) =>
            atualAviso?.id === a.id ? null : atualAviso
          ),
        duracaoMs + 600
      ),
    ];
  }, []);

  const terminar = useCallback(
    (id: string) => {
      if (primeiraVezDoConsumo(id)) consumir(id);
    },
    [consumir]
  );

  // Uma comemoração por vez: quando a próxima muda, monta a linha do tempo.
  useEffect(() => {
    const c = proximaRef.current;
    if (!c) {
      setAtual(null);
      return;
    }
    const amb = ambienteRef.current;
    const plano = planoDaComemoracao(c, amb);
    const textos = textosDaComemoracao(c, amb.modoDiscreto);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const depois = (ms: number, f: () => void) =>
      timers.push(setTimeout(f, ms));
    const fx = () => (plano.efeitos ? fxRef.current : null);

    // Som e vibração: uma vez por comemoração, mesmo montando duas vezes.
    if (primeiraVezDoSom(c.id)) {
      tocarSom(plano.som ?? "check", {
        ligado: plano.som !== null,
        atrasoSeg: plano.atrasoSom,
      });
      if (plano.vibracao !== null) {
        const padrao = plano.vibracao;
        depois(plano.forma === "selo" ? TEMPOS.seloImpacto : 0, () =>
          vibrar(padrao, true)
        );
      }
    }

    if (plano.forma === "aviso") {
      setAtual(null);
      mostrarAviso(
        {
          id: c.id,
          titulo: tituloDoAviso(textos),
          apoio: c.tipo === "pequena" ? textos.apoio : textos.glow,
          neutro: plano.neutro,
          icone:
            c.tipo === "pequena"
              ? plano.neutro
                ? "ok"
                : "brilho"
              : c.tipo === "estagio"
                ? ICONE_DO_ESTAGIO[
                    Math.min(c.estagio ?? 0, ICONE_DO_ESTAGIO.length - 1)
                  ]
                : iconeDaMedalha(c),
        },
        plano.duracaoMs
      );
      if (plano.efeitos) {
        const w = window.innerWidth;
        depois(60, () => fx()?.estouro(w / 2, 34, 16, false));
        depois(260, () => fx()?.estouro(w / 2 - 60, 34, 8, false));
      }
      depois(plano.seguirEmMs ?? plano.duracaoMs, () => terminar(c.id));
      return () => timers.forEach(clearTimeout);
    }

    setAtual({ c, plano, textos });
    setFechando(false);
    setTreme(false);

    if (!plano.animar) {
      setEtapa(5);
      setPodeSeguir(true);
      return () => timers.forEach(clearTimeout);
    }

    setEtapa(0);
    setPodeSeguir(false);
    if (plano.forma === "selo") {
      depois(TEMPOS.seloCarimbo, () => setEtapa(1));
      depois(TEMPOS.seloImpacto, () => {
        setTreme(true);
        const w = window.innerWidth;
        const h = window.innerHeight;
        fx()?.estouro(w / 2, h / 2 - 90, 34, true);
      });
      depois(TEMPOS.seloImpacto + 700, () => setPodeSeguir(true));
    } else {
      depois(TEMPOS.palcoAnel, () => setEtapa(1));
      depois(TEMPOS.palcoPico, () => {
        setEtapa(3);
        fx()?.confete();
      });
      depois(TEMPOS.palcoDetalhes, () => setEtapa(4));
      depois(TEMPOS.palcoPronto, () => {
        setEtapa(5);
        setPodeSeguir(true);
      });
    }
    return () => timers.forEach(clearTimeout);
  }, [proximaId, terminar, mostrarAviso]);

  const fechar = () => {
    if (!atual || !podeSeguir || fechando) return;
    setFechando(true);
    const id = atual.c.id;
    setTimeout(() => terminar(id), TEMPOS.respiro);
  };

  const iconeAviso = (a: Aviso) =>
    a.icone === "ok" ? (
      <Ic n="check" s={18} sw={3} />
    ) : a.icone === "brilho" ? (
      <Icf n="spark" s={18} />
    ) : (
      <Ic n={a.icone} s={18} sw={2.2} />
    );

  const visivel = atual !== null && !fechando;
  const ePalco = atual?.plano.forma === "palco";
  // Classes da linha do tempo, como o protótipo: selo = on → go; palco =
  // on → p1 (anel) → p3 (pico) → p4 (itens) → p5 (botão).
  const etapaClasse = ePalco
    ? [
        etapa >= 1 && s.p1,
        etapa >= 3 && s.p3,
        etapa >= 4 && s.p4,
        etapa >= 5 && s.p5,
      ]
    : [etapa >= 1 && s.go];
  const pico = etapa >= 3;
  const verJornada = atual?.c.tipo === "estagio" && onVerJornada !== undefined;

  /** O botão de baixo: fecha (e no estágio novo, leva pra Jornada). */
  const aoTocarNoBotao = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (verJornada && podeSeguir && !fechando) onVerJornada?.();
    fechar();
  };

  return (
    <div className={cx(s.raiz, s.palco)} data-jornada-comemoracao="">
      {aviso && !pausada && (
        <div
          key={aviso.id}
          className={cx(s.toast, avisoOn && s.on, aviso.neutro && s.neutral)}
          role="status"
          aria-live="polite"
        >
          <span className={s["t-ic"]}>{iconeAviso(aviso)}</span>
          <div className={s["t-tx"]}>
            <b>{aviso.titulo}</b>
            {aviso.apoio && <span>{aviso.apoio}</span>}
          </div>
        </div>
      )}

      {atual && !ePalco && (
        <div
          key={atual.c.id}
          className={cx(s.ov, s.ovSelo, visivel && s.on, ...etapaClasse)}
          role="alertdialog"
          aria-label={[atual.textos.chamada, atual.textos.titulo]
            .filter(Boolean)
            .join(" · ")}
          onClick={fechar}
          data-pode-seguir={podeSeguir ? "" : undefined}
        >
          <div className={s.dim} />
          <div className={cx(s.bcard, treme && s.shake)}>
            <div className={s.rays} />
            <div className={s["medal-w"]}>
              <span className={s.ripple} />
              <span className={cx(s.ripple, s.r2)} />
              <div className={cx(s.medal, atual.c.tipo !== "selo" && s.gold)}>
                <Ic n={iconeDaMedalha(atual.c)} s={54} sw={2} />
              </div>
            </div>
            <div className={cx(s["b-eye"], s.fade, s.f1)}>
              {atual.textos.chamada}
            </div>
            <div className={cx(s["b-name"], s.fade, s.f2)}>
              {atual.textos.titulo}
            </div>
            <div className={cx(s["b-desc"], s.fade, s.f3)}>
              {atual.textos.apoio}
            </div>
            {atual.c.glow > 0 && atual.textos.glow && (
              <div className={cx(s["b-pts"], s.fade, s.f4)}>
                +{atual.c.glow} <Icf n="spark" s={TAMANHO_FAISCA_PILULA} />{" "}
                {NOME_GLOW}
              </div>
            )}
            <button
              type="button"
              className={cx(s.cta, s.fade, s.f5)}
              onClick={aoTocarNoBotao}
            >
              {COMEMORACAO.continuar}
            </button>
          </div>
        </div>
      )}

      {atual && ePalco && (
        <div
          key={atual.c.id}
          className={cx(s.ov, s.ovEstagio, visivel && s.on, ...etapaClasse)}
          role="alertdialog"
          aria-label={[atual.textos.chamada, atual.textos.titulo]
            .filter(Boolean)
            .join(" · ")}
          onClick={fechar}
          data-pode-seguir={podeSeguir ? "" : undefined}
        >
          <div className={s.stg}>
            <div className={s["s-eye"]}>{atual.textos.chamada}</div>
            <div className={cx(s["s-ring"], pico && s.pop)}>
              <span className={s.ripple} />
              <span className={cx(s.ripple, s.r2)} />
              <svg viewBox="0 0 170 170" width="170" height="170" aria-hidden>
                <defs>
                  <linearGradient id="sgrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#ffd9a0" />
                    <stop offset="1" stopColor="var(--t-acc)" />
                  </linearGradient>
                </defs>
                <circle
                  className={s.bg}
                  cx="85"
                  cy="85"
                  r="76"
                  fill="none"
                  strokeWidth="8"
                />
                <circle
                  className={s.fg}
                  cx="85"
                  cy="85"
                  r="76"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  transform="rotate(-90 85 85)"
                  strokeDasharray={ARCO}
                  strokeDashoffset={etapa >= 1 ? 0 : (ARCO * 0.18).toFixed(1)}
                />
              </svg>
              <div className={s["s-ic"]}>
                <Ic
                  n={iconeDoAnel(atual.c, pico)}
                  s={pico ? 56 : 52}
                  sw={1.8}
                />
              </div>
            </div>
            <div
              className={cx(
                s["s-name"],
                atual.c.tipo === "meta" && s.sm,
                pico && s.show
              )}
            >
              <Letras texto={atual.textos.titulo} />
            </div>
            <div className={s["s-sub"]}>{atual.textos.apoio}</div>
            <div className={s["s-un"]}>
              {atual.c.tipo === "estagio"
                ? itensDoEstagio(atual.c.estagio ?? 0).map((item, i) => (
                    <div
                      key={item.tipo}
                      className={s["s-u"]}
                      style={{ transitionDelay: `${i * 150}ms` }}
                    >
                      <PreviaDoItem
                        tipo={item.tipo}
                        tamanho={40}
                        inicial={inicial}
                      />
                      <div>
                        <b>{item.nome}</b>
                        <small>{item.descricao}</small>
                      </div>
                    </div>
                  ))
                : atual.textos.glow && (
                    <div className={s["s-u"]}>
                      <span
                        className={cx(s.pv, s.sq)}
                        style={{
                          width: "40px",
                          height: "40px",
                          background:
                            "linear-gradient(140deg,var(--t-acc),var(--t-deep))",
                          color: "#fff",
                        }}
                      >
                        <Icf n="spark" s={18} />
                      </span>
                      <div>
                        <b>{atual.textos.glow}</b>
                        <small>{COMEMORACAO.metaVale}</small>
                      </div>
                    </div>
                  )}
            </div>
            <button
              type="button"
              className={s.cta}
              onClick={aoTocarNoBotao}
              style={
                atual.c.tipo === "estagio"
                  ? { background: "#fff", color: "#111114" }
                  : undefined
              }
            >
              {verJornada ? COMEMORACAO.verJornada : COMEMORACAO.continuar}
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className={s.fx} aria-hidden data-jornada-fx="" />
    </div>
  );
}
