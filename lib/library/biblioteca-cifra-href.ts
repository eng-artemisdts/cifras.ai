/** Segmento de URL para variante de letras: `a` = IA, `m` = match (Spotify/align). */
export type BibliotecaCifraLyricsPath = "a" | "m";

export function bibliotecaCifraHref(trackId: string, lyrics: BibliotecaCifraLyricsPath = "a"): string {
  const id = trackId.trim();
  if (!id) return `/biblioteca/cifra/${lyrics}`;
  return `/biblioteca/cifra/${lyrics}?trackId=${encodeURIComponent(id)}`;
}

export function isBibliotecaCifraLyricsPath(s: string): s is BibliotecaCifraLyricsPath {
  return s === "a" || s === "m";
}
