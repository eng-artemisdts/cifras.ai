import { fetchBeethovenFromBrowser } from "@/lib/beethoven-browser-client";

export async function deleteMyVariationByTrackId(trackId: string): Promise<void> {
  const key = trackId.trim();
  if (!key) throw new Error("variation_track_id_missing");
  const res = await fetchBeethovenFromBrowser(`tracks/variations/by-track-id/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`delete_variation_failed:${res.status}`);
  }
}

export async function removeTrackFromLibraryByTrackKey(trackKey: string): Promise<void> {
  const key = trackKey.trim();
  if (!key) throw new Error("library_track_key_missing");
  const res = await fetchBeethovenFromBrowser(`library-home/access/by-track-key/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`remove_library_track_failed:${res.status}`);
  }
}
