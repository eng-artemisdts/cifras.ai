export type LandingDemoVideo =
  | { kind: "youtube"; videoId: string }
  | { kind: "file"; src: string };

/** Suporta YouTube (watch, youtu.be, embed) e ficheiros .mp4 / .webm. */
export function parseLandingDemoVideoUrl(raw: string | undefined): LandingDemoVideo | null {
  const url = raw?.trim();
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id ? { kind: "youtube", videoId: id } : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname.startsWith("/embed/")) {
        const id = parsed.pathname.split("/")[2];
        return id ? { kind: "youtube", videoId: id } : null;
      }
      const id = parsed.searchParams.get("v");
      return id ? { kind: "youtube", videoId: id } : null;
    }

    if (/\.(mp4|webm)$/i.test(parsed.pathname)) {
      return { kind: "file", src: url };
    }
  } catch {
    if (/\.(mp4|webm)$/i.test(url)) {
      return { kind: "file", src: url };
    }
  }

  return null;
}
