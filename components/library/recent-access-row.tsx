import type { RecentAccessItem as RecentAccessItemModel } from "@/lib/library/types";
import { recentThumbClass } from "@/lib/library/style-maps";
import { cn } from "@/lib/utils";

export type RecentAccessRowProps = {
  item: RecentAccessItemModel;
  className?: string;
};

export function RecentAccessRow({ item, className }: RecentAccessRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.07] bg-cifra-surface p-3",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={cn(
            "size-11 shrink-0 rounded-md",
            recentThumbClass[item.thumbTone]
          )}
          aria-hidden
        />
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-[13px] font-semibold text-cifra-text">{item.title}</p>
          <p className="truncate text-[11px] text-cifra-muted">{item.subtitle}</p>
        </div>
      </div>
      <span className="shrink-0 font-mono text-[10px] text-cifra-muted">{item.timeLabel}</span>
    </div>
  );
}
