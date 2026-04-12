const proxyPrefix = "/api/schubert";

/** Caminho relativo ao proxy Schubert (ex.: `tracks/identify`). */
export function schubertProxyUrl(path: string): string {
  const p = path.replace(/^\/+/, "");
  return `${proxyPrefix}/${p}`;
}

/**
 * Chamadas do browser à Schubert API (Nest) via BFF — cookies de sessão Auth0.
 * `SCHUBERT_AUTH0_AUDIENCE` (ou `AUTH0_AUDIENCE`) deve corresponder à API registada no Auth0.
 */
export function fetchSchubertFromBrowser(path: string, init?: RequestInit): Promise<Response> {
  return fetch(schubertProxyUrl(path), {
    ...init,
    credentials: "include",
  });
}
