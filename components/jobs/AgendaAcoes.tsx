"use client";

import type { ComponentType } from "react";
import type { EstadoDescanso } from "@/lib/atendimentos/status";
import {
  IconeAnotacoes,
  IconeDescanso,
  IconeMais,
  IconeResumo,
} from "./agendaIcones";
import { DESCANSO } from "./textosAgenda";

interface Acao {
  label: string;
  Icon: ComponentType<{ size?: number }>;
  /** `undefined` = o botão fica desabilitado (e a tela diz o motivo). */
  onClick?: () => void;
  /** Só no Descanso: o dia está marcado (`aria-pressed`). */
  pressionado?: boolean;
}

interface Props {
  /** Abre o JobForm real em modo de criação (o mesmo do "+"). */
  onNovo: () => void;
  /** Abre o AgendaResumoSheet. `undefined` enquanto não há atendimento nenhum. */
  onResumo?: () => void;
  /** Abre o bloco de notas (NotasSection). */
  onAnotacoes: () => void;
  /** O descanso do dia selecionado: como o botão está; tocar marca ou desfaz. */
  descanso: { situacao: EstadoDescanso; onAlternar: () => void };
}

/**
 * Fileira de 4 ações da Agenda (J03): botões iguais, ícone num círculo
 * de 56px sobre `--card-solid`, rótulo embaixo, como o mockup.
 *
 * Cada botão liga numa ação que já existe no app. "Descanso" marca o dia
 * selecionado como descanso (o de hoje conta na Jornada). Marcado, vira
 * "Descansou" (hoje) ou "Vai descansar" (dia futuro) e tocar de novo
 * desfaz; em dia com atendimento ou que já passou fica desabilitado e a
 * tela diz por quê. "Resumo" só abre quando há pelo menos um atendimento.
 */
export function AgendaAcoes({
  onNovo,
  onResumo,
  onAnotacoes,
  descanso,
}: Props) {
  const { situacao } = descanso;
  const marcado = situacao === "feito" || situacao === "planejado";
  const podeTocar = marcado || situacao === "normal";
  const acoes: Acao[] = [
    { label: "Novo", Icon: IconeMais, onClick: onNovo },
    {
      label:
        situacao === "planejado"
          ? DESCANSO.planejado
          : marcado
            ? DESCANSO.feito
            : DESCANSO.botao,
      Icon: IconeDescanso,
      onClick: podeTocar ? descanso.onAlternar : undefined,
      pressionado: marcado,
    },
    { label: "Resumo", Icon: IconeResumo, onClick: onResumo },
    { label: "Anotações", Icon: IconeAnotacoes, onClick: onAnotacoes },
  ];
  const motivo =
    situacao === "feito" || situacao === "planejado"
      ? DESCANSO.motivoDesfazer
      : situacao === "comAtendimento"
        ? DESCANSO.motivoComAtendimento
        : situacao === "passou"
          ? DESCANSO.motivoPassou
          : null;

  return (
    <div className="flex flex-col" style={{ gap: "8px" }}>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px" }}
      >
        {acoes.map(({ label, Icon, onClick, pressionado }, i) => (
          <button
            key={i}
            type="button"
            onClick={onClick}
            disabled={!onClick}
            aria-pressed={pressionado}
            // Desabilitado esmaece (opacity-50, como os outros botões do app);
            // o motivo vem na linha de baixo.
            className="flex flex-col items-center active:opacity-70 disabled:opacity-50"
            style={{
              gap: "8px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            <span
              className="flex items-center justify-center rounded-full"
              style={{
                width: "56px",
                height: "56px",
                background: "var(--card-solid)",
                color: "var(--accent-deep)",
              }}
            >
              <Icon size={22} />
            </span>
            {label}
          </button>
        ))}
      </div>
      {motivo && (
        <p
          data-descanso-motivo
          className="text-center"
          style={{ fontSize: "12px", color: "var(--text-muted)" }}
        >
          {motivo}
        </p>
      )}
    </div>
  );
}
