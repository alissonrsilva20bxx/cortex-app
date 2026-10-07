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

import { Award, Check, Coins, Crown, Sparkles, Star } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import type { Comemoracao } from "@/lib/jornada/estado";
import { liberarAudio, tocarSom, vibrar } from "@/lib/jornada/som";

import styles from "./Comemoracao.module.css";
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
  icone: "brilho" | "ok" | "selo" | "meta";
}

const ARCO = 477.5; // circunferência do anel (r = 76), como no protótipo

function iconeDaForma(c: Comemoracao, size: number) {
  switch (c.tipo) {
    case "selo":
      return <Award size={size} strokeWidth={2} />;
    case "capitulo":
      return <Star size={size} strokeWidth={2} />;
    case "marco":
    case "meta":
      return <Coins size={size} strokeWidth={2} />;
    case "estagio":
      return <Crown size={size} strokeWidth={1.8} />;
    default:
      return <Sparkles size={size} strokeWidth={2} />;
  }
}

function Letras({ texto }: { texto: string }) {
  let n = 0;
  return (
    <>
      {texto.split(" ").map((palavra, i) => (
        // O espaço fica FORA da palavra (inline-block corta espaço do fim),
        // como o `join(' ')` do protótipo.
        <Fragment key={i}>
          {i > 0 && " "}
          <span className={styles.palavra}>
            {palavra.split("").map((ch, j) => (
              <i
                key={j}
                className={styles.letra}
                style={{ animationDelay: `${n++ * 45}ms` }}
              >
                {ch}
              </i>
            ))}
          </span>
        </Fragment>
      ))}
    </>
  );
}

export function ComemoracaoPalco({ fila, ambiente, consumir }: PropsPalco) {
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
              : c.tipo === "meta" || c.tipo === "marco"
                ? "meta"
                : "selo",
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
      <Check size={18} strokeWidth={3} />
    ) : a.icone === "meta" ? (
      <Coins size={18} strokeWidth={2.2} />
    ) : a.icone === "selo" ? (
      <Award size={18} strokeWidth={2.2} />
    ) : (
      <Sparkles size={18} strokeWidth={2} fill="currentColor" />
    );

  const visivel = atual !== null && !fechando;
  const etapaClasse =
    atual?.plano.forma === "palco"
      ? [
          etapa >= 1 && styles.p1,
          etapa >= 3 && styles.p3,
          etapa >= 4 && styles.p4,
        ]
      : [etapa >= 1 && styles.go, etapa >= 5 && styles.pronto];

  return (
    <div className={styles.raiz} data-jornada-comemoracao="">
      {aviso && !pausada && (
        <div
          key={aviso.id}
          className={[
            styles.aviso,
            avisoOn && styles.on,
            aviso.neutro && styles.neutro,
          ]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          <span className={styles.avisoIcone}>{iconeAviso(aviso)}</span>
          <div className={styles.avisoTexto}>
            <b>{aviso.titulo}</b>
            {aviso.apoio && <span>{aviso.apoio}</span>}
          </div>
        </div>
      )}

      {atual && (
        <button
          type="button"
          key={atual.c.id}
          className={[styles.camada, visivel && styles.on, ...etapaClasse]
            .filter(Boolean)
            .join(" ")}
          aria-label={[atual.textos.chamada, atual.textos.titulo]
            .filter(Boolean)
            .join(" · ")}
          onClick={fechar}
          data-pode-seguir={podeSeguir ? "" : undefined}
        >
          {atual.plano.forma === "selo" ? (
            <>
              <span className={styles.escurece} />
              <span
                className={[styles.cartao, treme && styles.treme]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className={styles.raios} />
                <span className={styles.medalhaCaixa}>
                  <span className={styles.onda} />
                  <span className={`${styles.onda} ${styles.o2}`} />
                  <span
                    className={[
                      styles.medalha,
                      atual.c.tipo !== "selo" && styles.dourada,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {iconeDaForma(atual.c, 54)}
                  </span>
                </span>
                <span
                  className={`${styles.chamada} ${styles.surge} ${styles.s1}`}
                >
                  {atual.textos.chamada}
                </span>
                <span
                  className={`${styles.nomeSelo} ${styles.surge} ${styles.s2}`}
                >
                  {atual.textos.titulo}
                </span>
                {atual.textos.apoio && (
                  <span
                    className={`${styles.descricao} ${styles.surge} ${styles.s3}`}
                  >
                    {atual.textos.apoio}
                  </span>
                )}
                {atual.textos.glow && (
                  <span
                    className={`${styles.glow} ${styles.surge} ${styles.s4}`}
                  >
                    <Sparkles size={12} fill="currentColor" />
                    {atual.textos.glow}
                  </span>
                )}
              </span>
            </>
          ) : (
            <span className={styles.palco}>
              <span className={styles.palcoChamada}>
                {atual.textos.chamada}
              </span>
              <span className={styles.anel}>
                <span className={styles.onda} />
                <span className={`${styles.onda} ${styles.o2}`} />
                <svg viewBox="0 0 170 170" width="170" height="170" aria-hidden>
                  <defs>
                    <linearGradient
                      id="jornadaAnelGrad"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="1"
                    >
                      <stop offset="0" stopColor="#ffd9a0" />
                      <stop offset="1" stopColor="var(--accent)" />
                    </linearGradient>
                  </defs>
                  <circle
                    className={styles.anelFundo}
                    cx="85"
                    cy="85"
                    r="76"
                    fill="none"
                    strokeWidth="8"
                  />
                  <circle
                    className={styles.anelFrente}
                    cx="85"
                    cy="85"
                    r="76"
                    fill="none"
                    strokeWidth="8"
                    strokeLinecap="round"
                    transform="rotate(-90 85 85)"
                    strokeDasharray={ARCO}
                    strokeDashoffset={etapa >= 1 ? 0 : ARCO * 0.18}
                  />
                </svg>
                <span className={styles.anelIcone}>
                  {iconeDaForma(atual.c, etapa >= 3 ? 56 : 52)}
                </span>
              </span>
              <span
                className={[
                  styles.nomeGrande,
                  atual.c.tipo === "meta" && styles.menor,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Letras texto={atual.textos.titulo} />
              </span>
              {atual.textos.apoio && (
                <span className={styles.palcoApoio}>{atual.textos.apoio}</span>
              )}
              {atual.textos.glow && (
                <span className={styles.palcoGlow}>
                  <Sparkles size={14} fill="currentColor" />
                  {atual.textos.glow}
                </span>
              )}
            </span>
          )}
        </button>
      )}

      <canvas ref={canvasRef} className={styles.fx} aria-hidden />
    </div>
  );
}
