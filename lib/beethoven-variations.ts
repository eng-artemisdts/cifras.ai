import type { MusicAiChordEvent, MusicAiLyricSegment, MusicAiMeta, MusicAiSection } from "@/lib/cifra/musicai-types";
import { fetchBeethovenFromBrowser } from "@/lib/beethoven-api";
import type { SchubertLyricsSource, SchubertTrackJson } from "@/lib/schubert-api";

export type BeethovenVariationJson = {
  trackId?: string;
  name?: string;
  artistId?:
    | {
        _id?: unknown;
        name?: string;
      }
    | string;
  chords?: MusicAiChordEvent[];
  lyrics?: MusicAiLyricSegment[];
  lyricsSource?: SchubertLyricsSource;
  sections?: MusicAiSection[];
  meta?: MusicAiMeta;
  chordTimeOffsetSec?: number;
  userId?: string;
  original_tune?: string;
  capo_at?: number;
  is_private?: boolean;
  variationOfTrackId?: string;
  variationLabel?: string;
  baseArtistSlug?: string;
  baseSongSlug?: string;
  coverImageUrl?: string;
};

type BeethovenApiError = Error & { status?: number };

function parseBeethovenError(status: number, raw: string): never {
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as { message?: unknown; error?: unknown };
    if (Array.isArray(parsed.message)) detail = parsed.message.join("; ");
    else if (typeof parsed.message === "string" && parsed.message.trim()) detail = parsed.message;
    else if (typeof parsed.error === "string" && parsed.error.trim()) detail = parsed.error;
  } catch {
    // ignore JSON parse
  }
  const err = new Error(detail || `HTTP ${status}`) as BeethovenApiError;
  err.status = status;
  throw err;
}

export async function fetchBeethovenVariationsByBaseTrackIdFromBrowser(
  baseTrackId: string,
): Promise<BeethovenVariationJson[]> {
  const key = baseTrackId.trim();
  if (!key) return [];
  const res = await fetchBeethovenFromBrowser(`tracks/variations/by-base-key/${encodeURIComponent(key)}`, {
    method: "GET",
  });
  if (res.status === 404) return [];
  const raw = await res.text();
  if (!res.ok) parseBeethovenError(res.status, raw);
  const data = raw ? (JSON.parse(raw) as unknown) : [];
  return Array.isArray(data) ? (data as BeethovenVariationJson[]) : [];
}

export async function fetchMyBeethovenVariationByBaseTrackIdFromBrowser(
  baseTrackId: string,
): Promise<BeethovenVariationJson | null> {
  const key = baseTrackId.trim();
  if (!key) return null;
  const res = await fetchBeethovenFromBrowser(`tracks/variations/my/by-base-key/${encodeURIComponent(key)}`, {
    method: "GET",
  });
  if (res.status === 404) return null;
  const raw = await res.text();
  if (!res.ok) parseBeethovenError(res.status, raw);
  return raw ? (JSON.parse(raw) as BeethovenVariationJson) : null;
}

export async function createBeethovenVariationFromSchubertTrack(params: {
  baseTrackId: string;
  baseArtistSlug: string;
  baseSongSlug: string;
  sourceTrack: SchubertTrackJson;
  variationLabel?: string;
  isPrivate?: boolean;
}): Promise<BeethovenVariationJson> {
  const res = await fetchBeethovenFromBrowser("tracks/variations/from-schubert-track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseTrackId: params.baseTrackId,
      baseArtistSlug: params.baseArtistSlug,
      baseSongSlug: params.baseSongSlug,
      sourceTrack: params.sourceTrack,
      variationLabel: params.variationLabel ?? "",
      is_private: params.isPrivate ?? true,
    }),
  });
  const raw = await res.text();
  if (!res.ok) parseBeethovenError(res.status, raw);
  return JSON.parse(raw) as BeethovenVariationJson;
}

export async function patchBeethovenVariationFromBrowser(
  variationTrackId: string,
  body: {
    chords?: unknown;
    lyrics?: unknown;
    lyricsSource?: SchubertLyricsSource;
    sections?: unknown;
    variationLabel?: string;
    is_private?: boolean;
    original_tune?: string;
    capo_at?: number;
  },
): Promise<BeethovenVariationJson> {
  const key = variationTrackId.trim();
  const res = await fetchBeethovenFromBrowser(`tracks/variations/by-track-id/${encodeURIComponent(key)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) parseBeethovenError(res.status, raw);
  return JSON.parse(raw) as BeethovenVariationJson;
}
