import { NextRequest, NextResponse } from "next/server";

import { APP_LOGIN_PATH } from "@/lib/auth0-routes";
import { isBibliotecaPath } from "@/lib/biblioteca-path";
import { getAuth0 } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";

function nextRequestForSession(request: Request): NextRequest {
  return request instanceof NextRequest
    ? request
    : new NextRequest(request.url, { method: request.method, headers: request.headers });
}

export async function proxy(request: Request) {
  const url = new URL(request.url);

  if (!isAuth0Configured()) {
    if (url.pathname.startsWith("/auth")) {
      return new NextResponse(
        "Auth0 não configurado. Copie .env.example para .env.local e preencha AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET e AUTH0_SECRET.",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }
    return NextResponse.next();
  }

  if (isBibliotecaPath(url.pathname)) {
    try {
      const session = await getAuth0().getSession(nextRequestForSession(request));
      if (!session?.user) {
        const login = new URL(APP_LOGIN_PATH, url.origin);
        login.searchParams.set("returnTo", `${url.pathname}${url.search}`);
        return NextResponse.redirect(login);
      }
    } catch {
      const login = new URL(APP_LOGIN_PATH, url.origin);
      login.searchParams.set("returnTo", `${url.pathname}${url.search}`);
      return NextResponse.redirect(login);
    }
  }

  return getAuth0().middleware(request);
}

/**
 * Excluir `api/schubert`: o Auth0 `middleware()` no boundary do proxy faz clone/buffer do body com limite baixo.
 * Uploads multipart grandes (> ~16 KiB) chegam truncados ao Route Handler → Nest/Multer reporta
 * «Multipart: Unexpected end of form». O BFF `/api/schubert/*` faz sessão + JWT na própria rota.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/schubert|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
