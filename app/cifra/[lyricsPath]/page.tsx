import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CifraTrackView } from "@/components/cifra/cifra-track-view";
import { isCifraLyricsPath } from "@/lib/cifra/cifra-routes";

export const metadata: Metadata = {
  title: "Cifra · cifra.ai",
  description: "Pré-visualização sincronizada de letra e acordes.",
};

type PageProps = Readonly<{
  params: Promise<{ lyricsPath: string }>;
  searchParams: Promise<{ trackId?: string }>;
}>;

export default async function CifraLyricsPage({ params, searchParams }: PageProps) {
  const { lyricsPath: raw } = await params;
  if (!isCifraLyricsPath(raw)) {
    notFound();
  }
  const lyricsPath = raw;
  const sp = await searchParams;
  const trackId = typeof sp.trackId === "string" && sp.trackId.trim() ? sp.trackId.trim() : null;

  if (!trackId) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cifra-bg px-6 text-center text-cifra-text">
        <p className="max-w-md text-sm text-cifra-muted">
          Indique uma faixa na URL, por exemplo{" "}
          <code className="rounded bg-cifra-surface px-1 py-0.5 text-cifra-teal">
            ?trackId=all_i_need
          </code>
          . Use{" "}
          <code className="rounded bg-cifra-surface px-1 py-0.5 text-cifra-teal">/a/</code> para letra IA ou{" "}
          <code className="rounded bg-cifra-surface px-1 py-0.5 text-cifra-teal">/m/</code> para letra match.
        </p>
      </div>
    );
  }

  const lyricsVariant = lyricsPath === "m" ? "match" : "ai";

  return (
    <CifraTrackView trackId={trackId} lyricsVariant={lyricsVariant} lyricsPath={lyricsPath} />
  );
}
