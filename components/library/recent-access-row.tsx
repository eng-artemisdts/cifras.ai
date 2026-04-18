"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { RecentAccessItem as RecentAccessItemModel } from "@/lib/library/types";
import { recentThumbClass } from "@/lib/library/style-maps";
import { cn } from "@/lib/utils";

export type RecentAccessRowProps = {
  item: RecentAccessItemModel;
  className?: string;
};

const hoverRow =
  "cursor-pointer transition-all duration-200 ease-out hover:-translate-y-px hover:border-cifra-teal/40 hover:bg-white/[0.04] hover:shadow-[0_12px_32px_rgba(0,0,0,0.22)] active:translate-y-0";

export function RecentAccessRow({ item, className }: RecentAccessRowProps) {
  const rawUrl = item.coverImageUrl?.trim();
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(rawUrl) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [rawUrl]);

  const shellClass = cn(
    "flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.07] bg-cifra-surface p-3",
    item.href ? hoverRow : "",
    className,
  );

  const body = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative size-11 shrink-0 overflow-hidden rounded-md">
          <div
            className={cn("absolute inset-0", recentThumbClass[item.thumbTone])}
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
          <p className="truncate text-[13px] font-semibold text-cifra-text">{item.title}</p>
          <p className="truncate text-[11px] text-cifra-muted">{item.subtitle}</p>
        </div>
      </div>
      <span className="shrink-0 font-mono text-[10px] text-cifra-muted">{item.timeLabel}</span>
    </>
  );

  if (item.href) {
    return (
      <Link href={item.href} className={shellClass}>
        {body}
      </Link>
    );
  }

  return <div className={shellClass}>{body}</div>;
}
