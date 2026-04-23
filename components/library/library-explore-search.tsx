"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { LottieLoadingMark } from "@/components/cifra/cifra-route-loading";
import { Popover, PopoverContent } from "@/components/ui/popover";
import {
  fetchLibrarySearch,
  type LibrarySearchTrackRow,
} from "@/lib/library/beethoven-library-search";
import { enrichLibrarySearchRowsWithSchubertCovers } from "@/lib/library/enrich-library-search-schubert-covers";
import { cn } from "@/lib/utils";

import { LibrarySearchTrackRow as LibrarySearchTrackRowUi } from "./library-search-track-row";

export type LibraryExploreSearchProps = {
  placeholder?: string;
  resultsBasePath?: string;
  className?: string;
};

export function LibraryExploreSearch({
  placeholder = "Buscar faixas, artistas, álbuns…",
  resultsBasePath = "/explorar/busca",
  className,
}: LibraryExploreSearchProps) {
  const router = useRouter();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LibrarySearchTrackRow[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userDismissed, setUserDismissed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 380);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setUserDismissed(false);
  }, [debounced]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setItems([]);
      setLoading(false);
      setFetchError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    fetchLibrarySearch({ search: q, page: 1, limit: 4 })
      .then(async (res) => {
        if (cancelled) return;
        const withCovers = await enrichLibrarySearchRowsWithSchubertCovers(res.items);
        if (cancelled) return;
        setItems(withCovers);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchError("Não foi possível carregar agora. Tente de novo.");
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const trimmed = query.trim();
  const eligible = debounced.trim().length >= 2;
  const popoverOpen = eligible && !userDismissed;
  const resultsHref =
    trimmed.length >= 2
      ? `${resultsBasePath}?search=${encodeURIComponent(trimmed)}`
      : resultsBasePath;

  function goToFullResults() {
    if (trimmed.length < 2) return;
    setUserDismissed(true);
    router.push(resultsHref);
  }

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={(next) => {
        if (!next) setUserDismissed(true);
      }}
      modal={false}
    >
      <div className={cn("relative mt-2 w-full max-w-[720px]", className)}>
        <form
          className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-stretch"
          onSubmit={(e) => {
            e.preventDefault();
            goToFullResults();
          }}
        >
          <div
            ref={anchorRef}
            className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-[10px] border border-white/[0.07] bg-cifra-surface-2 px-4 py-2.5"
          >
            <Search className="size-[18px] shrink-0 text-cifra-muted" strokeWidth={1.75} />
            <input
              type="search"
              name="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setUserDismissed(false)}
              placeholder={placeholder}
              className="min-w-0 flex-1 bg-transparent text-sm text-cifra-text placeholder:text-[#6b6b8a] outline-none"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={popoverOpen}
              aria-controls="library-explore-quick-results"
            />
          </div>
          <button
            type="submit"
            disabled={trimmed.length < 2}
            className="h-12 shrink-0 rounded-[10px] bg-cifra-teal px-5 text-[13px] font-semibold text-cifra-bg transition-opacity hover:opacity-95 disabled:pointer-events-none disabled:opacity-40 sm:h-auto sm:px-6"
          >
            Buscar
          </button>
        </form>

        <PopoverContent
          anchor={anchorRef}
          align="start"
          side="bottom"
          sideOffset={10}
          id="library-explore-quick-results"
          initialFocus={false}
          className="w-[min(100vw-3rem,720px)] max-w-[720px] gap-0 p-0 sm:w-[min(100vw-4rem,720px)]"
          role="region"
          aria-label="Sugestões de busca"
        >
          <div className="max-h-[min(52dvh,380px)] overflow-y-auto px-4 py-3">
            {loading ? (
              <div
                className="flex justify-center py-8"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <LottieLoadingMark className="mx-auto size-28 sm:size-32" />
              </div>
            ) : fetchError ? (
              <p className="py-5 text-center text-xs text-red-300/90">{fetchError}</p>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-xs text-cifra-muted">
                Nenhuma faixa encontrada para «{debounced.trim()}». Tente outros termos, use Buscar ou{" "}
                <Link href="/biblioteca/importar" className="font-semibold text-cifra-teal hover:text-cifra-teal-hover">
                  importe a música
                </Link>
                .
              </p>
            ) : (
              <ul className="flex flex-col gap-2" role="list">
                {items.map((track, index) => (
                  <li key={track.id}>
                    <LibrarySearchTrackRowUi track={track} toneIndex={index} compact />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PopoverContent>
      </div>
    </Popover>
  );
}
