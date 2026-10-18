import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { resolveAppOrigin } from "@/lib/app-base-url";
import {
  sessionExpiredLogoutHref,
  responseIndicatesSessionExpired,
} from "@/lib/auth0-session-expired";

import { beethovenProxyUrl } from "./beethoven-browser-client";

/**
 * Server Components / Route Handlers: reencaminha cookies para o BFF no mesmo host.
 *
 * Se o BFF responder com 401 + `code: session_expired` (sessão Auth0 expirou no servidor),
 * dispara um `redirect('/auth/logout?...')` para terminar a sessão e enviar o utilizador ao
 * login. O `redirect()` lança `NEXT_REDIRECT`, que o Next intercepta — não capturar com
 * `try/catch` genérico (use `unstable_rethrow` se precisar de tratar outros erros).
 */
export async function fetchBeethovenFromServer(path: string, init?: RequestInit): Promise<Response> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    throw new Error("Host em falta para fetchBeethovenFromServer");
  }
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}${beethovenProxyUrl(path)}`;
  const nextHeaders = new Headers(init?.headers);
  const cookie = h.get("cookie");
  if (cookie && !nextHeaders.has("cookie")) {
    nextHeaders.set("cookie", cookie);
  }
  const res = await fetch(url, { ...init, headers: nextHeaders });
  if (await responseIndicatesSessionExpired(res)) {
    redirect(sessionExpiredLogoutHref(resolveAppOrigin({ headers: h })));
  }
  return res;
}
