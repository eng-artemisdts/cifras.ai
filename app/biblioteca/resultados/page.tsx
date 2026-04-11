import type { Metadata } from "next";

import { LibraryResultsView } from "@/components/library/library-results-view";
import { getAuth0SessionCached } from "@/lib/auth0";
import { libraryNavForPath } from "@/lib/library/mock-data";

export const metadata: Metadata = {
  title: "Resultados · Biblioteca · cifra.ai",
  description: "Navegue por músicas, artistas, álbuns e playlists.",
};

export default async function BibliotecaResultadosPage() {
  const session = await getAuth0SessionCached();
  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        picture: session.user.picture ?? null,
      }
    : null;

  return <LibraryResultsView navItems={libraryNavForPath("/biblioteca/resultados")} user={user} />;
}
