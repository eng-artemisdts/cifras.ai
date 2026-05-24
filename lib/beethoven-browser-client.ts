import {
  logoutHrefWithReturnTo,
  responseIndicatesSessionExpired,
} from "@/lib/auth0-session-expired";

const proxyPrefix = "/api/beethoven";

/** Caminho relativo ao proxy (ex.: `tracks`, `artists`). */
export function beethovenProxyUrl(path: string): string {
  const p = path.replace(/^\/+/, "");
  return `${proxyPrefix}/${p}`;
}

/**
 * Em ambiente browser, força navegação para `/auth/logout` (limpa sessão e leva ao Universal
 * Login com `returnTo` para a entrada da app). Não retorna — a Promise nunca resolve enquanto a
 * navegação não acontece, o que evita que o caller continue a tratar a Response inválida.
 */
function redirectBrowserToLogout(): Promise<never> {
  if (typeof window !== "undefined") {
    const current = `${window.location.pathname}${window.location.search}`;
    window.location.href = logoutHrefWithReturnTo(current);
  }
  return new Promise<never>(() => {});
}

/**
 * Chamadas do browser à API Nest através do BFF (cookies de sessão Auth0).
 * Usa URL relativa; inclui credenciais para enviar cookies. Se o BFF reportar sessão expirada,
 * desloga o utilizador no cliente e envia-o ao login.
 */
export async function fetchBeethovenFromBrowser(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(beethovenProxyUrl(path), {
    ...init,
    credentials: "include",
  });
  if (await responseIndicatesSessionExpired(res)) {
    await redirectBrowserToLogout();
  }
  return res;
}
