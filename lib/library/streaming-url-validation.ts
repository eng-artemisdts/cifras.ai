import type { StreamingImportProviderSlug } from "@/lib/library/streaming-link-import-config";

/** Garante protocolo https — exigido pelo DTO `IngestUrlDto` na schubert-api. */
export function normalizeStreamingImportUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/\//, "")}`;
}

function matchesProvider(url: string, slug: StreamingImportProviderSlug): boolean {
  const u = url.toLowerCase();
  switch (slug) {
    case "youtube":
      return u.includes("youtube.com") || u.includes("youtu.be");
    case "spotify":
      return u.includes("spotify.com");
    case "tiktok":
      return u.includes("tiktok.com") || u.includes("vm.tiktok.com");
    case "instagram":
      return u.includes("instagram.com") || u.includes("instagr.am");
    default:
      return false;
  }
}

export function validateStreamingImportUrl(
  raw: string,
  slug: StreamingImportProviderSlug,
): { ok: true; url: string } | { ok: false; message: string } {
  const url = normalizeStreamingImportUrl(raw);
  if (!url) {
    return { ok: false, message: "Cole um link válido antes de continuar." };
  }

  try {
    new URL(url);
  } catch {
    return { ok: false, message: "O link não parece ser um URL válido." };
  }

  if (!matchesProvider(url, slug)) {
    const hints: Record<StreamingImportProviderSlug, string> = {
      youtube: "Use um link youtube.com, youtu.be ou playlist pública.",
      spotify: "Use um link open.spotify.com/track/…",
      tiktok: "Use um link tiktok.com ou vm.tiktok.com.",
      instagram: "Use um link instagram.com/reel/… ou /p/…",
    };
    return { ok: false, message: hints[slug] };
  }

  return { ok: true, url };
}
