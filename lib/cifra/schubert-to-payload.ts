import type {
  MusicAiChordEvent,
  MusicAiDemoPayload,
  MusicAiLyricSegment,
  MusicAiMeta,
  MusicAiSection,
} from "./musicai-types";

export type SchubertTrackJson = {
  trackId?: string;
  spotifyId?: string;
  name?: string;
  chords?: MusicAiChordEvent[];
  lyricsVariants?: {
    ai?: MusicAiLyricSegment[];
    match?: MusicAiLyricSegment[];
  };
  sections?: MusicAiSection[];
  meta?: MusicAiMeta;
  chordTimeOffsetSec?: number;
  userId?: string;
  original_tune?: string;
  capo_at?: number;
  is_private?: boolean;
  artistId?: { name?: string; _id?: unknown } | string;
};

function isLyricSegmentArray(v: unknown): v is MusicAiLyricSegment[] {
  return Array.isArray(v);
}

export type SchubertLyricsVariant = "ai" | "match";

/**
 * Converte o documento `Track` da Schubert (JSON) para o payload canónico da POC.
 *
 * @param lyricsVariant Se definido (ex. pela rota `/cifra/a` ou `/cifra/m`), escolhe esse ramo em `lyricsVariants`;
 * caso contrário usa `meta.lyricsVariant` da faixa, com fallback para `ai`.
 */
export function schubertTrackToDemoPayload(
  track: SchubertTrackJson,
  lyricsVariant?: SchubertLyricsVariant,
): MusicAiDemoPayload {
  const variant: SchubertLyricsVariant =
    lyricsVariant ??
    (track.meta?.lyricsVariant === "match" ? "match" : "ai");
  const lyricsRaw =
    variant === "match" ? track.lyricsVariants?.match : track.lyricsVariants?.ai;
  const lyrics = isLyricSegmentArray(lyricsRaw) ? lyricsRaw : [];

  const meta: MusicAiMeta = {
    ...(track.meta && typeof track.meta === "object" ? track.meta : {}),
    trackId: track.trackId ?? track.meta?.trackId,
    name: track.name ?? track.meta?.name,
    lyricsVariant: variant,
  };

  return {
    chords: Array.isArray(track.chords) ? track.chords : [],
    lyrics,
    sections: Array.isArray(track.sections) ? track.sections : [],
    meta,
    chordTimeOffsetSec: Number.isFinite(track.chordTimeOffsetSec)
      ? Number(track.chordTimeOffsetSec)
      : 0,
    ...(typeof track.userId === "string" && track.userId.trim()
      ? { userId: track.userId.trim() }
      : {}),
    original_tune:
      typeof track.original_tune === "string" ? track.original_tune : "",
    capo_at: Number.isFinite(track.capo_at) ? Math.max(0, Math.round(Number(track.capo_at))) : 0,
    is_private: track.is_private === true,
  };
}

export function resolveArtistNameFromSchubertTrack(track: SchubertTrackJson): string {
  const aid = track.artistId;
  if (aid && typeof aid === "object" && "name" in aid) {
    const n = aid.name;
    if (typeof n === "string" && n.trim()) return n;
  }
  return "Artista";
}
