import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { getAuth0, getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { sanitizeAuthReturnTo } from "@/lib/auth0-routes";
import { newOauthState, spotifyAuthorizeUrl, spotifyRedirectUri } from "@/lib/spotify-auth";

export const runtime = "nodejs";

const STATE_COOKIE = "spotify_oauth_state";
const RETURN_TO_COOKIE = "spotify_oauth_return_to";
const REDIRECT_URI_COOKIE = "spotify_oauth_redirect_uri";

function nextRequestForSessionOnly(req: Request): NextRequest {
  if (req instanceof NextRequest) {
    return req;
  }
  return new NextRequest(req.url, {
    method: req.method,
    headers: req.headers,
  });
}

export async function GET(req: Request) {
  if (!isAuth0Configured()) {
    return NextResponse.json({ ok: false, error: "auth0_not_configured" }, { status: 503 });
  }
  let session = await getAuth0Session();
  if (!session?.user) {
    session = await getAuth0().getSession(nextRequestForSessionOnly(req));
  }
  const sub = session?.user?.sub?.trim();
  if (!sub) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url = new URL(req.url);
  const state = newOauthState();
  const returnTo = sanitizeAuthReturnTo(url.searchParams.get("returnTo")) ?? "/explorar";
  /**
   * Usa URI estável de ambiente para evitar mismatch (localhost vs 127.0.0.1)
   * entre a origem atual e a configuração no Spotify App Dashboard.
   */
  const redirectUri = spotifyRedirectUri();
  const authUrl = spotifyAuthorizeUrl(state, redirectUri);

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  cookieStore.set(RETURN_TO_COOKIE, returnTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  cookieStore.set(REDIRECT_URI_COOKIE, redirectUri, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(authUrl);
}

