import { NextRequest, NextResponse } from "next/server";

import { isAccessTokenLikelyJwt } from "@/lib/access-token-shape";
import { getAuth0 } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";

/**
 * O `withApiAuthRequired` do SDK chama `getSession()` sem argumentos (usa só `cookies()`).
 * Em alguns POSTs (ex.: multipart grande), ler sessão a partir dos cookies do pedido é mais fiável.
 * Não incluímos `body` aqui para não consumir o stream antes do proxy.
 */
function nextRequestForSessionOnly(req: Request): NextRequest {
  if (req instanceof NextRequest) {
    return req;
  }
  return new NextRequest(req.url, {
    method: req.method,
    headers: req.headers,
  });
}

const schubertBase = () =>
  (process.env.SCHUBERT_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");

function schubertAudience(): string | null {
  const a = process.env.SCHUBERT_AUTH0_AUDIENCE?.trim() || process.env.AUTH0_AUDIENCE?.trim();
  return a || null;
}

type RouteCtx = { params?: Promise<{ path?: string[] }> };

async function proxyToSchubert(req: Request, ctx: RouteCtx) {
  const audience = schubertAudience();
  if (!audience) {
    return NextResponse.json(
      { error: "schubert_or_auth0_audience_not_configured" },
      { status: 500 },
    );
  }

  const resolved = await ctx.params;
  const segments = resolved?.path ?? [];
  const suffix = segments.length ? segments.join("/") : "";
  const incoming = new URL(req.url);
  const target = `${schubertBase()}/${suffix}${incoming.search}`;

  const { token } = await getAuth0().getAccessToken({ audience });

  if (!isAccessTokenLikelyJwt(token)) {
    return NextResponse.json(
      {
        error: "access_token_not_jwt",
        message:
          "O Auth0 não devolveu um JWT de API para este audience (token ausente, opaco ou sessão antiga). Faça logout e login de novo; no Dashboard Auth0, a API deve emitir JWT assinado (RS256).",
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

  let body: BodyInit | undefined;

  if (!["GET", "HEAD"].includes(req.method)) {
    if (contentType?.toLowerCase().includes("multipart/form-data")) {
      body = await req.arrayBuffer();
    } else {
      const text = await req.text();
      body = text.length > 0 ? text : undefined;
    }
  }

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
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

async function runAuthed(req: Request, ctx: RouteCtx) {
  if (!isAuth0Configured()) {
    return NextResponse.json({ error: "auth0_not_configured" }, { status: 503 });
  }

  const auth0 = getAuth0();
  let session = await auth0.getSession();
  if (!session?.user) {
    session = await auth0.getSession(nextRequestForSessionOnly(req));
  }

  if (!session?.user) {
    return NextResponse.json(
      {
        error: "not_authenticated",
        description:
          "The user does not have an active session or is not authenticated",
      },
      { status: 401 },
    );
  }

  return proxyToSchubert(req, ctx);
}

export const GET = runAuthed;
export const POST = runAuthed;
export const PUT = runAuthed;
export const PATCH = runAuthed;
export const DELETE = runAuthed;
export const HEAD = runAuthed;
