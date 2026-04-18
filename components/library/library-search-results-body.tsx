"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import {
  fetchLibrarySearch,
  type LibrarySearchResponse,
} from "@/lib/library/beethoven-library-search";
import { enrichLibrarySearchRowsWithSchubertCovers } from "@/lib/library/enrich-library-search-schubert-covers";
import { cn } from "@/lib/utils";

import { LibrarySearchTrackRow } from "./library-search-track-row";

const PAGE_SIZE = 12;

export function LibrarySearchResultsBody() {
  const searchParams = useSearchParams();
  const search = searchParams.get("search")?.trim() ?? "";
  const pageRaw = searchParams.get("page");
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);

  const [data, setData] = useState<LibrarySearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (search.length < 2) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchLibrarySearch({ search, page, limit: PAGE_SIZE })
      .then(async (res) => {
        if (cancelled) return;
        const items = await enrichLibrarySearchRowsWithSchubertCovers(res.items);
        if (cancelled) return;
        setData({ ...res, items });
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível carregar os resultados.");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, page]);

  function buildPageHref(p: number) {
    const q = new URLSearchParams();
    q.set("search", search);
    if (p > 1) q.set("page", String(p));
    return `/explorar/busca?${q.toString()}`;
  }

  const prevHref = page > 1 ? buildPageHref(page - 1) : null;
  const nextHref =
    data && data.totalPages > 0 && page < data.totalPages ? buildPageHref(page + 1) : null;

  if (search.length < 2) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-6 py-16 text-center md:px-8">
        <p className="text-sm text-cifra-muted">
          Indique pelo menos 2 caracteres na URL, por exemplo{" "}
          <Link
            href="/explorar/busca?search=música"
            className="text-cifra-teal underline-offset-2 hover:underline"
          >
            /explorar/busca?search=…
          </Link>
          , ou volte a{" "}
          <Link href="/explorar" className="text-cifra-teal underline-offset-2 hover:underline">
            Explorar
          </Link>{" "}
          para pesquisar.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-6 py-10 md:px-8">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-normal text-cifra-text">Resultados da busca</h1>
        <p className="text-xs text-cifra-muted">
          Termo: <span className="text-cifra-text/90">«{search}»</span>
          {data ? (
            <>
              {" "}
              · {data.total} {data.total === 1 ? "faixa" : "faixas"}
            </>
          ) : null}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-cifra-muted">Carregando…</p>
      ) : error ? (
        <p className="text-sm text-red-300/90">{error}</p>
      ) : data && data.items.length === 0 ? (
        <p className="text-sm text-cifra-muted">Nenhum resultado encontrado.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data?.items.map((track, index) => (
            <li key={track.id}>
              <LibrarySearchTrackRow track={track} toneIndex={index} />
            </li>
          ))}
        </ul>
      )}

      {data && data.totalPages > 1 ? (
        <nav
          className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-6"
          aria-label="Paginação"
        >
          <Link
            href={prevHref ?? "#"}
            aria-disabled={!prevHref}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-2 text-xs font-medium text-cifra-text transition-colors",
              prevHref
                ? "hover:border-cifra-teal/40 hover:text-cifra-teal"
                : "pointer-events-none opacity-35",
            )}
          >
            <ChevronLeft className="size-4" strokeWidth={2} aria-hidden />
            Anterior
          </Link>
          <span className="font-mono text-[11px] text-cifra-muted">
            Página {page} de {data.totalPages}
          </span>
          <Link
            href={nextHref ?? "#"}
            aria-disabled={!nextHref}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-2 text-xs font-medium text-cifra-text transition-colors",
              nextHref
                ? "hover:border-cifra-teal/40 hover:text-cifra-teal"
                : "pointer-events-none opacity-35",
            )}
          >
            Próximo
            <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
