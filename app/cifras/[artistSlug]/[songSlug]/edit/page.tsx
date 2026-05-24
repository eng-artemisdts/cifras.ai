import type { Metadata } from "next";

import { CifraEditView } from "@/components/cifra/cifra-edit-view";

export const metadata: Metadata = {
  title: "Editar cifra · cifra.ai",
  description: "Edite a letra e reposicione acordes antes de gravar.",
};

type PageProps = Readonly<{
  params: Promise<{ artistSlug: string; songSlug: string }>;
  searchParams: Promise<{ v?: string }>;
}>;

export default async function CifrasSongEditPage({ params, searchParams }: PageProps) {
  const { artistSlug, songSlug } = await params;
  const sp = await searchParams;
  const variationTrackId = typeof sp.v === "string" && sp.v.trim() ? sp.v.trim() : null;
  return <CifraEditView artistSlug={artistSlug} songSlug={songSlug} variationTrackId={variationTrackId} />;
}
