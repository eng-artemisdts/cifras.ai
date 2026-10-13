import type { Metadata } from "next";

import { getSiteUrl } from "@/components/seo/google-site-seo";
import { cifraHref } from "@/lib/cifra/cifra-routes";
import {
  mergeVariationWithBaseMedia,
  resolveArtistNameFromSchubertTrack,
} from "@/lib/cifra/schubert-to-payload";
import { youtubeThumbnailUrl } from "@/lib/media/resolve-track-audio-url";
import type { SchubertTrackJson } from "@/lib/schubert-api";

const SITE_NAME = "cifra.ai";

function resolveTrackTitle(track: SchubertTrackJson): string {
  if (typeof track.name === "string" && track.name.trim()) return track.name.trim();
  if (typeof track.meta?.name === "string" && track.meta.name.trim()) return track.meta.name.trim();
  return "Música sem título";
}

function toAbsoluteOgImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  const base = getSiteUrl();
  return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

/** URL absoluta da capa para Open Graph / WhatsApp / Instagram. */
export function resolveCifraTrackOgImageUrl(track: SchubertTrackJson): string {
  const cover = typeof track.coverImageUrl === "string" ? track.coverImageUrl.trim() : "";
  if (cover) {
    const absolute = toAbsoluteOgImageUrl(cover);
    if (absolute) return absolute;
  }

  const youtubeVideoId =
    (typeof track.youtubeVideoId === "string" && track.youtubeVideoId.trim()) ||
    (typeof track.meta?.youtubeVideoId === "string" && track.meta.youtubeVideoId.trim()) ||
    "";
  if (youtubeVideoId) return youtubeThumbnailUrl(youtubeVideoId, "hq");

  return `${getSiteUrl()}/opengraph-image.png`;
}

export function buildCifraTrackMetadata(
  track: SchubertTrackJson,
  artistSlug: string,
  songSlug: string,
): Metadata {
  const title = resolveTrackTitle(track);
  const artist = resolveArtistNameFromSchubertTrack(track);
  const pageTitle = `${title} — ${artist}`;
  const description = `Cifra e acordes de «${title}» por ${artist}. Letra sincronizada no ${SITE_NAME}.`;
  const path = cifraHref(artistSlug, songSlug);
  const url = `${getSiteUrl()}${path}`;
  const imageUrl = resolveCifraTrackOgImageUrl(track);

  return {
    title: pageTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url,
      siteName: SITE_NAME,
      title: pageTitle,
      description,
      images: [
        {
          url: imageUrl,
          alt: `Capa de ${title} — ${artist}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [imageUrl],
    },
  };
}

/** Metadados quando a faixa base tem variação seleccionada via `?v=`. */
export function resolveCifraTrackForShareMetadata(
  baseTrack: SchubertTrackJson,
  variationTrackId: string,
): SchubertTrackJson {
  const id = variationTrackId.trim();
  if (!id) return baseTrack;

  const variations = Array.isArray(baseTrack.variations) ? baseTrack.variations : [];
  const variation = variations.find((v) => typeof v.trackId === "string" && v.trackId.trim() === id);
  if (!variation) return baseTrack;

  return mergeVariationWithBaseMedia(variation, baseTrack);
}
