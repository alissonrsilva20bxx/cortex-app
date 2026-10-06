"use client";

import {
  CalendarCheck,
  CalendarDays,
  Coins,
  Footprints,
  HandHeart,
  House,
  Lock,
  Moon,
  Shield,
  ShieldCheck,
  Activity,
  Star,
  type LucideIcon,
} from "lucide-react";
import {
  SELOS,
  type EstadoJornada,
  type NivelSelo,
  type SeloId,
} from "@/lib/jornada/estado";
import {
  NIVEL_MAXIMO,
  NOTA,
  SECAO,
  SELO,
  contagemSelos,
  nomeSeloComNivel,
} from "@/lib/jornada/textos";
import { JornadaSecao } from "./JornadaPecas";

const ICONE_DO_SELO: Record<SeloId, LucideIcon> = {
  primeiros_passos: Footprints,
  planejadora: CalendarCheck,
  mao_amiga: HandHeart,
  semana_firme: Activity,
  rumo_a_meta: Coins,
  tudo_guardado: ShieldCheck,
  descansar_conta: Moon,
  guardia: Shield,
  em_casa: House,
  mes_a_mes: CalendarDays,
  um_ano: Star,
};

/** Os níveis I, II e III da spec §5. */
const NIVEIS: NivelSelo[] = [1, 2, 3];
const NIVEL_TOPO = NIVEIS[NIVEIS.length - 1];

/** Selo de nível único (Primeiros passos, Em casa, Um ano) não tem unidade. */
function temNiveis(selo: SeloId): boolean {
  return SELO[selo].unidade !== "";
}

/**
 * Os 11 selos: os conquistados com o nível (I, II, III) que o servidor
 * mandou; os que faltam, com cadeado e sem cor de erro.
 */
export function JornadaSelos({ estado }: { estado: EstadoJornada }) {
  const conquistados = SELOS.filter((s) => estado.selos[s]).length;
  return (
    <JornadaSecao
      titulo={SECAO.selos}
      chip={contagemSelos(conquistados, SELOS.length)}
      nota={NOTA.selos}
    >
      <ul className="grid grid-cols-3 gap-2">
        {SELOS.map((selo) => (
          <Selo key={selo} selo={selo} nivel={estado.selos[selo]} />
        ))}
      </ul>
    </JornadaSecao>
  );
}

function Selo({ selo, nivel }: { selo: SeloId; nivel?: NivelSelo }) {
  const ganho = nivel !== undefined;
  const Icone = ganho ? ICONE_DO_SELO[selo] : Lock;
  const niveis = temNiveis(selo);
  const nome =
    ganho && niveis ? nomeSeloComNivel(selo, nivel) : SELO[selo].nome;
  return (
    <li
      className="flex flex-col items-center gap-[6px] text-center"
      title={SELO[selo].descricao}
      style={{
        padding: "12px 4px",
        borderRadius: "var(--radius-sm)",
        background: "var(--j-card-sub)",
        fontSize: "11px",
        fontWeight: 700,
        color: ganho ? "var(--text)" : "var(--text-muted)",
      }}
    >
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: "44px",
          height: "44px",
          background: ganho ? "var(--j-selo-bg)" : "var(--j-bloqueado-bg)",
          color: ganho ? "var(--j-selo-icone)" : "var(--j-bloqueado-icone)",
        }}
      >
        <Icone size={ganho ? 22 : 17} aria-hidden />
      </span>
      <span className="leading-tight">{nome}</span>
      {niveis && (
        <span aria-hidden className="flex gap-[3px]">
          {NIVEIS.map((n) => (
            <i
              key={n}
              className="block rounded-full"
              style={{
                width: "6px",
                height: "6px",
                background:
                  ganho && n <= nivel
                    ? "var(--j-progresso)"
                    : "var(--j-trilho)",
              }}
            />
          ))}
        </span>
      )}
      {niveis && nivel === NIVEL_TOPO && (
        <span
          className="font-semibold"
          style={{ fontSize: "10px", color: "var(--text-muted)" }}
        >
          {NIVEL_MAXIMO}
        </span>
      )}
    </li>
  );
}
