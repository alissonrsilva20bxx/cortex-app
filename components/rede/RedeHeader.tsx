"use client";

import { AtalhosTopo, BotaoSairDaRede } from "./RedeTopo";

/**
 * Cabeçalho do Feed no modelo Doca (protótipo aprovado
 * .lavish/rede-doca-final.html): a casinha (volta ao Início do app), o
 * título "Rede" e, à direita, a lupa, o sino e a foto da usuária (Meu
 * espaço, alvo do tour "rede-perfil"). Conversas e Amigas, que ficavam
 * aqui, desceram para a barra da Rede (DocaBar), com o número de
 * novidades. Os dados vêm do RedeTopoContext que o RedeTab monta.
 */
export function RedeHeader() {
  return (
    <div
      className="flex items-center"
      data-cabecalho-rede="feed"
      style={{ gap: 2, minHeight: 52, marginBottom: 10 }}
    >
      <span style={{ marginLeft: -8 }}>
        <BotaoSairDaRede />
      </span>
      <h2
        className="font-extrabold flex-1 min-w-0 truncate"
        style={{
          fontSize: "28px",
          // A referência não declara line-height no título: ele herda 1.1
          // do corpo da tela (com 1.5 o cabeçalho empurrava a tela).
          lineHeight: 1.1,
          letterSpacing: "-0.04em",
          color: "var(--text)",
          paddingLeft: 4,
        }}
      >
        Rede
      </h2>
      <AtalhosTopo />
    </div>
  );
}
