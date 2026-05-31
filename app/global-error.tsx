"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#080810",
          color: "#f4f4f5",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Algo deu errado</h1>
        <p style={{ margin: 0, maxWidth: "28rem", color: "#a1a1aa", fontSize: "0.95rem" }}>
          Ocorreu um erro inesperado. Tente novamente ou volte mais tarde.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: "0.5rem",
            padding: "0.6rem 1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid #0fd2c1",
            background: "transparent",
            color: "#0fd2c1",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
