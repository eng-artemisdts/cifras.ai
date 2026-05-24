import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { spotifyAccessTokenForUser } from "@/lib/spotify-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isAuth0Configured()) {
    return NextResponse.json({ error: "auth0_not_configured" }, { status: 503 });
  }
  const session = await getAuth0Session();
  const sub = session?.user?.sub?.trim();
  if (!sub) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = await spotifyAccessTokenForUser(sub);
  } catch {
    return NextResponse.json({ error: "spotify_not_connected" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!meRes.ok) {
    const text = await meRes.text();
    return NextResponse.json(
      { error: "spotify_me_failed", status: meRes.status, details: text.slice(0, 400) },
      { status: meRes.status === 401 || meRes.status === 403 ? meRes.status : 502 },
    );
  }
  const me = (await meRes.json()) as { id?: string };
  const mySpotifyId = typeof me.id === "string" ? me.id.trim() : "";
  if (!mySpotifyId) {
    return NextResponse.json({ error: "spotify_me_missing_id" }, { status: 502 });
  }

  const spotifyUrl = new URL("https://api.spotify.com/v1/me/playlists");
  spotifyUrl.searchParams.set("limit", String(limit));
  spotifyUrl.searchParams.set("offset", String(offset));

  const res = await fetch(spotifyUrl.toString(), {
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

  const raw = (await res.json()) as {
    items?: {
      id: string;
      name: string;
      images?: { url: string }[];
      tracks?: { total: number };
      owner?: { id?: string };
    }[];
    total?: number;
    limit?: number;
    offset?: number;
  };

  const items = Array.isArray(raw.items) ? raw.items : [];
  const owned = items.filter((p) => {
    const ownerId = typeof p.owner?.id === "string" ? p.owner.id.trim() : "";
    return ownerId === mySpotifyId;
  });
  const playlists = owned.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.images?.[0]?.url ?? null,
    trackCount: typeof p.tracks?.total === "number" ? p.tracks.total : 0,
  }));

  return NextResponse.json({
    playlists,
    total: typeof raw.total === "number" ? raw.total : playlists.length,
    limit: typeof raw.limit === "number" ? raw.limit : limit,
    offset: typeof raw.offset === "number" ? raw.offset : offset,
  });
}
