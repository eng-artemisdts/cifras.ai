import type { LibrarySearchTrackRow } from "@/lib/library/beethoven-library-search";
import { fetchSchubertFromBrowser, type SchubertTrackJson } from "@/lib/schubert-api";

/**
 * Preenche `imageUrl` a partir da Schubert (`GET tracks/by-key`) quando Beethoven não envia capa
 * e existe `trackKey` — mesmo dado usado no modal «cifra encontrada» (`cover_image_url` → `coverImageUrl` na BD).
 */
export async function enrichLibrarySearchRowsWithSchubertCovers(
  rows: LibrarySearchTrackRow[],
): Promise<LibrarySearchTrackRow[]> {
  return Promise.all(
    rows.map(async (row) => {
      if (row.imageUrl?.trim()) return row;
      const key = row.trackKey?.trim();
      if (!key) return row;
      try {
        const res = await fetchSchubertFromBrowser(`tracks/by-key/${encodeURIComponent(key)}`);
        if (!res.ok) return row;
        const data = (await res.json()) as SchubertTrackJson;
        const url =
          typeof data.coverImageUrl === "string" && data.coverImageUrl.trim()
            ? data.coverImageUrl.trim()
            : null;
        return url ? { ...row, imageUrl: url } : row;
      } catch {
        return row;
      }
    }),
  );
}
