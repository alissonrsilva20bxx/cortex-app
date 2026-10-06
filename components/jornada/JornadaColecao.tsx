"use client";

import { Star } from "lucide-react";
import type { EstadoJornada } from "@/lib/jornada/estado";
import {
  MES_EM_BRANCO,
  NOTA,
  SECAO,
  contagemEnfeites,
  nomeEnfeite,
  rotuloMesColecao,
} from "@/lib/jornada/textos";
import { JornadaSecao } from "./JornadaPecas";
import { mesesDaColecao, type MesNaColecao } from "./progresso";

/**
 * A coleção: um enfeite por mês fechado; os meses que ficaram em branco
 * aparecem tracejados, sem cor de erro (mês em branco não é castigo).
 */
export function JornadaColecao({
  estado,
  hoje,
}: {
  estado: EstadoJornada;
  hoje: Date;
}) {
  const meses = mesesDaColecao(estado, hoje);
  const temBranco = meses.some((m) => m.situacao === "branco");
  return (
    <JornadaSecao
      titulo={SECAO.colecao}
      chip={contagemEnfeites(estado.colecao.length)}
      nota={temBranco ? NOTA.mesesEmBranco : undefined}
    >
      <ul className="grid grid-cols-4 gap-2">
        {meses.map((m) => (
          <CelulaDoMes key={`${m.ano}-${m.mes}`} mes={m} />
        ))}
      </ul>
    </JornadaSecao>
  );
}

function CelulaDoMes({ mes }: { mes: MesNaColecao }) {
  const fechado = mes.situacao === "fechado";
  const rotulo = rotuloMesColecao(mes.ano, mes.mes);
  return (
    <li
      className="flex flex-col items-center gap-[6px] font-semibold"
      aria-label={
        fechado
          ? `${nomeEnfeite(mes.mes)} · ${rotulo}`
          : mes.situacao === "branco"
            ? `${MES_EM_BRANCO} · ${rotulo}`
            : rotulo
      }
      style={{
        padding: "10px 4px",
        borderRadius: "var(--radius-sm)",
        fontSize: "11px",
        color: fechado ? "var(--text)" : "var(--text-muted)",
        background: fechado ? "var(--j-selo-bg)" : "transparent",
        borderWidth: "1.5px",
        borderStyle: mes.situacao === "branco" ? "dashed" : "solid",
        borderColor: fechado ? "transparent" : "var(--j-mes-vazio)",
      }}
    >
      <Star
        size={20}
        aria-hidden
        style={{
          color: fechado ? "var(--j-selo-icone)" : "var(--j-bloqueado-icone)",
        }}
      />
      <span aria-hidden>{rotulo}</span>
    </li>
  );
}
