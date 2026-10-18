import { NextResponse } from "next/server";

import { resolveAppOrigin } from "@/lib/app-base-url";
import { AUTH0_LOGOUT_PATH } from "@/lib/auth0-routes";

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

/**
 * URL para o `/auth/logout` do SDK quando a sessão expirou. O `returnTo` é só a origem da app:
 * o `/v2/logout` do Auth0 rejeita (página de erro do tenant) qualquer URL que não esteja em
 * «Allowed Logout URLs», e lá está registada apenas a raiz — `/login?returnTo=...` falhava.
 * Sem origem conhecida, o SDK usa o `appBaseUrl`, como no botão «Sair» do menu.
 */
export function sessionExpiredLogoutHref(origin?: string): string {
  const base = origin ?? resolveAppOrigin();
  if (!base) return AUTH0_LOGOUT_PATH;
  return `${AUTH0_LOGOUT_PATH}?${new URLSearchParams({ returnTo: base }).toString()}`;
}

/**
 * Detecta resposta dos proxies indicando que a sessão Auth0 **expirou** (refresh falhou).
 * Não trata `not_authenticated` — isso significa visitante anónimo ou rota sem sessão, e não
 * deve disparar logout OIDC (especialmente em páginas públicas).
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
    return false;
  } catch {
    return false;
  }
}
