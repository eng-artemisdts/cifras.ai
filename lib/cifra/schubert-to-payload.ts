import type { MusicAiDemoPayload, MusicAiLyricSegment, MusicAiMeta } from "./musicai-types";
import type { SchubertLyricsSource, SchubertTrackJson } from "../schubert-api";

function isLyricSegmentArray(v: unknown): v is MusicAiLyricSegment[] {
  return Array.isArray(v);
}

/**
 * Rótulo curto da origem da letra (UI / sidebar).
 */
export function schubertLyricsSourceLabel(src: SchubertLyricsSource | undefined): string {
  return src === "MATCH" ? "letra alinhada (match)" : "letra IA";
}

/**
 * Rótulo curto no estilo do editor (subtítulo / painel).
 */
export function schubertLyricsSourceEditorLabel(src: SchubertLyricsSource | undefined): string {
  return src === "MATCH" ? "letra match" : "letra IA";
}

/**
 * Converte o documento `Track` da Schubert (JSON) para o payload canónico da POC.
 */
export function schubertTrackToDemoPayload(track: SchubertTrackJson): MusicAiDemoPayload {
  const lyrics = isLyricSegmentArray(track.lyrics) ? track.lyrics : [];
  const source: SchubertLyricsSource = track.lyricsSource === "MATCH" ? "MATCH" : "AI";
  const spotifyTrackId =
    typeof track.spotifyTrackId === "string" && track.spotifyTrackId.trim()
      ? track.spotifyTrackId.trim()
      : typeof track.spotifyId === "string" && track.spotifyId.trim()
        ? track.spotifyId.trim()
        : typeof track.meta?.spotifyTrackId === "string" && track.meta.spotifyTrackId.trim()
          ? track.meta.spotifyTrackId.trim()
          : "";
  const spotifyUrl =
    typeof track.spotifyUrl === "string" && track.spotifyUrl.trim()
      ? track.spotifyUrl.trim()
      : typeof track.meta?.spotifyUrl === "string" && track.meta.spotifyUrl.trim()
        ? track.meta.spotifyUrl.trim()
        : spotifyTrackId
          ? `https://open.spotify.com/track/${spotifyTrackId}`
          : "";
  const youtubeVideoId =
    typeof track.youtubeVideoId === "string" && track.youtubeVideoId.trim()
      ? track.youtubeVideoId.trim()
      : typeof track.meta?.youtubeVideoId === "string" && track.meta.youtubeVideoId.trim()
        ? track.meta.youtubeVideoId.trim()
        : "";
  const youtubeUrl =
    typeof track.youtubeUrl === "string" && track.youtubeUrl.trim()
      ? track.youtubeUrl.trim()
      : typeof track.meta?.youtubeUrl === "string" && track.meta.youtubeUrl.trim()
        ? track.meta.youtubeUrl.trim()
        : youtubeVideoId
          ? `https://www.youtube.com/watch?v=${youtubeVideoId}`
          : "";
  const meta: MusicAiMeta = {
    ...(track.meta && typeof track.meta === "object" ? track.meta : {}),
    trackId: track.trackId ?? track.meta?.trackId,
    name: track.name ?? track.meta?.name,
    lyricsVariant: source === "MATCH" ? "match" : "ai",
    ...(spotifyTrackId ? { spotifyTrackId } : {}),
    ...(spotifyUrl ? { spotifyUrl } : {}),
    ...(youtubeVideoId ? { youtubeVideoId } : {}),
    ...(youtubeUrl ? { youtubeUrl } : {}),
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
