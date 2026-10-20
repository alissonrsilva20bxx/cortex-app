"use client";

import { useEffect, useRef } from "react";
import { Avatar } from "./Avatar";
import {
  IconeAmigas,
  IconeConversas,
  IconeFeed,
  IconeMais,
} from "./redeIcones";

/**
 * Barra própria da Rede (modelo Doca, protótipo aprovado
 * .lavish/rede-doca-final.html): dentro da Rede ela toma o lugar da barra
 * do app. Cinco botões no polegar -- Feed, Conversas, Publicar (o grande,
 * no meio), Amigas e Eu -- com o número real de conversas não lidas e de
 * pedidos de amizade. O fundo claro desliza até o botão ativo.
 */

export type DocaAba = "feed" | "chatList" | "amigas" | "meuEspaco";

const ORDEM: (DocaAba | null)[] = [
  "feed",
  "chatList",
  null,
  "amigas",
  "meuEspaco",
];

interface Props {
  ativa: DocaAba;
  naoLidas: number;
  pedidos: number;
  usuarioNome: string;
  usuarioFotoUrl: string | null;
  onIr: (aba: DocaAba) => void;
  onPublicar: () => void;
}

function Numero({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      aria-hidden
      className="absolute grid place-items-center rounded-full"
      style={{
        top: 2,
        right: "calc(50% - 26px)",
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        fontSize: 10.5,
        fontWeight: 800,
        background: "var(--accent)",
        color: "#fff",
        boxShadow: "0 0 0 2px var(--card-solid)",
      }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function DocaBar({
  ativa,
  naoLidas,
  pedidos,
  usuarioNome,
  usuarioFotoUrl,
  onIr,
  onPublicar,
}: Props) {
  const indice = ORDEM.indexOf(ativa);
  // O fundo nasce onde estava e anda até o novo (uma transição de 380 ms).
  const blobRef = useRef<HTMLSpanElement>(null);
  const anterior = useRef(indice);
  useEffect(() => {
    const el = blobRef.current;
    if (!el) return;
    el.style.transform = `translateX(${indice * 100}%)`;
    anterior.current = indice;
  }, [indice]);

  const item = (
    aba: DocaAba,
    rotulo: string,
    icone: React.ReactNode,
    numero = 0,
    labelLeitor = rotulo
  ) => {
    const on = aba === ativa;
    return (
      <button
        type="button"
        data-doca={aba}
        aria-current={on ? "page" : undefined}
        aria-label={
          numero > 0 ? `${labelLeitor}, ${numero} novidades` : labelLeitor
        }
        onClick={() => onIr(aba)}
        className="relative flex flex-col items-center justify-center transition-transform active:scale-95"
        style={{
          zIndex: 1,
          minHeight: 52,
          gap: 3,
          fontSize: 11,
          fontWeight: 800,
          color: on ? "var(--accent-deep-2)" : "var(--text-muted)",
          transition: "color 200ms ease",
        }}
      >
        {icone}
        {rotulo}
        <Numero n={numero} />
      </button>
    );
  };

  return (
    <nav
      aria-label="Rede"
      data-doca-bar=""
      className="fixed left-1/2 -translate-x-1/2 bottom-0 w-full"
      style={{
        zIndex: 40,
        maxWidth: 520,
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        padding: "6px 8px calc(8px + env(safe-area-inset-bottom, 0px))",
        background: "color-mix(in srgb, var(--card-solid) 92%, transparent)",
        backdropFilter: "blur(22px) saturate(1.6)",
        WebkitBackdropFilter: "blur(22px) saturate(1.6)",
        boxShadow: "inset 0 1px 0 var(--border-color)",
      }}
    >
      {/* O fundo claro do botão ativo; o "Publicar" do meio não tem. */}
      <span
        ref={blobRef}
        aria-hidden
        className="absolute"
        style={{
          top: 6,
          left: 8,
          height: 52,
          width: "calc((100% - 16px) / 5)",
          padding: "0 6px",
          transform: `translateX(${anterior.current * 100}%)`,
          transition: "transform 380ms cubic-bezier(.3,1.25,.5,1)",
        }}
      >
        <span
          className="block h-full"
          style={{ borderRadius: 16, background: "var(--accent-tint)" }}
        />
      </span>

      {item("feed", "Feed", <IconeFeed />)}
      {item("chatList", "Conversas", <IconeConversas />, naoLidas)}
      <div className="flex justify-center" style={{ zIndex: 1 }}>
        <button
          type="button"
          onClick={onPublicar}
          aria-label="Publicar"
          data-doca="publicar"
          className="grid place-items-center transition-transform active:scale-90"
          style={{
            width: 58,
            height: 58,
            marginTop: -16,
            borderRadius: 20,
            background: "var(--accent)",
            color: "#fff",
            boxShadow: "0 10px 26px rgb(var(--accent-rgb) / 0.45)",
          }}
        >
          <IconeMais size={26} strokeWidth={2.4} />
        </button>
      </div>
      {item("amigas", "Amigas", <IconeAmigas />, pedidos)}
      {item(
        "meuEspaco",
        "Eu",
        <span
          className="grid place-items-center rounded-full"
          style={{
            width: 28,
            height: 28,
            marginTop: -2,
            boxShadow:
              ativa === "meuEspaco"
                ? "0 0 0 2px var(--card-solid), 0 0 0 4px var(--accent)"
                : undefined,
          }}
        >
          <Avatar nome={usuarioNome} fotoUrl={usuarioFotoUrl} tamanho={28} />
        </span>,
        0,
        "Meu espaço"
      )}
    </nav>
  );
}
