import { NextResponse } from "next/server";

import { sanitizeAuthReturnTo, AUTH0_LOGOUT_PATH, appLoginHref } from "@/lib/auth0-routes";

/**
 * Código devolvido pelos proxies (Beethoven/Schubert) quando o `getAccessToken` falha por
 * sessão expirada (sem refresh token, refresh inválido ou sessão inexistente). O cliente deve
 * deslogar o utilizador e levá-lo ao login.
 */
export const SESSION_EXPIRED_ERROR_CODE = "session_expired" as const;

/** Header que sinaliza ao browser que deve correr o fluxo de logout local. */
export const SESSION_EXPIRED_HEADER = "x-cifra-session-expired" as const;

/**
 * Detecta `AccessTokenError` (e variantes do SDK `@auth0/nextjs-auth0`) sem importar a classe
 * directamente — evita acoplar a um caminho interno do package e é robusto a re-throws genéricos.
 */
export function isAuth0SessionExpiredError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown; code?: unknown };
  const name = typeof e.name === "string" ? e.name : "";
  const code = typeof e.code === "string" ? e.code : "";
  if (name === "AccessTokenError") return true;
  return (
    code === "missing_session" ||
    code === "missing_refresh_token" ||
    code === "failed_to_refresh_token" ||
    code === "failed_to_exchange_refresh_token"
  );
}

/**
 * Resposta padronizada para os route handlers (Beethoven/Schubert) quando a sessão Auth0
 * expirou no servidor. O cliente reconhece o `code` e o header e dispara o logout.
 */
export function sessionExpiredResponse(message?: string): NextResponse {
  return NextResponse.json(
    {
      error: SESSION_EXPIRED_ERROR_CODE,
      code: SESSION_EXPIRED_ERROR_CODE,
      message:
        message ??
        "A sessão expirou. Faça login novamente para continuar.",
    },
    {
      status: 401,
      headers: {
        [SESSION_EXPIRED_HEADER]: "1",
      },
    },
  );
}

/** URL para o `/auth/logout` do SDK, com `returnTo` sanitizado para a página de entrada. */
export function logoutHrefWithReturnTo(returnTo?: string | null): string {
  const safeReturn = sanitizeAuthReturnTo(returnTo);
  const params = new URLSearchParams();
  /**
   * `returnTo` do `/auth/logout` é interpretado pelo SDK como destino pós-Auth0; passamos a
   * página de entrada da app com o `returnTo` original para o utilizador retomar onde estava.
   */
  params.set("returnTo", appLoginHref(safeReturn));
  return `${AUTH0_LOGOUT_PATH}?${params.toString()}`;
}

/**
 * Detecta resposta dos proxies indicando que a sessão Auth0 expirou ou está ausente. Aceita 401
 * com header dedicado, body com `code: "session_expired"`, ou o `error: "not_authenticated"`
 * que o `withApiAuthRequired` do SDK Auth0 devolve quando não há sessão activa.
 *
 * Usa `clone()` para não consumir o stream original do `Response`.
 */
export async function responseIndicatesSessionExpired(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  if (res.headers.get(SESSION_EXPIRED_HEADER) === "1") return true;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) return false;
  try {
    const data = (await res.clone().json()) as { code?: unknown; error?: unknown };
    if (data?.code === SESSION_EXPIRED_ERROR_CODE) return true;
    if (data?.error === SESSION_EXPIRED_ERROR_CODE) return true;
    /** Resposta padrão do `withApiAuthRequired` quando o utilizador não tem sessão. */
    if (data?.error === "not_authenticated") return true;
    return false;
  } catch {
    return false;
  }
}
