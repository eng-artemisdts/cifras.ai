/**
 * Visualização da cifra (`/cifras`). Com `trackId`, a landing resolve slugs Schubert e
 * redireciona para `/cifras/:artista/:musica`, senão renderiza `CifraTrackView`.
 */
export function libraryTrackCifraHref(trackKey: string | null | undefined): string | null {
  const k = typeof trackKey === "string" ? trackKey.trim() : "";
  if (!k) return null;
  return `/cifras?trackId=${encodeURIComponent(k)}`;
}
