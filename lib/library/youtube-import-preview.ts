import { normalizeStreamingImportUrl } from "@/lib/library/streaming-url-validation";

export type YoutubeImportPreview = {
  title: string;
  channel: string;
  thumbnailUrl: string | null;
};

/**
 * Metadados leves via oEmbed público do YouTube (título, canal, miniatura).
 * Falha silenciosa — a ingestão no servidor resolve título/artista via yt-dlp.
 */
export async function fetchYoutubeImportPreview(sourceUrl: string): Promise<YoutubeImportPreview | null> {
  const url = normalizeStreamingImportUrl(sourceUrl);
  if (!url) return null;

  try {
    const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembed);
    if (!res.ok) return null;
    const j = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    const title = typeof j.title === "string" && j.title.trim() ? j.title.trim() : "";
    const channel = typeof j.author_name === "string" && j.author_name.trim() ? j.author_name.trim() : "";
    if (!title && !channel) return null;
    return {
      title: title || "Vídeo do YouTube",
      channel: channel || "YouTube",
      thumbnailUrl:
        typeof j.thumbnail_url === "string" && j.thumbnail_url.trim() ? j.thumbnail_url.trim() : null,
    };
  } catch {
    return null;
  }
}
