import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { fetchAuth0UserAppMetadata } from "@/lib/billing/auth0-management";
import { spotifyAccessTokenForUser } from "@/lib/spotify-auth";

export const runtime = "nodejs";

type SpotifyTrackArtist = { name?: string };
type SpotifyAlbum = { name?: string; images?: { url?: string }[] };
type SpotifyTrackObj = {
  id?: string;
  uri?: string;
  name?: string;
  artists?: SpotifyTrackArtist[];
  album?: SpotifyAlbum;
  duration_ms?: number;
};

type PlaylistTrackItemEntry = {
  track?: SpotifyTrackObj | null;
  item?: (SpotifyTrackObj & { type?: string }) | null;
};
type PlaylistTrackEntry = PlaylistTrackItemEntry | SpotifyTrackObj | null;

export async function GET(req: Request, ctx: { params: Promise<{ playlistId: string }> }) {
  if (!isAuth0Configured()) {
    return NextResponse.json({ error: "auth0_not_configured" }, { status: 503 });
  }
  const session = await getAuth0Session();
  const sub = session?.user?.sub?.trim();
  if (!sub) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  const { playlistId: rawId } = await ctx.params;
  const playlistId = rawId?.trim();
  if (!playlistId) {
    return NextResponse.json({ error: "invalid_playlist_id" }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await spotifyAccessTokenForUser(sub);
  } catch {
    return NextResponse.json({ error: "spotify_not_connected" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const spotifyUrl = new URL(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items`);
  spotifyUrl.searchParams.set("limit", String(limit));
  spotifyUrl.searchParams.set("offset", String(offset));

  const res = await fetch(spotifyUrl.toString(), {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    const scopeIssue =
      res.status === 403 &&
      /insufficient|scope|permissions|Missing scope|missing_scope/i.test(text);
    const playlistAccessIssue =
      res.status === 403 && /forbidden|not allowed|access denied/i.test(text);
    const isDev = process.env.NODE_ENV === "development";

    let details = text.slice(0, 400);
    if (isDev) {
      let storedSpotifyScope: string | null = null;
      let meId: string | null = null;
      let playlistDiagnostic:
        | {
            id?: string;
            name?: string;
            collaborative?: boolean;
            public?: boolean | null;
            ownerId?: string | null;
            status?: number;
          }
        | null = null;
      try {
        const meta = await fetchAuth0UserAppMetadata(sub);
        const rawScope = meta?.spotify_scope;
        storedSpotifyScope = typeof rawScope === "string" ? rawScope : null;
      } catch {
        storedSpotifyScope = null;
      }
      try {
        const meRes = await fetch("https://api.spotify.com/v1/me", {
          headers: { authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        if (meRes.ok) {
          const me = (await meRes.json()) as { id?: string };
          meId = typeof me.id === "string" ? me.id : null;
        } else {
          meId = `me_failed_${meRes.status}`;
        }
      } catch {
        meId = "me_failed_network";
      }

      try {
        const diagUrl = new URL(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`);
        diagUrl.searchParams.set("fields", "id,name,collaborative,public,owner(id)");
        const diagRes = await fetch(diagUrl.toString(), {
          headers: { authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        if (diagRes.ok) {
          const pj = (await diagRes.json()) as {
            id?: string;
            name?: string;
            collaborative?: boolean;
            public?: boolean | null;
            owner?: { id?: string };
          };
          playlistDiagnostic = {
            id: pj.id,
            name: pj.name,
            collaborative: pj.collaborative,
            public: pj.public,
            ownerId: typeof pj.owner?.id === "string" ? pj.owner.id : null,
          };
        } else {
          playlistDiagnostic = { status: diagRes.status };
        }
      } catch {
        playlistDiagnostic = { status: -1 };
      }
      details = JSON.stringify(
        {
          spotifyErrorBody: text,
          spotifyWwwAuthenticate: res.headers.get("www-authenticate"),
          spotifyRequestId:
            res.headers.get("spotify-request-id") ??
            res.headers.get("x-spotify-trace-id"),
          storedSpotifyScope,
          meId,
          playlistDiagnostic,
          hint:
            "Verifique se a conta tem acesso a esta playlist e se os scopes incluem playlist-read-private/playlist-read-collaborative.",
        },
        null,
        2,
      );
    }

    return NextResponse.json(
      {
        error: scopeIssue
          ? "spotify_insufficient_scope"
          : playlistAccessIssue
            ? "spotify_playlist_access_denied"
            : "spotify_api_error",
        status: res.status,
        details,
      },
      { status: res.status === 401 || res.status === 403 ? res.status : 502 },
    );
  }

  const raw = (await res.json()) as {
    items?: PlaylistTrackEntry[];
    total?: number;
    limit?: number;
    offset?: number;
    next?: string | null;
  };

  const entries = Array.isArray(raw.items) ? raw.items : [];
  const simplified = entries.map((entry, idx) => {
    let t: SpotifyTrackObj | null | undefined;
    if (entry && typeof entry === "object") {
      if ("item" in entry) {
        const item = entry.item as (SpotifyTrackObj & { type?: string }) | null | undefined;
        t = item?.type === "track" || !item?.type ? item : null;
      } else if ("track" in entry) {
        t = entry.track as SpotifyTrackObj | null | undefined;
      } else {
        t = entry as SpotifyTrackObj | null | undefined;
      }
    } else {
      t = null;
    }
    const artists = Array.isArray(t?.artists) ? t.artists.map((a) => a.name ?? "").filter(Boolean) : [];
    const artistLine = artists.join(", ") || "—";
    const cover =
      Array.isArray(t?.album?.images) && t.album.images.length
        ? t.album.images[0]?.url ?? null
        : null;
    const spotifyTrackId = typeof t?.id === "string" && t.id.length > 0 ? t.id : null;
    return {
      id:
        spotifyTrackId ??
        (typeof t?.uri === "string" && t.uri.length > 0
          ? t.uri
          : `unavailable:${playlistId}:${offset + idx}`),
      name: typeof t?.name === "string" ? t.name : "Faixa indisponível",
      artistLine,
      album: typeof t?.album?.name === "string" ? t.album.name : "",
      durationMs: typeof t?.duration_ms === "number" ? t.duration_ms : 0,
      coverUrl: cover,
      importable: Boolean(spotifyTrackId),
    };
  });

  const payload: Record<string, unknown> = {
    tracks: simplified,
    total: typeof raw.total === "number" ? raw.total : simplified.length,
    limit: typeof raw.limit === "number" ? raw.limit : limit,
    offset: typeof raw.offset === "number" ? raw.offset : offset,
    hasMore: Boolean(raw.next),
  };

  if (process.env.NODE_ENV === "development") {
    payload.rawItemsSample = entries.slice(0, 2);
  }

  return NextResponse.json(payload);
}
