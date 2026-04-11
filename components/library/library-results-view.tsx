import { artistSuggestions, catalogTabs, musicCatalogCards } from "@/lib/library/mock-data";
import type { LibraryNavItem } from "@/lib/library/types";
import { cn } from "@/lib/utils";

import { ArtistSuggestionCard } from "./artist-suggestion-card";
import { CatalogTabBar } from "./catalog-tab-bar";
import { LibraryPageFooter } from "./library-page-footer";
import { LibraryTopNav, type LibraryTopNavUser } from "./library-top-nav";
import { MusicCatalogCard } from "./music-catalog-card";
import { ResultsToolbar } from "./results-toolbar";

export type LibraryResultsViewProps = {
  navItems: LibraryNavItem[];
  user?: LibraryTopNavUser | null;
  className?: string;
};

/**
 * Página única de catálogo: abas, barra de resultados, grid de músicas e artistas sugeridos (só UI).
 */
export function LibraryResultsView({ navItems, user, className }: LibraryResultsViewProps) {
  return (
    <div className={cn("flex min-h-dvh flex-col bg-cifra-bg text-cifra-text", className)}>
      <LibraryTopNav items={navItems} user={user} />
      <main className="flex flex-1 flex-col items-center pt-4">
        <CatalogTabBar tabs={catalogTabs} />
        <ResultsToolbar />
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-6 py-4 md:px-8 md:py-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {musicCatalogCards.map((item) => (
              <MusicCatalogCard key={item.id} item={item} />
            ))}
          </div>
          <h2 className="pt-2 text-xs font-semibold text-cifra-text">Artistas sugeridos</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {artistSuggestions.map((item) => (
              <ArtistSuggestionCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </main>
      <LibraryPageFooter />
    </div>
  );
}
