"use client";

import Link from "next/link";
import { Music2 } from "lucide-react";
import { useEffect, useState } from "react";

import { GA_EVENTS } from "@/lib/analytics/events";
import { trackAnalyticsEvent } from "@/lib/analytics/track";
import type { LibrarySearchTrackRow } from "@/lib/library/beethoven-library-search";
import { libraryTrackCifraHref } from "@/lib/library/search-track-nav";
import { cn } from "@/lib/utils";

export type LibrarySearchTrackRowProps = {
  track: LibrarySearchTrackRow;
  toneIndex: number;
  className?: string;
  compact?: boolean;
  /** Contexto da lista (quick vs full, explorar vs biblioteca). */
  analyticsListSurface?: string;
};

/** Alinhado a `DialogCoverArt` em `chord-found-access-dialog.tsx`: imagem ou ícone Music2 em fundo escuro. */
export function LibrarySearchTrackRow({
  track,
  toneIndex: _toneIndex,
  className,
  compact,
  analyticsListSurface,
}: LibrarySearchTrackRowProps) {
  const href = libraryTrackCifraHref(track.trackKey);
  const rawUrl = track.imageUrl?.trim();
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(rawUrl) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [rawUrl]);

  const thumb = (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg border border-white/[0.07]",
        compact ? "size-12" : "size-14 sm:size-16",
      )}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- URLs dinâmicas (Schubert / catálogo)
        <img
          src={rawUrl}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-[#0c0c16]" aria-hidden>
          <Music2
            className={cn("text-cifra-muted/45", compact ? "size-5" : "size-6")}
            strokeWidth={1.35}
          />
        </div>
      )}
    </div>
  );

  const text = (
    <div className="min-w-0 flex-1 text-left">
      <p
        className={cn(
          "truncate font-semibold text-cifra-text",
          compact ? "text-[13px]" : "text-sm",
        )}
      >
        {track.name}
      </p>
      <p className={cn("truncate text-cifra-muted", compact ? "text-[11px]" : "text-xs")}>
        {track.artistName}
      </p>
    </div>
  );

  const rowClass = cn(
    "flex items-center gap-3 rounded-xl border border-white/[0.06] bg-cifra-surface/80 p-3 transition-colors",
    href ? "hover:border-cifra-teal/35 hover:bg-cifra-surface" : "opacity-90",
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        className={rowClass}
        onClick={() =>
          trackAnalyticsEvent(GA_EVENTS.LIBRARY_TRACK_OPEN, {
            list_surface: analyticsListSurface ?? "unknown",
          })
        }
      >
        {thumb}
        {text}
      </Link>
    );
  }

  return (
    <div className={rowClass}>
      {thumb}
      {text}
    </div>
  );
}
