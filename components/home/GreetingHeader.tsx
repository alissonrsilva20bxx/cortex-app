import { useMemo } from "react";
import type { Usuario } from "@/lib/types";

interface Props {
  usuario: Usuario;
  /** Redesign iOS quase nativo (wayfinder #122, ticket #124): Ajustes saiu
   * da BottomNav — o avatar da Início é agora o único ponto de acesso. */
  onOpenAjustes: () => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function getFirstName(nome: string): string {
  return nome.split(" ")[0];
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function GreetingHeader({ usuario, onOpenAjustes }: Props) {
  const greeting = useMemo(getGreeting, []);
  const date = useMemo(getFormattedDate, []);
  const firstName = getFirstName(usuario.nome);

  return (
    <div className="flex items-start justify-between">
      <div>
        {/* Fundação Visual (redesign #122, ticket #142): escala corrigida
            pra bater com `.greetingHeader h1/p` do protótipo aprovado
            (30px/760/-0.035em título, 16px corpo/muted subtítulo; 28px
            <390px) -- a escala anterior (17px/600 título, 10px subtítulo)
            era uma decisão deliberada só do laboratório antigo, nunca
            revisitada depois do protótipo iOS ser aprovado. Ver
            docs/visual/IOS_VISUAL_SYSTEM.md, linha "Divergência real
            confirmada". */}
        <h1
          className="leading-[1.12] text-[28px] min-[390px]:text-[30px]"
          style={{
            fontWeight: 760,
            letterSpacing: "-0.035em",
            color: "var(--text)",
          }}
        >
          {greeting}, {firstName}
        </h1>
        <p
          className="capitalize mt-[5px] leading-none text-base font-normal"
          style={{
            color: "var(--text-muted)",
          }}
        >
          {date}
        </p>
      </div>

      {/* Avatar — dado real (foto/inicial), moldura sóbria do laboratório
          (border-white/[0.07] + bg-white/[0.035], sem glow): brilho só em
          seleção/progresso/ação primária, nunca decorativo. 36px visual
          como os botões de ícone do laboratório; o alvo de toque real
          cresce até 44px (WCAG 2.5.5) via padding, sem alterar a moldura.
          Redesign iOS quase nativo (#122/#124): agora é o único acesso a
          Ajustes, que saiu da BottomNav — precisa ser um botão real
          (teclado/leitor de tela), não mais decorativo. */}
      <button
        type="button"
        onClick={onOpenAjustes}
        aria-label="Abrir Ajustes"
        className="relative flex items-center justify-center rounded-full shrink-0 transition-opacity active:opacity-70"
        style={{
          width: "44px",
          height: "44px",
        }}
      >
        <span
          className="relative flex items-center justify-center rounded-full overflow-hidden"
          style={{
            width: "36px",
            height: "36px",
            border: "1px solid var(--border-color)",
            background: "var(--surface)",
          }}
        >
          {usuario.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={usuario.avatarUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="text-sm font-bold"
              style={{ color: "var(--accent)" }}
            >
              {firstName.charAt(0).toUpperCase()}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
