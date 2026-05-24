import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { spotifyAccessTokenForUser } from "@/lib/spotify-auth";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ trackId: string }> }) {
  if (!isAuth0Configured()) {
    return NextResponse.json({ error: "auth0_not_configured" }, { status: 503 });
  }
  const session = await getAuth0Session();
  const sub = session?.user?.sub?.trim();
  if (!sub) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  const { trackId: raw } = await ctx.params;
  const trackId = raw?.trim();
  if (!trackId) {
    return NextResponse.json({ error: "invalid_track_id" }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await spotifyAccessTokenForUser(sub);
  } catch {
    return NextResponse.json({ error: "spotify_not_connected" }, { status: 403 });
  }

  const res = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "spotify_api_error", status: res.status, details: text.slice(0, 400) },
      { status: res.status === 401 || res.status === 403 ? res.status : 502 },
    );
  }

  const t = (await res.json()) as {
    id?: string;
    name?: string;
    artists?: { name?: string }[];
    album?: { name?: string; images?: { url?: string }[] };
    duration_ms?: number;
    preview_url?: string | null;
  };

  const artists = Array.isArray(t.artists) ? t.artists.map((a) => a.name ?? "").filter(Boolean) : [];
  const cover =
    Array.isArray(t.album?.images) && t.album!.images!.length
      ? t.album!.images![0]?.url ?? null
      : null;

  const previewUrl =
    typeof t.preview_url === "string" && /^https:\/\//i.test(t.preview_url.trim())
      ? t.preview_url.trim()
      : null;

  return NextResponse.json({
    trackId: typeof t.id === "string" ? t.id : trackId,
    title: typeof t.name === "string" ? t.name : "—",
    artistLine: artists.join(", ") || "—",
    album: typeof t.album?.name === "string" ? t.album.name : "",
    durationMs: typeof t.duration_ms === "number" ? t.duration_ms : 0,
    coverUrl: cover,
    previewUrl,
  });
}
