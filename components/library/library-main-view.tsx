"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Music4 } from "lucide-react";

import { catalogTabs } from "@/lib/library/mock-data";
import type { BillingPlan } from "@/lib/billing/plan-types";
import type {
  ArtistSuggestion,
  CatalogTabId,
  LibraryNavItem,
  MusicCatalogCard as MusicCatalogCardModel,
} from "@/lib/library/types";
import { cn } from "@/lib/utils";

import { ArtistSuggestionCard } from "./artist-suggestion-card";
import { CatalogTabBar } from "./catalog-tab-bar";
import { LibraryMainSearchHero } from "./library-main-search-hero";
import { LibraryPageFooter } from "./library-page-footer";
import { LibraryTopNav, type LibraryTopNavUser } from "./library-top-nav";
import { MusicCatalogCard } from "./music-catalog-card";
import { ResultsToolbar } from "./results-toolbar";

export type LibraryMainViewProps = {
  navItems: LibraryNavItem[];
  user?: LibraryTopNavUser | null;
  billingPlan?: BillingPlan | null;
  musicItems: MusicCatalogCardModel[];
  artistItems: ArtistSuggestion[];
  totalItems: number;
  className?: string;
};

/**
 * Página principal da biblioteca (`/biblioteca`): abas, barra de resultados, grid e artistas sugeridos (UI).
 */
export function LibraryMainView({
  navItems,
  user,
  billingPlan,
  musicItems,
  artistItems,
  totalItems,
  className,
}: LibraryMainViewProps) {
  const [activeTab, setActiveTab] = useState<CatalogTabId>("musicas");
  const [musicState, setMusicState] = useState<MusicCatalogCardModel[]>(musicItems);
  const [artistState] = useState<ArtistSuggestion[]>(artistItems);

  const view = useMemo(() => {
    if (activeTab === "artistas") {
      return {
        tracks: [] as MusicCatalogCardModel[],
        artists: artistState,
        total: artistState.length,
      };
    }
    if (activeTab === "musicas") {
      return {
        tracks: musicState,
        artists: [] as ArtistSuggestion[],
        total: musicState.length || totalItems,
      };
    }
    return {
      tracks: [] as MusicCatalogCardModel[],
      artists: [] as ArtistSuggestion[],
      total: 0,
    };
  }, [activeTab, artistState, musicState, totalItems]);

  function handleDeletedVersion(cardId: string) {
    setMusicState((prev) => prev.filter((item) => item.id !== cardId));
  }

  const showMusicEmptyState = activeTab === "musicas" && view.tracks.length === 0;
  const showArtistEmptyState = activeTab === "artistas" && view.artists.length === 0;

  return (
    <div className={cn("flex min-h-dvh flex-col bg-cifra-bg text-cifra-text", className)}>
      <LibraryTopNav items={navItems} user={user} billingPlan={billingPlan ?? undefined} />
      <main className="flex flex-1 flex-col items-center pt-4">
        <LibraryMainSearchHero />
        <CatalogTabBar tabs={catalogTabs} onTabChange={setActiveTab} />
        <ResultsToolbar countLabel={`${view.total} itens`} />
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-6 py-4 md:px-8 md:py-6">
          {activeTab === "musicas" && !showMusicEmptyState ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {view.tracks.map((item) => (
                <MusicCatalogCard key={item.id} item={item} onDeleted={handleDeletedVersion} />
              ))}
            </div>
          ) : null}
          {activeTab === "artistas" && !showArtistEmptyState ? (
            <div className="grid gap-4 md:grid-cols-2">
              {view.artists.map((item) => (
                <ArtistSuggestionCard key={item.id} item={item} />
              ))}
            </div>
          ) : null}
          {showMusicEmptyState || showArtistEmptyState ? (
            <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-3 rounded-2xl border border-white/8 bg-cifra-surface/70 px-6 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-full border border-cifra-teal/30 bg-cifra-teal/10">
                <Music4 className="size-7 text-cifra-teal" strokeWidth={1.7} />
              </div>
              <h2 className="font-serif text-2xl font-normal text-cifra-text">
                Seu palco está silencioso... por enquanto.
              </h2>
              <p className="max-w-[420px] text-sm leading-relaxed text-cifra-muted">
                Salve suas cifras favoritas ou crie sua primeira versão para transformar este espaço no seu repertório
                definitivo.
              </p>
              <Link
                href="/biblioteca/importar"
                className="mt-1 inline-flex items-center rounded-lg bg-cifra-teal px-4 py-2.5 text-xs font-semibold text-cifra-bg transition-opacity hover:opacity-95"
              >
                Importar primeira música
              </Link>
            </div>
          ) : null}
          {activeTab !== "musicas" && activeTab !== "artistas" ? (
            <p className="py-10 text-center text-xs text-cifra-muted">
              Ainda não há itens nesta aba.
            </p>
          ) : null}
        </div>
      </main>
      <LibraryPageFooter />
    </div>
  );
}
