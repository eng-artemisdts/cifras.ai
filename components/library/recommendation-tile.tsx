import type { RecommendationTile as RecommendationTileModel } from "@/lib/library/types";
import { recommendationCoverClass } from "@/lib/library/style-maps";
import { cn } from "@/lib/utils";

export type RecommendationTileProps = {
  item: RecommendationTileModel;
  className?: string;
};

export function RecommendationTile({ item, className }: RecommendationTileProps) {
  return (
    <article
      className={cn(
        "flex min-w-[140px] flex-1 flex-col gap-2 rounded-[10px] border border-white/[0.07] bg-cifra-surface p-3 sm:min-w-[160px]",
        className
      )}
    >
      <div
        className={cn(
          "h-[88px] w-full shrink-0 rounded-md",
          recommendationCoverClass[item.coverTone]
        )}
        aria-hidden
      />
      <div className="min-w-0 space-y-0.5">
        <h3 className="truncate text-[13px] font-semibold text-cifra-text">{item.title}</h3>
        <p className="truncate text-[11px] text-cifra-muted">{item.subtitle}</p>
      </div>
    </article>
  );
}
