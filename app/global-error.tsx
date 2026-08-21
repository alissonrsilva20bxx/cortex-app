"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * T19/#72 — convenção do App Router pra erros que escapam de toda
 * boundary (inclusive o root layout). É o único lugar que também precisa
 * renderizar `<html>`/`<body>`, já que o layout normal não chega a
 * montar quando isso dispara.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          background: "#0a0a0a",
          color: "#fff",
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <p style={{ fontSize: 17, fontWeight: 700 }}>Algo deu errado.</p>
        <p style={{ fontSize: 13, color: "rgb(255 255 255 / 0.6)" }}>
          Já fomos avisados. Tente recarregar a página.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8,
            padding: "10px 20px",
            borderRadius: 12,
            border: "1px solid rgb(255 255 255 / 0.2)",
            background: "transparent",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Recarregar
        </button>
      </body>
    </html>
  );
}
