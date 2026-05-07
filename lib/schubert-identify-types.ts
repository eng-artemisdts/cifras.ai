/** Alinhado a `RecognizedSongDto` na schubert-api. */
export type SchubertRecognizedSong = {
  title: string;
  artist: string;
  album: string;
  release_date: string;
  label: string;
  timecode: string;
  song_link: string;
  spotify_track_id?: string;
  spotify_artist_ids: string[];
  duration_ms?: number;
  cover_image_url?: string;
  /** Preview MP3 (~30 s) da Spotify Web API — preferido para ingest sem YouTube. */
  spotify_preview_url?: string;
};

/** Resposta de `POST /tracks/identify`. */
export type SchubertTrackIdentifyResponse = {
  recognized: boolean;
  song: SchubertRecognizedSong | null;
  /** Presente quando `recognized` e existe `Track` na base Mongo. */
  track: Record<string, unknown> | null;
  canCreateVariation?: boolean;
  canEditTrack?: boolean;
};

/** Resposta de `POST /tracks/ingest` (áudio + `meta` JSON). */
export type SchubertTrackIngestResponse = {
  track?: Record<string, unknown>;
  jobId?: string;
  status?: "queued" | "running" | "completed" | "failed";
  progressPercent?: number;
};

export type SchubertIngestJobStage = {
  stageName: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  cacheHit?: boolean;
  error?: string;
};

export type SchubertIngestJobResponse = {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progressPercent: number;
  currentStage: string;
  resultTrackId?: string;
  error?: string;
  stages?: SchubertIngestJobStage[];
};
