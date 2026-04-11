import type { MusicCatalogCard as MusicCatalogCardModel } from "@/lib/library/types";
import { musicCoverClass } from "@/lib/library/style-maps";
import { cn } from "@/lib/utils";

export type MusicCatalogCardProps = {
  item: MusicCatalogCardModel;
  className?: string;
};

const tagStyles = {
  teal: "border-cifra-teal/20 bg-cifra-teal/12 text-cifra-teal",
  amber: "border-cifra-gold/20 bg-cifra-gold/12 text-cifra-gold",
} as const;

export function MusicCatalogCard({ item, className }: MusicCatalogCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border border-white/[0.07] bg-cifra-surface p-3.5",
        className
      )}
    >
      <div
        className={cn("h-[120px] w-full rounded-lg", musicCoverClass[item.coverTone])}
        aria-hidden
      />
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-cifra-text">{item.title}</h3>
        <p className="text-xs text-cifra-muted">{item.subtitle}</p>
      </div>
      <span
        className={cn(
          "inline-flex w-fit rounded px-2 py-0.5 font-mono text-[9px] font-normal",
          tagStyles[item.tagVariant]
        )}
      >
        {item.tagLabel}
      </span>
    </article>
  );
}
