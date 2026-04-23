import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { sanitizeAuthReturnTo } from "@/lib/auth0-routes";
import { newOauthState, spotifyAuthorizeUrl } from "@/lib/spotify-auth";

export const runtime = "nodejs";

const STATE_COOKIE = "spotify_oauth_state";
const RETURN_TO_COOKIE = "spotify_oauth_return_to";

export async function GET(req: Request) {
  if (!isAuth0Configured()) {
    return NextResponse.json({ ok: false, error: "auth0_not_configured" }, { status: 503 });
  }
  const session = await getAuth0Session();
  const sub = session?.user?.sub?.trim();
  if (!sub) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url = new URL(req.url);
  const state = newOauthState();
  const returnTo = sanitizeAuthReturnTo(url.searchParams.get("returnTo")) ?? "/explorar";
  const authUrl = spotifyAuthorizeUrl(state);

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

  return NextResponse.redirect(authUrl);
}

