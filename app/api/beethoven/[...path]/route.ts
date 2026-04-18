import { NextResponse } from "next/server";

import { isAccessTokenLikelyJwt } from "@/lib/access-token-shape";
import { getAuth0 } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";

/** Mesma porta por defeito que `beethoven-api` (evita confundir com Schubert em 3001). */
const beethovenBase = () =>
  (process.env.BEETHOVEN_API_BASE_URL ?? "http://127.0.0.1:3002").replace(/\/$/, "");

type RouteCtx = { params?: Promise<{ path?: string[] }> };

async function proxyToBeethoven(req: Request, ctx: RouteCtx) {
  const audience = process.env.AUTH0_AUDIENCE?.trim();
  if (!audience) {
    return NextResponse.json({ error: "auth0_audience_not_configured" }, { status: 500 });
  }

  const resolved = await ctx.params;
  const segments = resolved?.path ?? [];
  const suffix = segments.length ? segments.join("/") : "";
  const incoming = new URL(req.url);
  const target = `${beethovenBase()}/${suffix}${incoming.search}`;

  const { token } = await getAuth0().getAccessToken({ audience });

  if (!isAccessTokenLikelyJwt(token)) {
    return NextResponse.json(
      {
        error: "access_token_not_jwt",
        message:
          "O Auth0 não devolveu um JWT de API para este audience. Faça logout e login de novo; confira se a API no Auth0 emite JWT (RS256).",
      },
      { status: 401 },
    );
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
  };
  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers["content-type"] = contentType;
  }

  let body: string | undefined;
  if (!["GET", "HEAD"].includes(req.method)) {
    body = await req.text();
  }

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: body && body.length > 0 ? body : undefined,
  });

  const responseHeaders = new Headers();
  const passCt = upstream.headers.get("content-type");
  if (passCt) {
    responseHeaders.set("content-type", passCt);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type AuthedAppRoute = (req: Request, ctx: RouteCtx) => Promise<Response>;

let authedProxySingleton: AuthedAppRoute | null = null;

function getAuthedProxy(): AuthedAppRoute | null {
  if (!isAuth0Configured()) {
    return null;
  }
  if (!authedProxySingleton) {
    authedProxySingleton = getAuth0().withApiAuthRequired(
      async (req: Request, ctx: RouteCtx) => proxyToBeethoven(req, ctx),
    ) as AuthedAppRoute;
  }
  return authedProxySingleton;
}

async function runAuthed(req: Request, ctx: RouteCtx) {
  const authed = getAuthedProxy();
  if (!authed) {
    return NextResponse.json({ error: "auth0_not_configured" }, { status: 503 });
  }
  return authed(req, ctx);
}

export const GET = runAuthed;
export const POST = runAuthed;
export const PUT = runAuthed;
export const PATCH = runAuthed;
export const DELETE = runAuthed;
export const HEAD = runAuthed;
