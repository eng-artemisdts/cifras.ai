import type { Metadata } from "next";
import Link from "next/link";

import { CifraTrackView } from "@/components/cifra/cifra-track-view";

export const metadata: Metadata = {
  title: "Cifra · cifra.ai",
  description: "Pré-visualização sincronizada de letra e acordes.",
};

export default async function CifraPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ trackId?: string }>;
}>) {
  const sp = await searchParams;
  const trackId = typeof sp.trackId === "string" && sp.trackId.trim() ? sp.trackId.trim() : null;

  if (trackId) {
    return <CifraTrackView trackId={trackId} />;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cifra-bg px-6 text-center text-cifra-text">
      <p className="max-w-md text-sm text-cifra-muted">
        Indique uma faixa na URL, por exemplo{" "}
        <code className="rounded bg-cifra-surface px-1 py-0.5 text-cifra-teal">
          /cifra?trackId=all_i_need
        </code>
        . A origem da letra (IA ou match) vem dos dados da faixa.
      </p>
      <Link
        href="/biblioteca/importar/arquivo"
        className="text-sm font-semibold text-cifra-teal hover:text-cifra-teal-hover"
      >
        Voltar à importação por ficheiro
      </Link>
    </div>
  );
}
