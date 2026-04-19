import { cifraEditHref, cifraHref, resolveCifraSlugPairFromTrack } from "@/lib/cifra/cifra-routes";
import type { SchubertTrackJson } from "@/lib/schubert-api";
import { fetchSchubertFromBrowser } from "@/lib/schubert-api";
import type {
  SchubertRecognizedSong,
  SchubertTrackIdentifyResponse,
  SchubertTrackIngestResponse,
} from "@/lib/schubert-identify-types";

/** Alinhado ao `MAX_MP3_UPLOAD_BYTES` da schubert-api (Multer). */
const MAX_SCHUBERT_BYTES = 50 * 1024 * 1024;

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
 * Limite de upload multipart no servidor (50 MB); a AudD só processa ~25 s após truncagem.
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
      "O ficheiro excede o limite de 50 MB para identificação.",
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

/**
 * Envia o MP3 a `POST /tracks/ingest` com o campo multipart `meta` (JSON do `song` devolvido por `/tracks/identify`).
 */
export async function postTrackIngestWithMeta(
  file: File,
  song: SchubertRecognizedSong,
): Promise<SchubertTrackIngestResponse> {
  if (!isMp3(file)) {
    throw new SchubertIdentifyError(
      "A ingestão Schubert aceita apenas ficheiros MP3.",
      400,
      null,
    );
  }
  if (file.size > MAX_SCHUBERT_BYTES) {
    throw new SchubertIdentifyError(
      "O ficheiro excede o limite de 50 MB para ingestão.",
      400,
      null,
    );
  }

  const form = new FormData();
  form.append("file", file, file.name);
  form.append("meta", JSON.stringify(song));

  const res = await fetchSchubertFromBrowser("tracks/ingest", {
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

  return json as SchubertTrackIngestResponse;
}

export type ChordFoundPreview = {
  songTitle: string;
  artistName: string;
  coverImageUrl: string | null;
  chordHref: string;
  /** Chave pública Schubert quando a faixa já existe na base; `null` se só houver reconhecimento AudD. */
  trackId: string | null;
  /** URL do editor (letra + acordes) quando `trackId` existe. */
  editHref: string | null;
};

/**
 * Monta dados para o modal de confirmação a partir do `track` Mongo + metadados AudD.
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
      ? track.trackId.trim()
      : typeof track.spotifyId === "string" && track.spotifyId.trim()
        ? track.spotifyId.trim()
        : "";
  const q = encodeURIComponent(`${songTitle} ${artistName}`.trim());
  const pair = resolveCifraSlugPairFromTrack(track as unknown as SchubertTrackJson);
  const chordHref = pair
    ? cifraHref(pair.artistSlug, pair.songSlug)
    : trackId
      ? `/cifras?trackId=${encodeURIComponent(trackId)}`
      : `/biblioteca?q=${q}`;
  const tid = trackId || null;
  const editHref = pair
    ? cifraEditHref(pair.artistSlug, pair.songSlug)
    : tid
      ? `/cifras/edit?trackId=${encodeURIComponent(tid)}`
      : null;
  return {
    songTitle,
    artistName,
    coverImageUrl: typeof song.cover_image_url === "string" && song.cover_image_url.trim()
      ? song.cover_image_url.trim()
      : null,
    chordHref,
    trackId: tid,
    editHref,
  };
}

/** Reconhecimento AudD sem documento `Track` na base — pesquisa na biblioteca até haver chave Schubert. */
export function mapRecognizedSongToChordPreview(song: SchubertRecognizedSong): ChordFoundPreview {
  const q = encodeURIComponent(`${song.title} ${song.artist}`.trim());
  return {
    songTitle: song.title,
    artistName: song.artist,
    coverImageUrl: typeof song.cover_image_url === "string" && song.cover_image_url.trim()
      ? song.cover_image_url.trim()
      : null,
    chordHref: `/biblioteca?q=${q}`,
    trackId: null,
    editHref: null,
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
