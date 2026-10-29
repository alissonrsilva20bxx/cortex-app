"use client";

import {
  UsersRound,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  Link2,
  MessageSquare as CommentIcon,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatMoeda } from "@/lib/moeda";
import { PLANOS, precoDoPlano } from "@/lib/planos";
import { TEXTOS_RENOVACAO_REDE as T } from "@/lib/rede/textosRede";
import { useMoeda } from "@/lib/useMoeda";

const ICONES = [Sparkles, MessageCircle, UsersRound, CommentIcon, Link2];

interface Props {
  /** Abre a escolha de plano (a mesma do "Ver planos" dos Ajustes). Sem
   * ela, o botão não aparece: botão sem efeito não existe. */
  onVerPlanos?: () => void;
}

/**
 * A Rede depois do teste grátis, sem assinatura: só a Rede para; o resto
 * do app segue liberado. Um botão, que leva à escolha de plano que já
 * existe (`PlanosTela`). Sem código, sem fila, sem beta.
 */
export function RedeRenovacao({ onVerPlanos }: Props) {
  const moeda = useMoeda();
  const precos = PLANOS.map(
    (p) => `${formatMoeda(precoDoPlano(p, moeda), moeda, "auto")} (${p.nome})`
  ).join(" · ");

  return (
    <div className="pb-4" data-rede-renovacao>
      <h2
        className="font-extrabold mb-5"
        style={{
          fontSize: "26px",
          letterSpacing: "-0.03em",
          color: "var(--text)",
        }}
      >
        {T.titulo}
      </h2>

      <GlassCard radius="xl" className="p-6 mb-6">
        <div
          className="flex items-center justify-center rounded-2xl mb-4"
          style={{
            width: 48,
            height: 48,
            background: "rgb(var(--accent-rgb) / 0.14)",
            boxShadow: "var(--glow-sm)",
          }}
        >
          <UsersRound size={22} style={{ color: "var(--accent)" }} />
        </div>
        <p
          className="font-black leading-tight"
          style={{
            fontSize: "24px",
            letterSpacing: "-0.03em",
            color: "var(--text)",
          }}
        >
          {T.chamada}
        </p>
        <p
          className="text-sm mt-2.5 leading-relaxed"
          style={{ color: "var(--text-2)" }}
        >
          {T.texto}
        </p>
      </GlassCard>

      <section className="mb-6">
        <p className="section-label mb-3">{T.beneficiosTitulo}</p>
        <GlassCard radius="lg" className="px-4">
          {T.beneficios.map((texto, i) => {
            const Icon = ICONES[i % ICONES.length];
            return (
              <div
                key={texto}
                className="flex items-center gap-3 py-3"
                style={
                  i > 0 ? { borderTop: "1px solid var(--divider)" } : undefined
                }
              >
                <Icon size={16} style={{ color: "var(--accent)" }} />
                <p className="text-sm" style={{ color: "var(--text)" }}>
                  {texto}
                </p>
              </div>
            );
          })}
        </GlassCard>
      </section>

      <section className="mb-6">
        <GlassCard radius="md" className="p-4 flex items-center gap-3.5">
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{
              width: 36,
              height: 36,
              background: "rgb(var(--accent-rgb) / 0.12)",
            }}
          >
            <ShieldCheck size={16} style={{ color: "var(--accent)" }} />
          </div>
          <div className="min-w-0">
            <p
              className="text-xs font-semibold"
              style={{ color: "var(--text)" }}
            >
              {T.dados}
            </p>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {T.planos(precos)}
            </p>
          </div>
        </GlassCard>
      </section>

      {onVerPlanos && (
        <button
          type="button"
          data-tour="rede-renovar"
          onClick={onVerPlanos}
          className="w-full py-3.5 rounded-2xl font-semibold text-base transition-opacity active:opacity-80"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {T.botao}
        </button>
      )}
    </div>
  );
}
