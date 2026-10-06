"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import {
  CARREGANDO,
  MENSAGEM_ERRO,
  VOLTAR,
  tituloJornada,
} from "@/lib/jornada/textos";
import { useJornada } from "./useJornada";
import { JornadaAjustes } from "./JornadaAjustes";
import { JornadaCapitulo } from "./JornadaCapitulo";
import { JornadaColecao } from "./JornadaColecao";
import { JornadaDinheiro } from "./JornadaDinheiro";
import { JornadaEstagio } from "./JornadaEstagio";
import { JornadaPilares } from "./JornadaPilares";
import { JornadaSelos } from "./JornadaSelos";

interface Props {
  userId: string;
  onVoltar: () => void;
}

/**
 * A tela "Sua Jornada" (J12, #162), no desenho do protótipo aprovado
 * (docs/jornada/referencias/prototipo-sua-jornada.html): estágio e Glow,
 * capítulo do mês, coleção, dinheiro, os 4 pilares, selos e os ajustes.
 *
 * Tudo vem do `useJornada`: nenhum número de Glow é decidido aqui e todo
 * texto vem de `lib/jornada/textos.ts`. Abre por cima do app (diálogo de
 * tela cheia, acima da barra de abas); Esc ou "Voltar" fecham. Carregando
 * e erro são discretos: uma linha, nunca um bloqueio. Nada daqui vai pro
 * perfil público.
 */
export function JornadaScreen({ userId, onVoltar }: Props) {
  const { estado, carregando, erro, salvarPreferencias } = useJornada(userId);
  const [hoje] = useState(() => new Date());
  const voltarRef = useRef<HTMLButtonElement>(null);
  // Guardado num ref: quem abre pode passar uma função nova a cada render
  // sem tirar o foco do "Voltar" de novo.
  const onVoltarRef = useRef(onVoltar);
  onVoltarRef.current = onVoltar;

  useEffect(() => {
    voltarRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onVoltarRef.current();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const discreto = estado?.preferencias.modoDiscreto ?? false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="jornada-titulo"
      className="fixed inset-0 z-[60] overflow-y-auto no-scrollbar"
      style={{ background: "var(--j-tela-bg)", color: "var(--text)" }}
    >
      <div
        className="mx-auto flex max-w-md flex-col gap-[var(--space-section)] px-4 pb-10"
        style={{
          paddingTop:
            "calc(var(--space-shell-top) + env(safe-area-inset-top, 0px))",
        }}
      >
        <header className="flex items-center gap-2">
          <button
            ref={voltarRef}
            type="button"
            onClick={onVoltar}
            aria-label={VOLTAR}
            className="flex shrink-0 items-center justify-center rounded-full active:opacity-70"
            style={{
              width: "40px",
              height: "40px",
              background: "var(--j-card)",
            }}
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
          <h1
            id="jornada-titulo"
            className="font-extrabold"
            style={{ fontSize: "22px" }}
          >
            {tituloJornada(discreto)}
          </h1>
        </header>

        {erro && (
          <p
            role="status"
            style={{ fontSize: "12px", color: "var(--text-muted)" }}
          >
            {MENSAGEM_ERRO[erro]}
          </p>
        )}

        {!estado ? (
          carregando && (
            <p
              role="status"
              style={{ fontSize: "13px", color: "var(--text-muted)" }}
            >
              {CARREGANDO}
            </p>
          )
        ) : (
          <>
            <JornadaEstagio estado={estado} />
            {estado.capitulo && (
              <JornadaCapitulo capitulo={estado.capitulo} hoje={hoje} />
            )}
            <JornadaColecao estado={estado} hoje={hoje} />
            <JornadaDinheiro estado={estado} />
            <JornadaPilares estado={estado} />
            <JornadaSelos estado={estado} />
            <JornadaAjustes
              preferencias={estado.preferencias}
              onMudar={(parcial) => void salvarPreferencias(parcial)}
            />
          </>
        )}
      </div>
    </div>
  );
}
