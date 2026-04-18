"use client";

import { useEffect, useRef } from "react";

/**
 * Regista o acesso à faixa na Beethoven após o cliente estar montado.
 * Evita depender só do RSC (logs em servidor) e reutiliza cookies no pedido à API.
 * Não usar no editor — apenas em {@link CifraTrackView}.
 */
export function RegisterLibraryTrackAccess({ trackKey }: { trackKey: string }) {
  const sent = useRef(false);

  useEffect(() => {
    const key = trackKey.trim();
    if (!key || sent.current) return;
    sent.current = true;
    console.log('registerLibraryTrackAccess', key)
    void fetch("/api/cifra/track-access", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackKey: key }),
    });
  }, [trackKey]);

  return null;
}
