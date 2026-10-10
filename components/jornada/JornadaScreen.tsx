"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AJUSTES_DA_JORNADA,
  CARREGANDO,
  MENSAGEM_ERRO,
  PREFERENCIAS,
  VOLTAR,
  tituloJornada,
} from "@/lib/jornada/textos";
import type { TipoPeriodo } from "@/lib/jornada/estado";
import type { TabId } from "@/lib/types";
import { useJornada } from "./useJornada";
import { Ic } from "./IconeJornada";
import { cx } from "./JornadaPecas";
import { JornadaAjustes } from "./JornadaAjustes";
import { JornadaCapitulo } from "./JornadaCapitulo";
import { JornadaColecao } from "./JornadaColecao";
import { JornadaComeco, type PassoDoComeco } from "./JornadaComeco";
import { JornadaDestrava } from "./JornadaDestrava";
import { JornadaDinheiro } from "./JornadaDinheiro";
import { JornadaEstagio } from "./JornadaEstagio";
import { JornadaOQueDaGlow } from "./JornadaOQueDaGlow";
import { JornadaPilares } from "./JornadaPilares";
import { JornadaRitmo } from "./JornadaRitmo";
import { JornadaSelos } from "./JornadaSelos";
import { BotoesDosResumos, JornadaRecap } from "./resumos/JornadaResumos";
import { hojeDoEstado } from "./progresso";
import s from "./jornada.module.css";

interface Props {
  userId: string;
  /** O primeiro nome dela (a prévia do perfil nos Ajustes). */
  nome: string;
  /** Inicial do nome dela (a prévia da moldura em "Destrava em"). */
  inicial: string;
  onVoltar: () => void;
  /** "Fazer" da Jornada de Começo: sai da Jornada e abre a aba do passo. */
  onIrPara: (aba: TabId) => void;
}

/** A aba onde ela faz cada passo da Jornada de Começo. */
const ABA_DO_PASSO: Record<Exclude<PassoDoComeco, "resumo">, TabId> = {
  planejar: "jobs",
  cofre: "cofre",
  rede: "rede",
  descanso: "jobs",
};

/**
 * A tela "Sua Jornada" no desenho EXATO do protótipo aprovado
 * (docs/jornada/referencias/prototipo-sua-jornada.html, `journeyHTML`):
 * barra de cima (voltar, título, Modo discreto, Ajustes), o estágio, o
 * capítulo, a coleção, o dinheiro, os 4 pilares, os selos, o que destrava
 * no próximo estágio e os botões dos resumos.
 *
 * Tudo vem do `useJornada`: nenhum número de Glow é decidido aqui e todo
 * texto vem de `lib/jornada/textos.ts`. Abre por cima do app (diálogo de
 * tela cheia, acima da barra de abas); Esc ou "Voltar" fecham.
 *
 * As peças com dados novos (o ritmo da semana, a meta de dinheiro, a % dos
 * pilares, o contador dos selos, "O que dá Glow", a Jornada de Começo)
 * vêm do servidor (0036, ordem do operador, spec §11).
 */
export function JornadaScreen({
  userId,
  nome,
  inicial,
  onVoltar,
  onIrPara,
}: Props) {
  const {
    estado,
    carregando,
    erro,
    salvarPreferencias,
    registrar,
    registrarAbertura,
  } = useJornada(userId);
  const [aparelho] = useState(() => new Date());
  const [ajustesAbertos, setAjustesAbertos] = useState(false);
  const [resumo, setResumo] = useState<TipoPeriodo | null>(null);
  const voltarRef = useRef<HTMLButtonElement>(null);
  // Guardado num ref: quem abre pode passar uma função nova a cada render
  // sem tirar o foco do "Voltar" de novo.
  const onVoltarRef = useRef(onVoltar);
  onVoltarRef.current = onVoltar;

  // Esc fecha o que estiver por cima (folha de ajustes, resumo) antes da
  // tela.
  const camadaRef = useRef<(() => void) | null>(null);
  camadaRef.current = ajustesAbertos
    ? () => setAjustesAbertos(false)
    : resumo
      ? () => setResumo(null)
      : null;

  useEffect(() => {
    voltarRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (camadaRef.current) camadaRef.current();
      else onVoltarRef.current();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  // Abrir a tela conta pro selo Primeiros passos (J10). É a única chamada
  // que o hook deixa fazer num efeito: conta uma vez por abertura do app.
  useEffect(() => {
    void registrarAbertura();
  }, [registrarAbertura]);

  // Jornada de Começo (0036): abrir um resumo é "Ver seu primeiro resumo".
  const abrirResumo = (tipo: TipoPeriodo) => {
    setResumo(tipo);
    void registrar("ver_resumo");
  };

  const discreto = estado?.preferencias.modoDiscreto ?? false;
  const hoje = estado ? hojeDoEstado(estado, aparelho) : aparelho;

  return (
    <div
      // Não é modal: a barra de abas fica por cima e continua usável (no
      // protótipo, tocar numa aba sai da Jornada).
      role="dialog"
      aria-labelledby="jornada-titulo"
      data-jornada-tela
      className={cx(
        s.raiz,
        "fixed inset-0 z-[45] overflow-y-auto no-scrollbar"
      )}
      style={{ background: "var(--t-phbg)" }}
    >
      <div data-jornada-corpo className={cx(s.pad, "mx-auto max-w-md")}>
        <div className={s.topbar}>
          {/* Os círculos de 40px do protótipo; o toque é de 44px (#198),
              com margem negativa pra nada sair do lugar. */}
          <button
            ref={voltarRef}
            type="button"
            onClick={onVoltar}
            aria-label={VOLTAR}
            className={s.toque}
          >
            <span className={s.rb}>
              <Ic n="chevl" s={20} />
            </span>
          </button>
          <h1 id="jornada-titulo">{tituloJornada(discreto)}</h1>
          <button
            type="button"
            onClick={() => void salvarPreferencias({ modoDiscreto: !discreto })}
            aria-label={PREFERENCIAS.modoDiscreto}
            aria-pressed={discreto}
            disabled={!estado}
            className={s.toque}
          >
            <span className={cx(s.rb, discreto && s.on)}>
              <Ic n={discreto ? "voloff" : "vol"} s={19} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAjustesAbertos(true)}
            aria-label={AJUSTES_DA_JORNADA}
            aria-haspopup="dialog"
            disabled={!estado}
            className={s.toque}
          >
            <span className={s.rb}>
              <Ic n="gear" s={19} />
            </span>
          </button>
        </div>

        {erro && (
          <p role="status" className={s.lbl} style={{ fontSize: "12px" }}>
            {MENSAGEM_ERRO[erro]}
          </p>
        )}

        {!estado ? (
          carregando && (
            <p role="status" className={s.lbl} style={{ fontSize: "13px" }}>
              {CARREGANDO}
            </p>
          )
        ) : (
          <>
            <JornadaEstagio estado={estado} />
            <JornadaComeco
              estado={estado}
              onFazer={(passo) => {
                if (passo === "resumo") abrirResumo("semana");
                else onIrPara(ABA_DO_PASSO[passo]);
              }}
            />
            <JornadaRitmo estado={estado} hoje={hoje} />
            {estado.capitulo && (
              <JornadaCapitulo
                capitulo={estado.capitulo}
                hoje={hoje}
                premio={estado.premios?.capitulo}
              />
            )}
            <JornadaColecao estado={estado} hoje={hoje} />
            <JornadaDinheiro estado={estado} />
            <JornadaPilares estado={estado} />
            <JornadaSelos estado={estado} />
            <JornadaDestrava estado={estado} inicial={inicial} />
            <JornadaOQueDaGlow estado={estado} />
            <BotoesDosResumos
              estado={estado}
              hoje={hoje}
              onAbrir={abrirResumo}
            />
          </>
        )}
      </div>

      {/* Folha e resumo cobrem a barra de abas (no protótipo, ficam por cima
          dela): moram no body, fora do empilhamento da tela, que fica
          ABAIXO da barra. */}
      {estado &&
        createPortal(
          <JornadaAjustes
            aberto={ajustesAbertos}
            estado={estado}
            nome={nome}
            inicial={inicial}
            onMudar={(parcial) => void salvarPreferencias(parcial)}
            onFechar={() => setAjustesAbertos(false)}
          />,
          document.body
        )}
      {estado &&
        resumo &&
        createPortal(
          <JornadaRecap
            estado={estado}
            tipo={resumo}
            hoje={hoje}
            onFechar={() => setResumo(null)}
          />,
          document.body
        )}
    </div>
  );
}
