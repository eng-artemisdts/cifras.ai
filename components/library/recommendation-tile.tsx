"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { RecommendationTile as RecommendationTileModel } from "@/lib/library/types";
import { recommendationCoverClass } from "@/lib/library/style-maps";
import { cn } from "@/lib/utils";

export type RecommendationTileProps = {
  item: RecommendationTileModel;
  className?: string;
};

const hoverCard =
  "relative z-0 cursor-pointer transition-all duration-200 ease-out hover:z-20 hover:-translate-y-1 hover:border-cifra-teal/45 hover:shadow-[0_16px_42px_rgba(0,0,0,0.32)] active:translate-y-0 active:shadow-none";

export function RecommendationTile({ item, className }: RecommendationTileProps) {
  const rawUrl = item.coverImageUrl?.trim();
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(rawUrl) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [rawUrl]);

  const shellClass = cn(
    "flex min-w-[140px] flex-1 flex-col gap-2 rounded-[10px] border border-white/[0.07] bg-cifra-surface p-3 sm:min-w-[160px]",
    item.href ? hoverCard : "",
    className,
  );

  const body = (
    <>
      <div className="relative h-[88px] w-full shrink-0 overflow-hidden rounded-md">
        <div
          className={cn("absolute inset-0", recommendationCoverClass[item.coverTone])}
          aria-hidden
        />
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL dinâmica Schubert / catálogo
          <img
            src={rawUrl}
            alt=""
            className="relative z-1 size-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : null}
      </div>
      <div className="min-w-0 space-y-0.5">
        <h3 className="truncate text-[13px] font-semibold text-cifra-text">{item.title}</h3>
        <p className="truncate text-[11px] text-cifra-muted">{item.subtitle}</p>
      </div>
    </>
  );

  if (item.href) {
    return (
      <Link href={item.href} className={shellClass}>
        {body}
      </Link>
    );
  }

  return <article className={shellClass}>{body}</article>;
}
