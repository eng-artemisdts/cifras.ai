import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { spotifyStatusForUser } from "@/lib/spotify-auth";

export const runtime = "nodejs";

export async function GET() {
  if (!isAuth0Configured()) {
    return NextResponse.json({ connected: false, premium: false, error: "auth0_not_configured" }, { status: 503 });
  }
  const session = await getAuth0Session();
  const sub = session?.user?.sub?.trim();
  if (!sub) {
    return NextResponse.json({ connected: false, premium: false, error: "no_session" }, { status: 401 });
  }
  const status = await spotifyStatusForUser(sub);
  return NextResponse.json(status);
}

