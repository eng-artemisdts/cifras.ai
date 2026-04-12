import Link from "next/link";

import LightRays from "@/components/LightRays";
import { recentAccessItems, recommendationTiles } from "@/lib/library/mock-data";
import type { BillingPlan } from "@/lib/billing/plan-types";
import type { LibraryNavItem } from "@/lib/library/types";
import { cn } from "@/lib/utils";

import { LibraryPageFooter } from "./library-page-footer";
import { LibrarySearchHero } from "./library-search-hero";
import { LibraryTopNav, type LibraryTopNavUser } from "./library-top-nav";
import { RecentAccessSection } from "./recent-access-section";
import { RecommendationsSection } from "./recommendations-section";

export type LibraryHomeViewProps = {
  navItems: LibraryNavItem[];
  user?: LibraryTopNavUser | null;
  billingPlan?: BillingPlan | null;
  className?: string;
};

/**
 * Início da biblioteca: busca, recomendações e últimos acessos.
 * Catálogo completo (abas + resultados + grid) em `/biblioteca/resultados`.
 */
export function LibraryHomeView({ navItems, user, billingPlan, className }: LibraryHomeViewProps) {
  return (
    <div className={cn("flex min-h-dvh flex-col bg-cifra-bg text-cifra-text", className)}>
      <LibraryTopNav items={navItems} user={user} billingPlan={billingPlan ?? undefined} />
      <main className="relative flex flex-1 flex-col items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0 min-h-full">
          <LightRays
            raysOrigin="top-center"
            raysColor="#0fd2c1"
            raysSpeed={0.85}
            lightSpread={0.9}
            rayLength={1.85}
            fadeDistance={1.05}
            saturation={0.92}
            mouseInfluence={0.08}
            className="min-h-full"
          />
        </div>
        <div
          className="pointer-events-none absolute inset-0 z-1 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -20%, var(--cifra-glow) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 100% 0%, rgba(28, 31, 62, 0.5) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 flex w-full flex-col items-center">
          <LibrarySearchHero />
          <RecommendationsSection items={recommendationTiles} />
          <RecentAccessSection items={recentAccessItems} />
          <div className="mx-auto w-full max-w-[1200px] px-6 pb-10 pt-4 md:px-8">
            <Link
              href="/biblioteca/resultados"
              className="inline-flex items-center justify-center rounded-xl border border-white/[0.07] bg-cifra-surface px-5 py-3 text-sm font-semibold text-cifra-text transition-colors hover:border-cifra-teal/40 hover:text-cifra-teal"
            >
              Ver catálogo e resultados
            </Link>
          </div>
        </div>
      </main>
      <LibraryPageFooter />
    </div>
  );
}
