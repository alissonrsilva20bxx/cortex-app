"use client";

import { ArrowLeft } from "lucide-react";
import {
  AtalhosTopo,
  BotaoFotoPerfil,
  BotaoSairDaRede,
  useRedeTopo,
} from "./RedeTopo";

/**
 * Cabeçalho compartilhado das subtelas da Rede (Amigas, Chat, Meu espaço,
 * Wishlist, Clientes, Perfil público…). Voltar sempre sobe um nível na
 * pilha.
 *
 * Modelo Doca: dentro da Rede (com o RedeTopoContext), a foto da usuária
 * fica no canto direito de toda subtela. Nas telas que são botões da barra
 * da Rede (Conversas, Amigas, Eu), o cabeçalho é o mesmo do Feed: casinha
 * à esquerda, título grande e lupa, sino e foto à direita.
 */

interface Props {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, action }: Props) {
  const topo = useRedeTopo();
  const raiz = topo?.raiz ?? false;
  return (
    <div
      className="flex items-center gap-2 mb-5"
      data-cabecalho-rede={raiz ? "raiz" : "subtela"}
      style={{ minHeight: 48 }}
    >
      {raiz && topo?.onSairDaRede ? (
        <span style={{ marginLeft: -6 }}>
          <BotaoSairDaRede />
        </span>
      ) : (
        <button
          onClick={onBack}
          aria-label="Voltar"
          className="flex items-center justify-center rounded-full shrink-0 transition-opacity active:opacity-70"
          style={{ width: 44, height: 44, background: "var(--surface)" }}
        >
          <ArrowLeft size={18} style={{ color: "var(--text)" }} />
        </button>
      )}
      <h2
        className="font-extrabold flex-1 truncate"
        style={{
          fontSize: raiz ? (action ? "23px" : "26px") : "22px",
          letterSpacing: raiz ? "-0.03em" : "-0.02em",
          lineHeight: 1.15,
          color: "var(--text)",
        }}
      >
        {title}
      </h2>
      {action}
      {/* Com ação própria (o "..." do Meu espaço) não cabem os 3 atalhos:
          a lupa fica no Feed, a 1 toque pela barra. */}
      {raiz ? <AtalhosTopo semBusca={!!action} /> : <BotaoFotoPerfil />}
    </div>
  );
}
