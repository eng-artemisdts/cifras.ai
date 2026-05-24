import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { registerLibraryTrackAccess } from "@/lib/library/beethoven-tracks";

export const runtime = "nodejs";

type Body = { trackKey?: string };

/**
 * Regista último acesso na Beethoven com o `sub` da sessão (nunca confiar num userId vindo do cliente).
 * Chamado só na visualização pública da cifra (componente cliente em CifraTrackView).
 */
export async function POST(req: Request) {
  if (!isAuth0Configured()) {
    return NextResponse.json({ ok: false, error: "auth0_not_configured" }, { status: 503 });
  }

  const session = await getAuth0Session();
  const sub = session?.user?.sub?.trim();
  if (!sub) {
    return NextResponse.json({ ok: true, skipped: "no_session" });
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
    await registerLibraryTrackAccess({ userId: sub, trackKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const match = /^beethoven_library_access_failed:(\d+):([\s\S]*)$/.exec(message);
    if (match) {
      const status = Number.parseInt(match[1] ?? "502", 10);
      const details = (match[2] ?? "").trim();
      return NextResponse.json(
        { ok: false, error: "beethoven_upstream", upstreamStatus: status, details },
        { status: Number.isFinite(status) && status >= 400 && status <= 599 ? status : 502 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "beethoven_upstream", details: message },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
