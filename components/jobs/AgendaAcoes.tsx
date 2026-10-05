"use client";

import { Ban, BarChart3, MessageSquareText, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Acao {
  label: string;
  Icon: LucideIcon;
  /** `undefined` = a ação não existe no app hoje; o botão fica desabilitado. */
  onClick?: () => void;
}

interface Props {
  /** Abre o JobForm real em modo de criação (o mesmo do "+"). */
  onNovo: () => void;
  /** Abre o AgendaResumoSheet. `undefined` enquanto não há atendimento nenhum. */
  onResumo?: () => void;
  /** Abre o bloco de notas (NotasSection). */
  onAnotacoes: () => void;
}

/**
 * Fileira de 4 ações da Agenda (J03): botões iguais, ícone num círculo
 * de 56px sobre `--card-solid`, rótulo embaixo, como o mockup.
 *
 * Cada botão liga numa ação que já existe no app. "Bloquear" não tem
 * equivalente hoje (não há bloqueio de horário na agenda), então fica
 * desabilitado com o rótulo certo, como o ticket manda, em vez de virar
 * uma ação nova. "Resumo" segue a regra que já existia: só abre quando há
 * pelo menos um atendimento.
 */
export function AgendaAcoes({ onNovo, onResumo, onAnotacoes }: Props) {
  const acoes: Acao[] = [
    { label: "Novo", Icon: Plus, onClick: onNovo },
    { label: "Bloquear", Icon: Ban },
    { label: "Resumo", Icon: BarChart3, onClick: onResumo },
    { label: "Anotações", Icon: MessageSquareText, onClick: onAnotacoes },
  ];

  return (
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
          className="flex flex-col items-center active:opacity-70 disabled:opacity-40"
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
            <Icon size={22} strokeWidth={2} />
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}
