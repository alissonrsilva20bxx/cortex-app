"use client";

import { useEffect, useState } from "react";
import { assinar, obterLinhas } from "@/lib/rede/timingBuffer";

/**
 * TEMP-TIMING -- painel de depuração visível NA TELA (sem Mac/Web
 * Inspector) com as linhas `[rede-timing]` capturadas. Remover junto do
 * resto da instrumentação `TEMP-TIMING` depois que o reteste do bug do
 * gate da Rede (spinner de tela cheia após o PIN, ver PR #121) confirmar o
 * fix.
 *
 * Só aparece com `?redeTiming=1` na URL -- mesmo padrão do `?vitrine=1` do
 * `RedeGatedTab`: não é UI de usuário, ninguém liga isso sem saber que
 * existe. Sobrevive a um documento novo (reload / iOS descartando a aba)
 * porque o parâmetro fica na própria URL que o Safari reabre.
 */
export function RedeTimingOverlay() {
  const [linhas, setLinhas] = useState<readonly string[]>([]);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    setVisivel(
      new URLSearchParams(window.location.search).get("redeTiming") === "1"
    );
    setLinhas(obterLinhas());
    return assinar(setLinhas);
  }, []);

  if (!visivel) return null;

  return (
    <pre
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: "45vh",
        overflowY: "auto",
        margin: 0,
        padding: "6px 8px",
        fontSize: "9px",
        lineHeight: 1.5,
        background: "rgba(0,0,0,0.88)",
        color: "#4ade80",
        zIndex: 999999,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      {linhas.length === 0
        ? "[rede-timing] aguardando eventos…"
        : linhas.join("\n")}
    </pre>
  );
}
