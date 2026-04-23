import type { SchubertTrackJson } from "./schubert-api";

function schubertApiBase(): string {
  return (process.env.SCHUBERT_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

/** Origem da app Next (server) para proxy autenticado `/api/schubert/*` com cookies de sessão. */
function nextInternalOrigin(): string {
  return (
    process.env.NEXT_INTERNAL_ORIGIN?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://127.0.0.1:3000"
  );
}

async function serverCookieHeader(): Promise<HeadersInit> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const parts = store.getAll();
    if (!parts.length) return {};
    return {
      Cookie: parts.map((c) => `${c.name}=${c.value}`).join("; "),
    };
  } catch {
    return {};
  }
}

/**
 * Leitura de faixa no servidor (RSC): tenta o BFF `/api/schubert/*` com cookies (variações privadas do utilizador);
 * se falhar (401 / rede), usa GET directo na Schubert API (visão anónima).
 */
async function fetchSchubertTrackRead(pathRelative: string): Promise<SchubertTrackJson | null> {
  const path = pathRelative.replace(/^\/+/, "");
  let res: Response | null = null;

  if (typeof window === "undefined") {
    try {
      const origin = nextInternalOrigin();
      const headers = await serverCookieHeader();
      const proxyUrl = `${origin}/api/schubert/${path}`;
      const proxyRes = await fetch(proxyUrl, { cache: "no-store", headers });
      if (proxyRes.ok) {
        res = proxyRes;
      }
    } catch {
      /* fallback directo */
    }
  }

  if (!res?.ok) {
    const directUrl = `${schubertApiBase()}/${path}`;
    res = await fetch(directUrl, { cache: "no-store" });
  }

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
  const urlPath = `tracks/by-key/${encodeURIComponent(key)}`;
  return fetchSchubertTrackRead(urlPath);
}

/** Obtém a faixa por slugs do artista e da música (`GET /tracks/by-slug/...`). */
export async function fetchSchubertTrackBySlug(
  artistSlug: string,
  songSlug: string,
): Promise<SchubertTrackJson | null> {
  const a = artistSlug.trim();
  const s = songSlug.trim();
  if (!a || !s) return null;
  const urlPath = `tracks/by-slug/${encodeURIComponent(a)}/${encodeURIComponent(s)}`;
  return fetchSchubertTrackRead(urlPath);
}
