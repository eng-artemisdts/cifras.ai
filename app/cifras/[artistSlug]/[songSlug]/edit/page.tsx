import type { Metadata } from "next";

import { CifraEditView } from "@/components/cifra/cifra-edit-view";

export const metadata: Metadata = {
  title: "Editar cifra · cifra.ai",
  description: "Edite a letra e reposicione acordes antes de gravar.",
};

type PageProps = Readonly<{
  params: Promise<{ artistSlug: string; songSlug: string }>;
}>;

export default async function CifrasSongEditPage({ params }: PageProps) {
  const { artistSlug, songSlug } = await params;
  return <CifraEditView artistSlug={artistSlug} songSlug={songSlug} />;
}
