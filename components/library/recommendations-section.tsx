import type { RecommendationTile as RecommendationTileModel } from "@/lib/library/types";
import { cn } from "@/lib/utils";

import { RecommendationTile } from "./recommendation-tile";

export type RecommendationsSectionProps = {
  title?: string;
  subtitle?: string;
  items: RecommendationTileModel[];
  className?: string;
};

export function RecommendationsSection({
  title = "Recomendados para você",
  subtitle = "Mix semanal · curadoria cifra.ai",
  items,
  className,
}: RecommendationsSectionProps) {
  return (
    <section className={cn("w-full px-6 py-2 md:px-8", className)}>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-serif text-lg font-normal text-cifra-text">{title}</h2>
          <p className="font-mono text-[10px] text-cifra-muted">{subtitle}</p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <RecommendationTile key={item.id} item={item} className="max-w-[200px]" />
          ))}
        </div>
      </div>
    </section>
  );
}
