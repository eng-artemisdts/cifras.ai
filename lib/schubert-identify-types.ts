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
};

/** Resposta de `POST /tracks/identify`. */
export type SchubertTrackIdentifyResponse = {
  recognized: boolean;
  song: SchubertRecognizedSong | null;
  /** Presente quando `recognized` e existe `Track` na base Mongo. */
  track: Record<string, unknown> | null;
};

/** Resposta de `POST /tracks/ingest` (áudio + `meta` JSON). */
export type SchubertTrackIngestResponse = {
  track: Record<string, unknown>;
};
