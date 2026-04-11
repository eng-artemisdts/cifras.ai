"use client";

import { useCallback, useState } from "react";

import type { CatalogTab, CatalogTabId } from "@/lib/library/types";
import { cn } from "@/lib/utils";

export type CatalogTabBarProps = {
  tabs: CatalogTab[];
  defaultTab?: CatalogTabId;
  /** Opcional: notificar mudança (ex.: analytics). */
  onTabChange?: (id: CatalogTabId) => void;
  className?: string;
};

/**
 * Abas Músicas / Artistas / … (só estado local para UI).
 */
export function CatalogTabBar({
  tabs,
  defaultTab = "musicas",
  onTabChange,
  className,
}: CatalogTabBarProps) {
  const [active, setActive] = useState<CatalogTabId>(defaultTab);

  const select = useCallback(
    (id: CatalogTabId) => {
      setActive(id);
      onTabChange?.(id);
    },
    [onTabChange]
  );

  return (
    <div className={cn("flex w-full flex-wrap gap-2 px-6 py-2 md:px-8", className)} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => select(tab.id)}
            className={cn(
              "rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors",
              isActive
                ? "border-cifra-teal/27 bg-cifra-surface-2 text-cifra-text"
                : "border-white/[0.07] bg-transparent font-normal text-cifra-muted hover:border-white/15 hover:text-cifra-text"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
