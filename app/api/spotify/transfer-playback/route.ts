import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { spotifyApiForUser } from "@/lib/spotify-api-server";

export const runtime = "nodejs";

type Body = {
  deviceId?: string;
  play?: boolean;
};

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
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "invalid_device_id" }, { status: 400 });
  }
  const upstream = await spotifyApiForUser(sub, "/me/player", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: body.play === true,
    }),
  });
  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json({ ok: false, error: "spotify_upstream", details: text }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true });
}

