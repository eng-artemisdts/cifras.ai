/** Segmento de URL para variante de letras: `a` = IA, `m` = match (Spotify/align). */
export type CifraLyricsPath = "a" | "m";

/** Cifra pública sincronizada — rota própria `/cifra`. */
export function cifraHref(trackId: string, lyrics: CifraLyricsPath = "a"): string {
  const id = trackId.trim();
  if (!id) return `/cifra/${lyrics}`;
  return `/cifra/${lyrics}?trackId=${encodeURIComponent(id)}`;
}

/** Editor de transcrição (requer sessão). */
export function cifraEditHref(trackId: string, lyrics: CifraLyricsPath = "a"): string {
  const id = trackId.trim();
  if (!id) return `/cifra/edit?v=${lyrics}`;
  return `/cifra/edit?trackId=${encodeURIComponent(id)}&v=${lyrics}`;
}

export function isCifraLyricsPath(s: string): s is CifraLyricsPath {
  return s === "a" || s === "m";
}
