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
}

interface Props {
  /** Abre o JobForm real em modo de criação (o mesmo do "+"). */
  onNovo: () => void;
  /** Abre o AgendaResumoSheet. `undefined` enquanto não há atendimento nenhum. */
  onResumo?: () => void;
  /** Abre o bloco de notas (NotasSection). */
  onAnotacoes: () => void;
  /** O descanso de hoje: como o botão está e o que ele registra. */
  descanso: { situacao: EstadoDescanso; onDescansar: () => void };
}

/**
 * Fileira de 4 ações da Agenda (J03): botões iguais, ícone num círculo
 * de 56px sobre `--card-solid`, rótulo embaixo, como o mockup.
 *
 * Cada botão liga numa ação que já existe no app. "Descanso" ocupa o lugar
 * do "Bloquear" (que volta com o bloqueio de horário, migration 0043): ele
 * registra o descanso do dia na Jornada. Já registrado, vira "Descansou";
 * em dia com atendimento fica desabilitado e a tela diz por quê. "Resumo"
 * só abre quando há pelo menos um atendimento.
 */
export function AgendaAcoes({
  onNovo,
  onResumo,
  onAnotacoes,
  descanso,
}: Props) {
  const feito = descanso.situacao === "feito";
  const comAtendimento = descanso.situacao === "comAtendimento";
  const acoes: Acao[] = [
    { label: "Novo", Icon: IconeMais, onClick: onNovo },
    {
      label: feito ? DESCANSO.feito : DESCANSO.botao,
      Icon: IconeDescanso,
      onClick: feito || comAtendimento ? undefined : descanso.onDescansar,
    },
    { label: "Resumo", Icon: IconeResumo, onClick: onResumo },
    { label: "Anotações", Icon: IconeAnotacoes, onClick: onAnotacoes },
  ];
  const motivo = feito
    ? DESCANSO.motivoDesabilitado
    : comAtendimento
      ? DESCANSO.motivoComAtendimento
      : null;

  return (
    <div className="flex flex-col" style={{ gap: "8px" }}>
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px" }}
      >
        {acoes.map(({ label, Icon, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            disabled={!onClick}
            // Sem esmaecer o desabilitado: o mockup mostra os 4 iguais (pixel
            // do mockup, ver o PR). O motivo vem na linha de baixo.
            className="flex flex-col items-center active:opacity-70"
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
