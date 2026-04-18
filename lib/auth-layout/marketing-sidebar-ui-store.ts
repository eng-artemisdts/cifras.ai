"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type MarketingSidebarUiState = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
};

export const useMarketingSidebarUiStore = create<MarketingSidebarUiState>()(
  persist(
    (set) => ({
      collapsed: false,
      setCollapsed: (collapsed) => set({ collapsed }),
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    {
      name: "cifra-marketing-sidebar-ui",
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") return localStorage;
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({ collapsed: state.collapsed }),
      skipHydration: true,
    },
  ),
);
