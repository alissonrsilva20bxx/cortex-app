"use client";

import {
  Activity,
  CalendarCheck,
  Check,
  Coins,
  Lightbulb,
  Moon,
  Receipt,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { Capitulo, TipoMissao } from "@/lib/jornada/estado";
import {
  NOTA,
  nomeEnfeite,
  premioCapitulo,
  prazoCapitulo,
  progressoMissao,
  textoMissao,
  tituloCapitulo,
} from "@/lib/jornada/textos";
import { JornadaBarra, JornadaSecao } from "./JornadaPecas";
import { diasRestantes } from "./progresso";

const ICONE_DA_MISSAO: Record<TipoMissao, LucideIcon> = {
  planejar_dias: CalendarCheck,
  lancar_despesas: Receipt,
  tirar_descansos: Moon,
  guardar_semanas: Coins,
  comprovantes_cofre: ShieldCheck,
  dias_fortes: Activity,
  semanas_firmes: Activity,
  dica_ajudou: Lightbulb,
  dica_protegeu: Lightbulb,
  dica_ajudou_ou_protegeu: Lightbulb,
};

/**
 * O capítulo do mês: as 3 missões com o alvo e o progresso que o servidor
 * mandou, o prazo e o enfeite que vai pra coleção.
 */
export function JornadaCapitulo({
  capitulo,
  hoje,
}: {
  capitulo: Capitulo;
  hoje: Date;
}) {
  return (
    <JornadaSecao
      titulo={tituloCapitulo(capitulo.mes)}
      chip={prazoCapitulo(diasRestantes(capitulo, hoje), capitulo.fechado)}
      nota={NOTA.capitulo}
    >
      <ul className="flex flex-col gap-3">
        {capitulo.missoes.map((missao) => {
          const feita = missao.progresso >= missao.alvo;
          const Icone = feita ? Check : ICONE_DA_MISSAO[missao.tipo];
          return (
            <li key={missao.tipo} className="flex items-center gap-3">
              <span
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: "32px",
                  height: "32px",
                  background: feita ? "var(--j-feito)" : "var(--j-card-sub)",
                  color: feita ? "var(--on-accent)" : "var(--j-acento-texto)",
                }}
              >
                <Icone size={15} aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
                <span style={{ fontSize: "13px" }}>
                  {textoMissao(missao.tipo, missao.alvo)}
                </span>
                <JornadaBarra
                  fracao={missao.alvo > 0 ? missao.progresso / missao.alvo : 0}
                  cor={feita ? "var(--j-feito)" : "var(--j-progresso)"}
                />
              </div>
              <span
                className="shrink-0 font-bold tabular-nums"
                style={{
                  fontSize: "12px",
                  color: feita ? "var(--j-feito-texto)" : "var(--text-muted)",
                }}
              >
                {progressoMissao(missao.progresso, missao.alvo)}
              </span>
            </li>
          );
        })}
      </ul>
      <div
        className="flex items-center gap-3"
        style={{
          padding: "12px",
          borderRadius: "var(--radius-sm)",
          background: "var(--j-card-sub)",
        }}
      >
        <span
          className="flex shrink-0 items-center justify-center rounded-full"
          style={{
            width: "36px",
            height: "36px",
            background: capitulo.fechado
              ? "var(--j-selo-bg)"
              : "var(--j-bloqueado-bg)",
            color: capitulo.fechado
              ? "var(--j-selo-icone)"
              : "var(--j-bloqueado-icone)",
            boxShadow: capitulo.fechado
              ? undefined
              : "inset 0 0 0 1.5px var(--j-mes-vazio)",
          }}
        >
          <Star size={18} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="font-bold" style={{ fontSize: "13px" }}>
            {nomeEnfeite(capitulo.mes)}
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {premioCapitulo(capitulo.fechado)}
          </span>
        </div>
      </div>
    </JornadaSecao>
  );
}
