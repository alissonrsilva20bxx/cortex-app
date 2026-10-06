"use client";

import type { Periodo, TipoPeriodo } from "@/lib/jornada/estado";
import {
  RESUMO_FEITOS,
  RESUMO_RODAPE,
  RESUMO_TITULO,
  RESUMO_VAZIO,
  resumoAcao,
  resumoAnterior,
  resumoDiasFortes,
  resumoGlow,
  resumoGuardou,
  resumoRitmo,
} from "@/lib/jornada/textos";
import {
  acoesFeitas,
  chaveDeGuardou,
  chaveDoRitmo,
  contador,
  periodoVazio,
} from "./leitura";

/**
 * Um período do resumo (J14, #164): o que ela construiu na semana, no mês
 * ou no ano. Só mostra o que `estado.periodos` entrega; não calcula nada.
 * Período fraco não vira cobrança, e período vazio é só vazio.
 */
interface Props {
  tipo: TipoPeriodo;
  atual: Periodo | null;
  fechado: Periodo | null;
}

export function ResumoPeriodo({ tipo, atual, fechado }: Props) {
  const vazio = periodoVazio(atual, tipo);
  const diasFortes = contador(atual, "dias_fortes");
  const ritmo = resumoRitmo(contador(atual, chaveDoRitmo(tipo)), tipo);
  const guardou = resumoGuardou(contador(atual, chaveDeGuardou(tipo)), tipo);
  const feitos = acoesFeitas(atual);
  const marcas = [
    diasFortes > 0 ? resumoDiasFortes(diasFortes) : null,
    ritmo,
    guardou,
  ].filter((t): t is string => t !== null);

  return (
    <section
      data-resumo={tipo}
      className="rounded-[var(--radius-lg)] p-4"
      style={{ background: "var(--card-solid)" }}
    >
      <h2 className="font-extrabold" style={{ fontSize: "15px" }}>
        {RESUMO_TITULO[tipo]}
      </h2>

      {vazio ? (
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--text-muted)" }}
          data-resumo-vazio
        >
          {RESUMO_VAZIO[tipo]}
        </p>
      ) : (
        <>
          <p className="mt-2 font-extrabold" style={{ fontSize: "20px" }}>
            {resumoGlow(contador(atual, "glow"), tipo)}
          </p>

          {marcas.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {marcas.map((texto) => (
                <li
                  key={texto}
                  className="rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    background: "var(--accent-tint)",
                    color: "var(--accent-deep-2)",
                  }}
                >
                  {texto}
                </li>
              ))}
            </ul>
          )}

          {feitos.length > 0 && (
            <>
              <p
                className="mt-4 text-xs font-bold"
                style={{ color: "var(--text-muted)" }}
              >
                {RESUMO_FEITOS}
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {feitos.map(({ acao, n }) => (
                  <li key={acao} className="text-sm">
                    {resumoAcao(acao, n)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {fechado && (
        <p
          className="mt-3 text-xs"
          style={{ color: "var(--text-muted)" }}
          data-resumo-anterior
        >
          {resumoAnterior(contador(fechado, "glow"), tipo)}
        </p>
      )}

      <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        {RESUMO_RODAPE}
      </p>
    </section>
  );
}
