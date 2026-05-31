/** Origem da app (protocolo + host), sem path. */
export function getAppBaseUrlFromEnv(): string | undefined {
  const raw = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

/** Origem do pedido actual (Vercel / proxy local). */
export function getRequestOriginFromHeaders(h: Headers): string | undefined {
  const host = (h.get("x-forwarded-host") ?? h.get("host"))?.split(",")[0]?.trim();
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim();
  if (!host || !proto) return undefined;
  return `${proto}://${host}`;
}

/**
 * Origem para URLs absolutas (logout Auth0, callbacks, etc.).
 * No browser usa `window.location.origin`; no servidor prefere headers do pedido e depois env.
 */
export function resolveAppOrigin(opts?: { headers?: Headers }): string | undefined {
  if (typeof window !== "undefined") return window.location.origin;
  if (opts?.headers) {
    const fromRequest = getRequestOriginFromHeaders(opts.headers);
    if (fromRequest) return fromRequest;
  }
  return getAppBaseUrlFromEnv();
}
