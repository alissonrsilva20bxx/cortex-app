"use client";

import { createContext, useContext } from "react";
import { Avatar } from "./Avatar";
import { IconeBusca, IconeCasa, IconeSino } from "./redeIcones";

/**
 * Topo da Rede no modelo Doca (protótipo aprovado .lavish/rede-doca-final
 * .html): a lupa, o sino e a foto da própria usuária ficam no cabeçalho,
 * e a foto aparece em TODAS as telas da Rede (abre o Meu espaço; é o alvo
 * do tour, data-tour="rede-perfil"). Conversas e Amigas desceram para a
 * barra da Rede (DocaBar).
 *
 * O RedeTab entrega estes dados por contexto, para as subtelas (que já
 * usam ScreenHeader) ganharem a foto sem cada uma receber mais props.
 */
export interface RedeTopoValor {
  usuarioNome: string;
  usuarioFotoUrl: string | null;
  unreadNotifs: number;
  onBuscar: () => void;
  onNotificacoes: () => void;
  onMeuEspaco: () => void;
  /** A casinha: sai da Rede e volta para o Início do app. */
  onSairDaRede?: () => void;
  /** A tela é uma das "abas" da barra (Feed, Conversas, Amigas, Eu): o
   * cabeçalho mostra a casinha e os atalhos, não o "Voltar". */
  raiz: boolean;
}

export const RedeTopoContext = createContext<RedeTopoValor | null>(null);

export function useRedeTopo() {
  return useContext(RedeTopoContext);
}

/** Botão redondo de 44 com o ícone de 22 (alvo de toque do app). */
export function BotaoTopo({
  label,
  onClick,
  ponto = false,
  children,
}: {
  label: string;
  onClick: () => void;
  /** Tem coisa nova: o ponto no acento, como o RedeHeader já fazia. */
  ponto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative grid place-items-center rounded-full shrink-0 transition-transform active:scale-95"
      style={{ width: 44, height: 44, color: "var(--text)" }}
    >
      {children}
      {ponto && (
        <span
          aria-hidden
          data-ponto-novidade=""
          className="absolute rounded-full"
          style={{
            top: 9,
            right: 9,
            width: 9,
            height: 9,
            background: "var(--accent)",
            boxShadow: "0 0 0 2px var(--rede-bg)",
          }}
        />
      )}
    </button>
  );
}

/** A foto da própria usuária: abre o Meu espaço. Alvo do tour do app
 * (lib/appTour.ts, passo "rede-perfil"). */
export function BotaoFotoPerfil() {
  const topo = useRedeTopo();
  if (!topo) return null;
  return (
    <span
      data-tour="rede-perfil"
      className="inline-flex rounded-full shrink-0"
      style={{
        boxShadow:
          "0 0 0 2px var(--rede-bg), 0 0 0 3.5px rgb(var(--accent-rgb) / 0.55)",
      }}
    >
      <Avatar
        nome={topo.usuarioNome}
        fotoUrl={topo.usuarioFotoUrl}
        size="md"
        onClick={topo.onMeuEspaco}
      />
    </span>
  );
}

/** Lupa, sino e foto -- o lado direito do cabeçalho das telas da barra. */
export function AtalhosTopo({ semBusca = false }: { semBusca?: boolean }) {
  const topo = useRedeTopo();
  if (!topo) return null;
  return (
    <div className="flex items-center shrink-0" style={{ gap: 2 }}>
      {!semBusca && (
        <BotaoTopo label="Buscar" onClick={topo.onBuscar}>
          <IconeBusca />
        </BotaoTopo>
      )}
      <BotaoTopo
        label="Notificações"
        onClick={topo.onNotificacoes}
        ponto={topo.unreadNotifs > 0}
      >
        <IconeSino />
      </BotaoTopo>
      <span style={{ marginLeft: 4 }}>
        <BotaoFotoPerfil />
      </span>
    </div>
  );
}

/** A casinha do canto esquerdo: volta para o Início do app. */
export function BotaoSairDaRede() {
  const topo = useRedeTopo();
  if (!topo?.onSairDaRede) return null;
  return (
    <BotaoTopo label="Início do app" onClick={topo.onSairDaRede}>
      <IconeCasa />
    </BotaoTopo>
  );
}
