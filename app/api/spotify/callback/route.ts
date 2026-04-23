import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import {
  exchangeCodeForSpotifySession,
  saveSpotifySessionForUser,
} from "@/lib/spotify-auth";

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

  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code")?.trim() ?? "";
  const state = requestUrl.searchParams.get("state")?.trim() ?? "";
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value ?? "";
  const returnTo = cookieStore.get(RETURN_TO_COOKIE)?.value ?? "/explorar";
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(RETURN_TO_COOKIE);

  if (!code) {
    return NextResponse.redirect(new URL(`${returnTo}?spotify=missing_code`, req.url));
  }
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL(`${returnTo}?spotify=invalid_state`, req.url));
  }

  try {
    const spotifySession = await exchangeCodeForSpotifySession({ code });
    await saveSpotifySessionForUser(sub, spotifySession);
    return NextResponse.redirect(new URL(`${returnTo}?spotify=connected`, req.url));
  } catch {
    return NextResponse.redirect(new URL(`${returnTo}?spotify=connect_failed`, req.url));
  }
}

