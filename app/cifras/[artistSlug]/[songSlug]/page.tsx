import type { Metadata } from "next";

import { CifraTrackView } from "@/components/cifra/cifra-track-view";

export const metadata: Metadata = {
  title: "Cifra · cifra.ai",
  description: "Pré-visualização sincronizada de letra e acordes.",
};

type PageProps = Readonly<{
  params: Promise<{ artistSlug: string; songSlug: string }>;
}>;

export default async function CifrasSongPage({ params }: PageProps) {
  const { artistSlug, songSlug } = await params;
  return <CifraTrackView artistSlug={artistSlug} songSlug={songSlug} />;
}
