import type {
  MusicAiChordEvent,
  MusicAiLyricSegment,
  MusicAiMeta,
  MusicAiSection,
} from "./cifra/musicai-types";

const proxyPrefix = "/api/schubert";

/** Origem da letra persistida no `Track` (transcrição vs. alinhamento por busca / LRCLIB). */
export type SchubertLyricsSource = "AI" | "MATCH";

/** Subconjunto do documento `Track` devolvido pela Schubert (JSON) usado no site. */
export type SchubertTrackJson = {
  trackId?: string;
  spotifyId?: string;
  name?: string;
  chords?: MusicAiChordEvent[];
  /** Segmentos de letra; o par com `lyricsSource` substitui variantes duplicadas. */
  lyrics?: MusicAiLyricSegment[];
  lyricsSource?: SchubertLyricsSource;
  sections?: MusicAiSection[];
  meta?: MusicAiMeta;
  chordTimeOffsetSec?: number;
  userId?: string;
  original_tune?: string;
  capo_at?: number;
  is_private?: boolean;
  artistId?: { name?: string; _id?: unknown } | string;
};

/** Caminho relativo ao proxy Schubert (ex.: `tracks/identify`). */
export function schubertProxyUrl(path: string): string {
  const p = path.replace(/^\/+/, "");
  return `${proxyPrefix}/${p}`;
}

/**
 * Chamadas do browser à Schubert API (Nest) via BFF — cookies de sessão Auth0.
 * `SCHUBERT_AUTH0_AUDIENCE` (ou `AUTH0_AUDIENCE`) deve corresponder à API registada no Auth0.
 */
export function fetchSchubertFromBrowser(path: string, init?: RequestInit): Promise<Response> {
  return fetch(schubertProxyUrl(path), {
    ...init,
    credentials: "include",
  });
}
