import { fetchSchubertFromBrowser } from "@/lib/schubert-api";
import type { SchubertRecognizedSong, SchubertTrackIdentifyResponse } from "@/lib/schubert-identify-types";

const MAX_SCHUBERT_BYTES = 20 * 1024 * 1024;

export class SchubertIdentifyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "SchubertIdentifyError";
  }
}

function isMp3(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = (file.type ?? "").toLowerCase();
  return name.endsWith(".mp3") || mime === "audio/mpeg" || mime === "audio/mp3";
}

/**
 * Envia um MP3 ao endpoint `POST /tracks/identify` da Schubert API (reconhecimento + match na base).
 * Limite de 20 MB imposto pelo servidor Schubert.
 */
export async function identifyTrackFromMp3(file: File): Promise<SchubertTrackIdentifyResponse> {
  if (!isMp3(file)) {
    throw new SchubertIdentifyError(
      "A identificação Schubert aceita apenas ficheiros MP3.",
      400,
      null,
    );
  }
  if (file.size > MAX_SCHUBERT_BYTES) {
    throw new SchubertIdentifyError(
      "O ficheiro excede o limite de 20 MB para identificação.",
      400,
      null,
    );
  }

  const form = new FormData();
  form.append("file", file, file.name);

  const res = await fetchSchubertFromBrowser("tracks/identify", {
    method: "POST",
    body: form,
  });

  const raw = await res.text();
  let json: unknown = null;
  if (raw) {
    try {
      json = JSON.parse(raw) as unknown;
    } catch {
      json = { raw };
    }
  }

  if (!res.ok) {
    const msg = formatUpstreamErrorMessage(json, res.statusText);
    throw new SchubertIdentifyError(msg, res.status, json);
  }

  return json as SchubertTrackIdentifyResponse;
}

export type ChordFoundPreview = {
  songTitle: string;
  artistName: string;
  coverImageUrl: string | null;
  chordHref: string;
};

/**
 * Monta dados para o modal «cifra já encontrada» a partir do `track` Mongo + metadados AudD.
 */
export function mapSchubertMatchToChordPreview(
  track: Record<string, unknown>,
  song: SchubertRecognizedSong,
): ChordFoundPreview {
  const songTitle =
    typeof track.name === "string" && track.name.trim() ? track.name : song.title;
  const artistName = resolveArtistName(track, song);
  const trackId =
    typeof track.trackId === "string" && track.trackId.trim()
      ? track.trackId
      : typeof track.spotifyId === "string" && track.spotifyId.trim()
        ? track.spotifyId
        : "";
  const q = encodeURIComponent(`${songTitle} ${artistName}`.trim());
  const chordHref = trackId
    ? `/biblioteca/resultados?trackId=${encodeURIComponent(trackId)}`
    : `/biblioteca/resultados?q=${q}`;
  return {
    songTitle,
    artistName,
    coverImageUrl: null,
    chordHref,
  };
}

function resolveArtistName(track: Record<string, unknown>, song: SchubertRecognizedSong): string {
  const aid = track.artistId;
  if (aid && typeof aid === "object") {
    const n = (aid as { name?: unknown }).name;
    if (typeof n === "string" && n.trim()) return n;
  }
  return song.artist;
}

function formatUpstreamErrorMessage(json: unknown, fallback: string): string {
  if (typeof json !== "object" || json === null) {
    return fallback || "Falha na identificação";
  }
  const m = (json as { message?: unknown }).message;
  if (Array.isArray(m)) return m.map(String).join("; ");
  if (typeof m === "string" && m.trim()) return m;
  return fallback || "Falha na identificação";
}
