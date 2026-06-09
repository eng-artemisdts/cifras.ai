/** Origem da app (protocolo + host), sem path. */
export function getAppBaseUrlFromEnv(): string | undefined {
  const raw = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return undefined;
  try {
    return normalizeOriginForAuth0(new URL(raw).origin);
  } catch {
    return undefined;
  }
}

/**
 * Auth0 «Allowed Logout URLs» costuma registar `localhost`, não `127.0.0.1`.
 * Normaliza para evitar a página de erro do tenant em desenvolvimento local.
 */
export function normalizeOriginForAuth0(origin: string): string {
  try {
    const url = new URL(origin);
    if (url.hostname === "127.0.0.1") {
      url.hostname = "localhost";
      return url.origin;
    }
    return url.origin;
  } catch {
    return origin;
  }
}

/** Origem do pedido actual (Vercel / proxy local). */
export function getRequestOriginFromHeaders(h: Headers): string | undefined {
  const host = (h.get("x-forwarded-host") ?? h.get("host"))?.split(",")[0]?.trim();
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim();
  if (!host || !proto) return undefined;
  return normalizeOriginForAuth0(`${proto}://${host}`);
}

/**
 * Origem para URLs absolutas (logout Auth0, callbacks, etc.).
 * No browser usa `window.location.origin`; no servidor prefere headers do pedido e depois env.
 */
export function resolveAppOrigin(opts?: { headers?: Headers }): string | undefined {
  const fromEnv = getAppBaseUrlFromEnv();
  if (typeof window !== "undefined") {
    if (fromEnv) return fromEnv;
    return normalizeOriginForAuth0(window.location.origin);
  }
  if (fromEnv) return fromEnv;
  if (opts?.headers) {
    const fromRequest = getRequestOriginFromHeaders(opts.headers);
    if (fromRequest) return fromRequest;
  }
  return undefined;
}
