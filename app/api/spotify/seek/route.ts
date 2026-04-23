import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { spotifyApiForUser } from "@/lib/spotify-api-server";

export const runtime = "nodejs";

type Body = { positionMs?: number; deviceId?: string };

export async function POST(req: Request) {
  if (!isAuth0Configured()) {
    return NextResponse.json({ ok: false, error: "auth0_not_configured" }, { status: 503 });
  }
  const session = await getAuth0Session();
  const sub = session?.user?.sub?.trim();
  if (!sub) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const positionMs = Number.isFinite(body.positionMs) ? Math.max(0, Math.floor(Number(body.positionMs))) : -1;
  if (positionMs < 0) {
    return NextResponse.json({ ok: false, error: "invalid_position" }, { status: 400 });
  }
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  const query = new URLSearchParams({
    position_ms: String(positionMs),
    ...(deviceId ? { device_id: deviceId } : {}),
  });
  const upstream = await spotifyApiForUser(sub, `/me/player/seek?${query.toString()}`, { method: "PUT" });
  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json({ ok: false, error: "spotify_upstream", details: text }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true });
}

