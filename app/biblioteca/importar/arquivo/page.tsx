import type { Metadata } from "next";

import { LibraryImportAudioUploadView } from "@/components/library/library-import-audio-upload-view";
import { getAuth0SessionCached } from "@/lib/auth0";
import { resolveBillingPlanForSessionUser } from "@/lib/billing/resolve-billing-plan";
import { libraryNavForPath } from "@/lib/library/mock-data";
import { fetchSchubertTrackByKey } from "@/lib/schubert-fetch-track";

export const metadata: Metadata = {
  title: "Enviar áudio · Importar música · cifra.ai",
  description:
    "Carregue um arquivo MP3, WAV ou M4A para detecção de cifra. Máximo 50 MB.",
};

type PageProps = {
  searchParams?: Promise<{ baseTrackId?: string | string[]; fromSpotify?: string | string[] }>;
};

export default async function BibliotecaImportarArquivoPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const rawBaseTrackId = Array.isArray(sp.baseTrackId) ? sp.baseTrackId[0] : sp.baseTrackId;
  const baseTrackId = typeof rawBaseTrackId === "string" ? rawBaseTrackId.trim() : "";
  const rawFromSpotify = Array.isArray(sp.fromSpotify) ? sp.fromSpotify[0] : sp.fromSpotify;
  const fromSpotifyImport =
    rawFromSpotify === "1" || rawFromSpotify === "true" || rawFromSpotify === "yes";
  const session = await getAuth0SessionCached();
  const user = session?.user
    ? {
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      picture: session.user.picture ?? null,
    }
    : null;

  const billingPlan = await resolveBillingPlanForSessionUser(session?.user ?? null);
  const initialVariationBaseTrack = baseTrackId ? await fetchSchubertTrackByKey(baseTrackId).catch(() => null) : null;

  return (
    <LibraryImportAudioUploadView
      navItems={libraryNavForPath("/biblioteca/importar/arquivo")}
      user={user}
      billingPlan={billingPlan}
      initialVariationBaseTrackId={baseTrackId || null}
      initialVariationBaseTrack={initialVariationBaseTrack}
      fromSpotifyImport={fromSpotifyImport}
    />
  );
}
