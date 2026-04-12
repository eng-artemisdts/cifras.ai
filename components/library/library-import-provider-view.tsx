import { AuthMarketingSidebar } from "@/components/layout/auth-marketing-sidebar";
import type { BillingPlan } from "@/lib/billing/plan-types";
import type { StreamingLinkImportConfig } from "@/lib/library/streaming-link-import-config";
import type { LibraryNavItem } from "@/lib/library/types";
import { cn } from "@/lib/utils";

import { ImportStreamingLinkPanel } from "./import-streaming-link-panel";
import { LibraryPageFooter } from "./library-page-footer";
import { LibraryTopNav, type LibraryTopNavUser } from "./library-top-nav";

export type LibraryImportProviderViewProps = {
  config: StreamingLinkImportConfig;
  navItems: LibraryNavItem[];
  user?: LibraryTopNavUser | null;
  billingPlan?: BillingPlan | null;
  /** Origens `requiresPro` desbloqueadas (plano Pro). */
  proEntitled?: boolean;
  className?: string;
};

/**
 * Shell de importação por link (sidebar + nav + painel único parametrizado por `config`).
 */
export function LibraryImportProviderView({
  config,
  navItems,
  user,
  billingPlan,
  proEntitled = false,
  className,
}: LibraryImportProviderViewProps) {
  const { sidebar, panel } = config;

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-cifra-bg text-cifra-text lg:flex-row lg:items-stretch",
        className
      )}
    >
      <AuthMarketingSidebar
        contextLabel="cifra · lab"
        contextUppercase={false}
        titleLine1={sidebar.titleLine1}
        titleLine2={sidebar.titleLine2Gradient}
        titleLine3={sidebar.titleLine3Muted}
        introText={sidebar.introText}
        features={sidebar.features}
        className="hidden min-h-0 shrink-0 lg:flex lg:min-h-dvh"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-dvh lg:border-l lg:border-white/7">
        <LibraryTopNav items={navItems} user={user} billingPlan={billingPlan ?? undefined} />
        <ImportStreamingLinkPanel
          config={panel}
          proEntitled={proEntitled}
          className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-auto px-5 py-1 md:px-8 md:pb-3 md:pt-1"
        />
        <LibraryPageFooter className="mt-0 shrink-0 border-t border-white/7" />
      </div>
    </div>
  );
}
