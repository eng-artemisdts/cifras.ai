import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";

import { LibraryMainView } from "@/components/library/library-main-view";
import { getAuth0SessionCached } from "@/lib/auth0";
import { resolveBillingPlanForSessionUser } from "@/lib/billing/resolve-billing-plan";
import { fetchLibraryCatalog } from "@/lib/library/beethoven-library-catalog";
import { libraryNavForPath } from "@/lib/library/mock-data";

export const metadata: Metadata = {
  title: "Biblioteca · cifra.ai",
  description: "Navegue por músicas, artistas, álbuns e playlists.",
};

export default async function BibliotecaPage() {
  const session = await getAuth0SessionCached();
  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        picture: session.user.picture ?? null,
      }
    : null;

  const billingPlan = await resolveBillingPlanForSessionUser(session?.user ?? null);
  /**
   * `fetchBeethovenFromServer` lança `redirect('/auth/logout')` quando detecta sessão Auth0
   * expirada (401 + `code: session_expired`). `unstable_rethrow` mantém o `NEXT_REDIRECT` a
   * propagar; falhas reais caem para o estado vazio sem partir a página.
   */
  const onLibraryCatalogError = (err: unknown) => {
    unstable_rethrow(err);
    return { tracks: [], artists: [], total: 0 };
  };
  const [musicCatalog, artistCatalog] = await Promise.all([
    fetchLibraryCatalog({ userId: session?.user?.sub, tab: "musicas", limit: 150 }).catch(
      onLibraryCatalogError,
    ),
    fetchLibraryCatalog({ userId: session?.user?.sub, tab: "artistas", limit: 150 }).catch(
      onLibraryCatalogError,
    ),
  ]);

  return (
    <LibraryMainView
      navItems={libraryNavForPath("/biblioteca")}
      user={user}
      billingPlan={billingPlan}
      musicItems={musicCatalog.tracks}
      artistItems={artistCatalog.artists}
      totalItems={musicCatalog.total}
    />
  );
}
