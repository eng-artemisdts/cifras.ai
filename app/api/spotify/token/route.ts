import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { spotifyAccessTokenForUser } from "@/lib/spotify-auth";

export const runtime = "nodejs";

export async function GET() {
  if (!isAuth0Configured()) {
    return NextResponse.json({ ok: false, error: "auth0_not_configured" }, { status: 503 });
  }
  const session = await getAuth0Session();
  const sub = session?.user?.sub?.trim();
  if (!sub) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 });
  }
  try {
    const accessToken = await spotifyAccessTokenForUser(sub);
    return NextResponse.json({ ok: true, accessToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "spotify_token_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}

