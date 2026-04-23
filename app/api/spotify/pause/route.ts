import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { spotifyApiForUser } from "@/lib/spotify-api-server";

export const runtime = "nodejs";

type Body = { deviceId?: string };

export async function POST(req: Request) {
  if (!isAuth0Configured()) {
    return NextResponse.json({ ok: false, error: "auth0_not_configured" }, { status: 503 });
  }
  const session = await getAuth0Session();
  const sub = session?.user?.sub?.trim();
  if (!sub) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 });
  }
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // allow empty body
  }
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  const upstream = await spotifyApiForUser(sub, `/me/player/pause${query}`, { method: "PUT" });
  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json({ ok: false, error: "spotify_upstream", details: text }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true });
}

