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
  const raw = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // Achado da revisão visual #131: a classe utilitária de capitalize
  // (CSS text-transform) maiusculiza CADA palavra -- "Quarta-Feira, 23 De
  // Setembro", incluindo a preposição "de". pt-BR natural só maiusculiza
  // a primeira letra da frase (protótipo aprovado, /dev-preview/ios:
  // "Quinta-feira, 10 de setembro") -- feito no conteúdo, não via CSS,
  // pra também ficar certo se o texto for copiado/lido por leitor de tela.
  return raw.charAt(0).toUpperCase() + raw.slice(1);
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
          className="mt-[5px] leading-none text-base font-normal"
          style={{
            color: "var(--text-muted)",
          }}
        >
          {date}
        </p>
      </div>

      {/* Avatar — dado real (foto/inicial). 48×48, igual ao `.avatar` do
          protótipo aprovado (achado da revisão visual #131: estava em
          36px visual/44px de alvo de toque — o valor de 44px vinha de
          WCAG 2.5.5, mas 48px já é maior que o mínimo, então o alvo de
          toque real e a moldura voltam a ser o mesmo elemento, sem
          precisar do padding extra de antes). Redesign iOS quase nativo
          (#122/#124): agora é o único acesso a Ajustes, que saiu da
          BottomNav — precisa ser um botão real (teclado/leitor de tela),
          não mais decorativo. */}
      <button
        type="button"
        onClick={onOpenAjustes}
        aria-label="Abrir Ajustes"
        className="relative flex items-center justify-center rounded-full shrink-0 overflow-hidden transition-opacity active:opacity-70"
        style={{
          width: "48px",
          height: "48px",
          border: "1px solid var(--border-color)",
          background: "var(--surface)",
        }}
      >
        <span className="relative flex items-center justify-center w-full h-full">
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
