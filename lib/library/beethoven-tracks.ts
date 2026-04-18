import { fetchBeethovenFromServer } from "@/lib/beethoven-api";
import { cifraHref, resolveCifraSlugPairFromTrack } from "@/lib/cifra/cifra-routes";
import type { RecentAccessItem, RecommendationTile } from "@/lib/library/types";
import type { SchubertTrackJson } from "@/lib/schubert-api";
import { fetchSchubertTrackByKey } from "@/lib/schubert-fetch-track";

function cifraHrefFromSchubertTrack(
  schubert: SchubertTrackJson | null,
  trackKey: string,
): string | null {
  const k = trackKey.trim();
  if (!k) return null;
  const pair = resolveCifraSlugPairFromTrack(schubert ?? undefined);
  if (pair) return cifraHref(pair.artistSlug, pair.songSlug);
  return `/cifras?trackId=${encodeURIComponent(k)}`;
}

type BeethovenTrack = {
  _id?: string;
  id?: string;
  trackId?: string;
  name?: string;
  artistId?: { name?: string } | string | null;
  updatedAt?: string;
};

const coverTones: RecommendationTile["coverTone"][] = ["navy", "navyAlt", "surface", "tealGlow"];
const thumbTones: RecentAccessItem["thumbTone"][] = ["navy", "tealTint", "surface"];

type BeethovenLibraryHomeFeed = {
  recommended?: BeethovenTrack[];
  recent?: BeethovenTrack[];
};

function resolveTrackArtistName(track: BeethovenTrack): string {
  if (track.artistId && typeof track.artistId === "object") {
    return track.artistId.name?.trim() || "Artista desconhecido";
  }
  return "Artista desconhecido";
}

function mapTrackToRecommendation(track: BeethovenTrack, index: number): RecommendationTile {
  const fallbackId = `${track.trackId ?? "track"}-${index}`;
  return {
    id: track._id ?? track.id ?? fallbackId,
    title: track.name?.trim() || "Sem nome",
    subtitle: `${resolveTrackArtistName(track)} · Música`,
    coverTone: coverTones[index % coverTones.length],
  };
}

async function enrichRecommendationTilesFromSchubert(
  tracks: BeethovenTrack[],
  tiles: RecommendationTile[],
): Promise<RecommendationTile[]> {
  return Promise.all(
    tiles.map(async (tile, index) => {
      const track = tracks[index];
      const key = typeof track?.trackId === "string" ? track.trackId.trim() : "";
      if (!key) return tile;
      const schubert = await fetchSchubertTrackByKey(key).catch(() => null);
      const url =
        schubert && typeof schubert.coverImageUrl === "string" && schubert.coverImageUrl.trim()
          ? schubert.coverImageUrl.trim()
          : null;
      const href = cifraHrefFromSchubertTrack(schubert, key);
      return {
        ...tile,
        ...(url ? { coverImageUrl: url } : {}),
        href,
      };
    }),
  );
}

async function enrichRecentAccessFromSchubert(
  tracks: BeethovenTrack[],
  items: RecentAccessItem[],
): Promise<RecentAccessItem[]> {
  return Promise.all(
    items.map(async (item, index) => {
      const track = tracks[index];
      const key = typeof track?.trackId === "string" ? track.trackId.trim() : "";
      if (!key) return item;
      const schubert = await fetchSchubertTrackByKey(key).catch(() => null);
      const url =
        schubert && typeof schubert.coverImageUrl === "string" && schubert.coverImageUrl.trim()
          ? schubert.coverImageUrl.trim()
          : null;
      const href = cifraHrefFromSchubertTrack(schubert, key);
      return {
        ...item,
        ...(url ? { coverImageUrl: url } : {}),
        href,
      };
    }),
  );
}

function formatRelativeTime(dateIso?: string): string {
  if (!dateIso) return "agora";
  const ts = new Date(dateIso).getTime();
  if (Number.isNaN(ts)) return "agora";
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return "agora";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ontem" : `${days} d`;
}

function mapTrackToRecentAccess(track: BeethovenTrack, index: number): RecentAccessItem {
  const fallbackId = `${track.trackId ?? "recent"}-${index}`;
  const title = track.name?.trim() || "Sem nome";
  const artistName = resolveTrackArtistName(track);
  const timeLabel = formatRelativeTime(track.updatedAt);
  return {
    id: track._id ?? track.id ?? fallbackId,
    title,
    subtitle: `${artistName} · Música · ${timeLabel}`,
    timeLabel,
    thumbTone: thumbTones[index % thumbTones.length],
  };
}

export async function fetchLibraryHomeFeed(
  userId?: string,
  recommendedLimit = 12,
  recentLimit = 8,
): Promise<{ recommendationItems: RecommendationTile[]; recentAccessItems: RecentAccessItem[] }> {
  const query = new URLSearchParams({
    recommendedLimit: String(recommendedLimit),
    recentLimit: String(recentLimit),
  });
  if (userId?.trim()) {
    query.set("userId", userId.trim());
  }
  const res = await fetchBeethovenFromServer(
    `library-home?${query.toString()}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`beethoven_library_home_fetch_failed:${res.status}`);
  }

  const data = (await res.json()) as unknown;
  if (!data || typeof data !== "object") {
    return { recommendationItems: [], recentAccessItems: [] };
  }

  const feed = data as BeethovenLibraryHomeFeed;
  const recommended = Array.isArray(feed.recommended) ? feed.recommended : [];
  const recent = Array.isArray(feed.recent) ? feed.recent : [];

  const recommendationTiles = recommended.map((track, index) =>
    mapTrackToRecommendation(track, index),
  );
  const recommendationItems = await enrichRecommendationTilesFromSchubert(
    recommended,
    recommendationTiles,
  );

  const recentRows = recent.map((track, index) => mapTrackToRecentAccess(track, index));
  const recentAccessItems = await enrichRecentAccessFromSchubert(recent, recentRows);

  return {
    recommendationItems,
    recentAccessItems,
  };
}

export async function registerLibraryTrackAccess(params: {
  userId: string;
  trackKey: string;
}): Promise<void> {
  const userId = params.userId.trim();
  const trackKey = params.trackKey.trim();
  if (!userId || !trackKey) return;

  const res = await fetchBeethovenFromServer("library-home/access/by-track-key", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, trackKey }),
  });
  if (!res.ok) {
    const errorBody = (await res.text()).slice(0, 500);
    throw new Error(`beethoven_library_access_failed:${res.status}:${errorBody}`);
  }
}
