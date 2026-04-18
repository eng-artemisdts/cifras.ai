import type { SchubertTrackJson } from "./schubert-api";

function schubertApiBase(): string {
  return (process.env.SCHUBERT_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

/**
 * Leitura de faixa no servidor (RSC): chama a Schubert API **sem** Bearer no cliente.
 * Os GET `tracks/by-slug` e `tracks/by-key` são públicos na API; o URL da Schubert só existe no servidor (`SCHUBERT_API_BASE_URL`).
 */
async function fetchSchubertTrackRead(url: string): Promise<SchubertTrackJson | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`schubert_track_fetch_failed:${res.status}`);
  }
  return (await res.json()) as SchubertTrackJson;
}

/** Obtém o JSON da faixa por `trackId` ou `spotifyId` (legado / redirecionamentos). */
export async function fetchSchubertTrackByKey(trackKey: string): Promise<SchubertTrackJson | null> {
  const key = trackKey.trim();
  if (!key) return null;
  const url = `${schubertApiBase()}/tracks/by-key/${encodeURIComponent(key)}`;
  return fetchSchubertTrackRead(url);
}

/** Obtém a faixa por slugs do artista e da música (`GET /tracks/by-slug/...`). */
export async function fetchSchubertTrackBySlug(
  artistSlug: string,
  songSlug: string,
): Promise<SchubertTrackJson | null> {
  const a = artistSlug.trim();
  const s = songSlug.trim();
  if (!a || !s) return null;
  const url = `${schubertApiBase()}/tracks/by-slug/${encodeURIComponent(a)}/${encodeURIComponent(s)}`;
  return fetchSchubertTrackRead(url);
}
