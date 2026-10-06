"use client";

import {
  ChevronRight,
  Crown,
  Footprints,
  Gem,
  Sprout,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useJornada } from "@/components/jornada/useJornada";
import { JornadaAnel } from "@/components/jornada/JornadaPecas";
import {
  contadorDaSemana,
  faltaProProximo,
  fracaoDoEstagio,
  missoesFeitas,
} from "@/components/jornada/progresso";
import {
  ABRIR_JORNADA,
  RITMO_COMPLETO,
  diasFortesNaSemana,
  enfeiteNaColecao,
  glowAteProximo,
  glowTotal,
  linhaCapitulo,
  nomeEstagio,
  tituloJornada,
} from "@/lib/jornada/textos";
import { InicioCard } from "./InicioCard";

/** Ícone de cada estágio (Começando → Icônica); depois da Icônica, o dela. */
const ICONE_DO_ESTAGIO: LucideIcon[] = [
  Footprints,
  Sprout,
  TrendingUp,
  Gem,
  Crown,
];

interface Props {
  userId: string;
  onAbrir: () => void;
}

/**
 * Card "Sua Jornada" no Início (J12, #162; protótipo aprovado): estágio,
 * Glow e quanto falta, os dias fortes da semana e o capítulo do mês. Tocar
 * abre a tela da Jornada.
 *
 * A Jornada nunca bloqueia o Início: sem estado ainda (carregando, ou erro
 * sem nada no cache), o card simplesmente não aparece.
 */
export function JornadaCard({ userId, onAbrir }: Props) {
  const { estado } = useJornada(userId);
  if (!estado) return null;

  const Icone =
    ICONE_DO_ESTAGIO[Math.min(estado.estagio, ICONE_DO_ESTAGIO.length - 1)];
  const capitulo = estado.capitulo;
  const ritmoCompleto = contadorDaSemana(estado, "firme") > 0;

  return (
    <InicioCard
      onClick={onAbrir}
      ariaLabel={ABRIR_JORNADA}
      className="flex flex-col gap-3"
      style={{ padding: "16px" }}
    >
      <div className="flex items-center gap-3">
        <JornadaAnel
          fracao={fracaoDoEstagio(estado)}
          tamanho={56}
          espessura={5}
        >
          <Icone
            size={22}
            aria-hidden
            style={{ color: "var(--j-acento-texto)" }}
          />
        </JornadaAnel>
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className="font-semibold"
            style={{ fontSize: "11px", color: "var(--text-muted)" }}
          >
            {tituloJornada(estado.preferencias.modoDiscreto)}
          </span>
          <span className="font-extrabold" style={{ fontSize: "18px" }}>
            {nomeEstagio(estado.estagio)}
          </span>
          <span
            className="flex flex-wrap gap-x-[6px] tabular-nums"
            style={{ fontSize: "12px", color: "var(--text-muted)" }}
          >
            <b style={{ color: "var(--text)" }}>
              {glowTotal(estado.glowTotal)}
            </b>
            <span aria-hidden>·</span>
            <span>
              {glowAteProximo(faltaProProximo(estado), estado.estagio + 1)}
            </span>
          </span>
        </div>
        <ChevronRight
          size={20}
          aria-hidden
          style={{ color: "var(--text-muted)" }}
        />
      </div>

      <div
        className="flex flex-col gap-[6px]"
        style={{
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          background: "var(--j-card-sub)",
          fontSize: "12px",
        }}
      >
        <span>
          {diasFortesNaSemana(contadorDaSemana(estado, "dias_fortes"))}
          {ritmoCompleto && (
            <span style={{ color: "var(--j-feito-texto)" }}>
              {" · "}
              {RITMO_COMPLETO}
            </span>
          )}
        </span>
        {capitulo && (
          <span style={{ color: "var(--text-muted)" }}>
            {capitulo.fechado
              ? enfeiteNaColecao(capitulo.mes)
              : linhaCapitulo(
                  capitulo.mes,
                  missoesFeitas(capitulo),
                  capitulo.missoes.length
                )}
          </span>
        )}
      </div>
    </InicioCard>
  );
}
