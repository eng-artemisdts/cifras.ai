import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { saveTrackInLibrary } from "@/lib/library/beethoven-tracks";

export const runtime = "nodejs";

type Body = { trackKey?: string };

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

  const trackKey = typeof body.trackKey === "string" ? body.trackKey.trim() : "";
  if (!trackKey || trackKey.length > 512) {
    return NextResponse.json({ ok: false, error: "invalid_track_key" }, { status: 400 });
  }

  try {
    await saveTrackInLibrary({ userId: sub, trackKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json({ ok: false, error: "beethoven_upstream", details: message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
