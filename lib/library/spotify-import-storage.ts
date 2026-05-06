/** sessionStorage: escolha no browser Spotify antes de `/biblioteca/importar/arquivo`. */
export const SPOTIFY_IMPORT_PREFILL_STORAGE_KEY = "cifra.spotifyImportPrefill";

export type SpotifyImportPrefill = {
  trackId: string;
  title: string;
  artistLine: string;
  album: string;
  coverUrl: string | null;
};
