const proxyPrefix = "/api/beethoven";

/** Caminho relativo ao proxy (ex.: `tracks`, `artists`). */
export function beethovenProxyUrl(path: string): string {
  const p = path.replace(/^\/+/, "");
  return `${proxyPrefix}/${p}`;
}

/**
 * Chamadas do browser à API Nest através do BFF (cookies de sessão Auth0).
 * Usa URL relativa; inclui credenciais para enviar cookies.
 */
export function fetchBeethovenFromBrowser(path: string, init?: RequestInit): Promise<Response> {
  return fetch(beethovenProxyUrl(path), {
    ...init,
    credentials: "include",
  });
}
