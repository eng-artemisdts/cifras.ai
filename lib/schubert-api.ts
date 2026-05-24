import {
  logoutHrefWithReturnTo,
  responseIndicatesSessionExpired,
} from "@/lib/auth0-session-expired";

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
  youtubeVideoId?: string;
  youtubeUrl?: string;
  spotifyTrackId?: string;
  spotifyUrl?: string;
  /** Slug da faixa (URL em conjunto com o slug do artista). */
  slug?: string;
  name?: string;
  chords?: MusicAiChordEvent[];
  /** Segmentos de letra; o par com `lyricsSource` substitui variantes duplicadas. */
  lyrics?: MusicAiLyricSegment[];
  lyricsSource?: SchubertLyricsSource;
  sections?: MusicAiSection[];
  meta?: MusicAiMeta;
  chordTimeOffsetSec?: number;
  userId?: string;
  owner?: string;
  original_tune?: string;
  capo_at?: number;
  is_private?: boolean;
  artistId?:
    | {
        name?: string;
        slug?: string;
        spotifyId?: string;
        _id?: unknown;
      }
    | string;
  /** Capa persistida na ingestão (AudD `cover_image_url`). */
  coverImageUrl?: string;
  variationKey?: string;
  variationOfTrackId?: string;
  /** Nome da versão no selector (variações). */
  variationLabel?: string;
  variations?: SchubertTrackJson[];
};

/** Caminho relativo ao proxy Schubert (ex.: `tracks/identify`). */
export function schubertProxyUrl(path: string): string {
  const p = path.replace(/^\/+/, "");
  return `${proxyPrefix}/${p}`;
}

function redirectSchubertBrowserToLogout(): Promise<never> {
  if (typeof window !== "undefined") {
    const current = `${window.location.pathname}${window.location.search}`;
    window.location.href = logoutHrefWithReturnTo(current);
  }
  return new Promise<never>(() => {});
}

/**
 * Chamadas do browser à Schubert API (Nest) via BFF — cookies de sessão Auth0.
 * `SCHUBERT_AUTH0_AUDIENCE` (ou `AUTH0_AUDIENCE`) deve corresponder à API registada no Auth0.
 *
 * Se o BFF reportar sessão expirada (401 + `code: session_expired`), força logout no cliente
 * para limpar a sessão e enviar o utilizador ao login.
 */
export async function fetchSchubertFromBrowser(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(schubertProxyUrl(path), {
    ...init,
    credentials: "include",
  });
  if (await responseIndicatesSessionExpired(res)) {
    await redirectSchubertBrowserToLogout();
  }
  return res;
}
