import { publicMp3UrlForTrackId } from "@/lib/media/public-mp3-for-track";

/**
 * URL de áudio para o player HTML5: prioriza `meta.audioUrl` (S3 após ingestão),
 * com fallback para MP3 estático em `/media/mp3/{trackId}.mp3`.
 */
export function resolveTrackAudioUrl(
  meta: { audioUrl?: string | null; trackId?: string | null } | undefined,
  trackIdFallback?: string | null,
): string {
  const fromMeta = typeof meta?.audioUrl === "string" ? meta.audioUrl.trim() : "";
  if (fromMeta && /^https?:\/\//i.test(fromMeta)) return fromMeta;

  const trackId =
    (typeof meta?.trackId === "string" ? meta.trackId.trim() : "") ||
    (typeof trackIdFallback === "string" ? trackIdFallback.trim() : "");
  return trackId ? publicMp3UrlForTrackId(trackId) : "";
}

export function youtubeThumbnailUrl(videoId: string, quality: "hq" | "max" = "hq"): string {
  const id = videoId.trim();
  if (!id) return "";
  return quality === "max"
    ? `https://i.ytimg.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg`
    : `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}
