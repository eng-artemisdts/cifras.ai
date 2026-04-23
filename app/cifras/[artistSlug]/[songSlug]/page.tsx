import type { Metadata } from "next";

import { CifraTrackView } from "@/components/cifra/cifra-track-view";

export const metadata: Metadata = {
  title: "Cifra · cifra.ai",
  description: "Pré-visualização sincronizada de letra e acordes.",
};

type PageProps = Readonly<{
  params: Promise<{ artistSlug: string; songSlug: string }>;
  searchParams: Promise<{ v?: string }>;
}>;

export default async function CifrasSongPage({ params, searchParams }: PageProps) {
  const { artistSlug, songSlug } = await params;
  const sp = await searchParams;
  const variationTrackId = typeof sp.v === "string" && sp.v.trim() ? sp.v.trim() : null;
  return <CifraTrackView artistSlug={artistSlug} songSlug={songSlug} variationTrackId={variationTrackId} />;
}
