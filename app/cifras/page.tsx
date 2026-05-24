import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CifraTrackView } from "@/components/cifra/cifra-track-view";
import { cifraHref, resolveCifraSlugPairFromTrack } from "@/lib/cifra/cifra-routes";
import { fetchSchubertTrackByKey } from "@/lib/schubert-fetch-track";

export const metadata: Metadata = {
  title: "Cifra · cifra.ai",
  description: "Pré-visualização sincronizada de letra e acordes.",
};

export default async function CifrasLandingPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ trackId?: string }>;
}>) {
  const sp = await searchParams;
  const trackId = typeof sp.trackId === "string" && sp.trackId.trim() ? sp.trackId.trim() : null;

  if (trackId) {
    const track = await fetchSchubertTrackByKey(trackId);
    const pair = resolveCifraSlugPairFromTrack(track);
    if (pair) {
      redirect(cifraHref(pair.artistSlug, pair.songSlug));
    }
    return <CifraTrackView trackKey={trackId} />;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cifra-bg px-6 text-center text-cifra-text">
      <p className="max-w-md text-sm text-cifra-muted">
        Abra uma cifra pelo caminho{" "}
        <code className="rounded bg-cifra-surface px-1 py-0.5 text-cifra-teal">
          /cifras/slug-do-artista/slug-da-musica
        </code>
        , por exemplo após importar um ficheiro com reconhecimento AudD.
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
