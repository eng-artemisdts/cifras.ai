import type { Metadata } from "next";

import { LibraryImportStreamingView } from "@/components/library/library-import-streaming-view";
import { getAuth0SessionCached } from "@/lib/auth0";
import { libraryNavForPath } from "@/lib/library/mock-data";

export const metadata: Metadata = {
  title: "Importar música · Biblioteca · cifra.ai",
  description:
    "Importe faixas do YouTube, Spotify e outras origens. Reels e TikTok no plano Pro.",
};

export default async function BibliotecaImportarPage() {
  const session = await getAuth0SessionCached();
  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        picture: session.user.picture ?? null,
      }
    : null;

  return (
    <LibraryImportStreamingView navItems={libraryNavForPath("/biblioteca/importar")} user={user} />
  );
}
