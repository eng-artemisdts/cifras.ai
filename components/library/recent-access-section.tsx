import Link from "next/link";

import type { RecentAccessItem as RecentAccessItemModel } from "@/lib/library/types";
import { cn } from "@/lib/utils";

import { RecentAccessRow } from "./recent-access-row";

export type RecentAccessSectionProps = {
  title?: string;
  historyHref?: string;
  historyLabel?: string;
  items: RecentAccessItemModel[];
  className?: string;
};

export function RecentAccessSection({
  title = "Últimos acessos",
  historyHref = "#",
  historyLabel = "Ver histórico",
  items,
  className,
}: RecentAccessSectionProps) {
  return (
    <section className={cn("w-full px-6 py-1 md:px-8", className)}>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-normal text-cifra-text">{title}</h2>
          <Link
            href={historyHref}
            className="text-xs font-medium text-cifra-teal transition-colors hover:text-cifra-teal-hover"
          >
            {historyLabel}
          </Link>
        </div>
        <ul className="flex flex-col gap-2.5" aria-label={title}>
          {items.map((item) => (
            <li key={item.id}>
              <RecentAccessRow item={item} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
