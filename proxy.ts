import { NextResponse } from "next/server";

import { getAuth0 } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";

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

  return getAuth0().middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
