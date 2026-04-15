/** Segmento de URL para variante de letras: `a` = IA, `m` = match (Spotify/align). */
export type BibliotecaCifraLyricsPath = "a" | "m";

export function bibliotecaCifraHref(trackId: string, lyrics: BibliotecaCifraLyricsPath = "a"): string {
  const id = trackId.trim();
  if (!id) return `/biblioteca/cifra/${lyrics}`;
  return `/biblioteca/cifra/${lyrics}?trackId=${encodeURIComponent(id)}`;
}

/** Fluxo de edição interativa (letra + posição de acordes) antes de abrir a cifra «final». */
export function bibliotecaCifraEditHref(trackId: string, lyrics: BibliotecaCifraLyricsPath = "a"): string {
  const id = trackId.trim();
  if (!id) return `/biblioteca/cifra/edit?v=${lyrics}`;
  return `/biblioteca/cifra/edit?trackId=${encodeURIComponent(id)}&v=${lyrics}`;
}

export function isBibliotecaCifraLyricsPath(s: string): s is BibliotecaCifraLyricsPath {
  return s === "a" || s === "m";
}
