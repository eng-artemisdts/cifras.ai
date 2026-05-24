import type { SchubertTrackJson } from "@/lib/schubert-api";

/** URL canónica da cifra: `/cifras/:artistSlug/:songSlug`. */
export function cifraHref(artistSlug: string, songSlug: string): string {
  const a = artistSlug.trim();
  const s = songSlug.trim();
  if (!a || !s) return "/cifras";
  return `/cifras/${encodeURIComponent(a)}/${encodeURIComponent(s)}`;
}

/** Editor de transcrição: `/cifras/:artistSlug/:songSlug/edit`. */
export function cifraEditHref(artistSlug: string, songSlug: string): string {
  const a = artistSlug.trim();
  const s = songSlug.trim();
  if (!a || !s) return "/cifras/edit";
  return `/cifras/${encodeURIComponent(a)}/${encodeURIComponent(s)}/edit`;
}

/** Extrai slugs quando o JSON da faixa inclui `slug` e `artistId.slug` (populate). */
export function resolveCifraSlugPairFromTrack(
  track: SchubertTrackJson | null | undefined,
): { artistSlug: string; songSlug: string } | null {
  const songSlug = typeof track?.slug === "string" ? track.slug.trim() : "";
  if (!songSlug) return null;
  const aid = track?.artistId;
  if (aid && typeof aid === "object" && "slug" in aid) {
    const ar = aid as { slug?: string };
    const artistSlug = typeof ar.slug === "string" ? ar.slug.trim() : "";
    if (artistSlug) return { artistSlug, songSlug };
  }
  return null;
}
