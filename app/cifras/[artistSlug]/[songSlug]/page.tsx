import type { Metadata } from "next";

import { CifraTrackView } from "@/components/cifra/cifra-track-view";
import {
  buildCifraTrackMetadata,
  resolveCifraTrackForShareMetadata,
} from "@/lib/cifra/cifra-track-metadata";
import { fetchSchubertTrackBySlugPublic } from "@/lib/schubert-fetch-track";

type PageProps = Readonly<{
  params: Promise<{ artistSlug: string; songSlug: string }>;
  searchParams: Promise<{ v?: string }>;
}>;

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { artistSlug, songSlug } = await params;
  const sp = await searchParams;
  const variationTrackId = typeof sp.v === "string" && sp.v.trim() ? sp.v.trim() : "";

  let track: Awaited<ReturnType<typeof fetchSchubertTrackBySlugPublic>> = null;
  try {
    track = await fetchSchubertTrackBySlugPublic(artistSlug, songSlug);
  } catch {
    return {
      title: "Cifra",
      description: "Pré-visualização sincronizada de letra e acordes.",
    };
  }

  if (!track) {
    return {
      title: "Cifra não encontrada",
      description: "Esta cifra não está disponível no cifra.ai.",
    };
  }

  const shareTrack = resolveCifraTrackForShareMetadata(track, variationTrackId);
  return buildCifraTrackMetadata(shareTrack, artistSlug, songSlug);
}

export default async function CifrasSongPage({ params, searchParams }: PageProps) {
  const { artistSlug, songSlug } = await params;
  const sp = await searchParams;
  const variationTrackId = typeof sp.v === "string" && sp.v.trim() ? sp.v.trim() : null;
  return <CifraTrackView artistSlug={artistSlug} songSlug={songSlug} variationTrackId={variationTrackId} />;
}
