import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { isAccessTokenLikelyJwt } from "@/lib/access-token-shape";
import { resolveBillingPlanForSessionUser } from "@/lib/billing/resolve-billing-plan";
import { getAuth0 } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { permissionsFromSessionUser } from "@/lib/entitlements";

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

/** Repete contexto de sessão para a Schubert API (o JWT de API muitas vezes não inclui claims `https://cifra.ai/*`). */
type SchubertForwardIdentity = {
  auth0Sub: string;
  billingPlan: string;
  appPermissions: string[];
};

/**
 * Lê o corpo para reenvio à Schubert sem corromper bytes (`req.text()` usa UTF-8 e estraga multipart).
 * Só usa texto para JSON e `application/x-www-form-urlencoded`; todo o resto (incl. `multipart/*`
 * com boundary) passa por `arrayBuffer()`.
 */
async function readProxyBody(req: Request): Promise<{
  body: BodyInit | undefined;
  contentType: string | null;
}> {
  const method = req.method;
  if (method === "GET" || method === "HEAD") {
    return { body: undefined, contentType: req.headers.get("content-type") };
  }

  const contentType = req.headers.get("content-type");
  const ct = (contentType ?? "").trim().toLowerCase();

  if (
    ct.includes("application/json") ||
    ct.includes("application/x-www-form-urlencoded")
  ) {
    const text = await req.text();
    return {
      body: text.length > 0 ? text : undefined,
      contentType,
    };
  }

  const buf = await req.arrayBuffer();
  return {
    body: buf.byteLength > 0 ? buf : undefined,
    contentType,
  };
}

async function proxyToSchubert(req: Request, ctx: RouteCtx, forward: SchubertForwardIdentity) {
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

  /**
   * Ler o corpo antes de `getAccessToken` (buffer completo antes de esperar pelo Auth0) e usar
   * bytes brutos para multipart — `text()` invalida o boundary e o busboy falha com
   * «Multipart: Unexpected end of form».
   */
  const { body, contentType } = await readProxyBody(req);

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
    "x-cifra-auth0-sub": forward.auth0Sub,
    "x-cifra-billing-plan": forward.billingPlan,
    "x-cifra-app-permissions": JSON.stringify(forward.appPermissions),
  };
  if (contentType) {
    headers["content-type"] = contentType;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        area: "schubert-proxy",
        upstream: "schubert-api",
      },
      extra: {
        method: req.method,
        target,
      },
    });
    throw error;
  }

  if (upstream.status >= 500) {
    let upstreamBodyPreview: string | null = null;
    try {
      upstreamBodyPreview = (await upstream.clone().text()).slice(0, 2000);
    } catch {
      upstreamBodyPreview = null;
    }

    Sentry.captureMessage("Schubert upstream returned 5xx", {
      level: "error",
      tags: {
        area: "schubert-proxy",
        upstream: "schubert-api",
      },
      extra: {
        method: req.method,
        target,
        upstreamStatus: upstream.status,
        upstreamStatusText: upstream.statusText,
        upstreamBodyPreview,
      },
    });
  }

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

  const auth0Sub = typeof session.user.sub === "string" ? session.user.sub : "";
  const billingPlan = await resolveBillingPlanForSessionUser(session.user);
  const appPermissions = permissionsFromSessionUser(session.user);

  return proxyToSchubert(req, ctx, {
    auth0Sub,
    billingPlan,
    appPermissions,
  });
}

export const GET = runAuthed;
export const POST = runAuthed;
export const PUT = runAuthed;
export const PATCH = runAuthed;
export const DELETE = runAuthed;
export const HEAD = runAuthed;

