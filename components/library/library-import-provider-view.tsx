import { AuthMarketingSidebar } from "@/components/layout/auth-marketing-sidebar";
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
  className?: string;
};

/**
 * Shell de importação por link (sidebar + nav + painel único parametrizado por `config`).
 */
export function LibraryImportProviderView({
  config,
  navItems,
  user,
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
        className="min-h-0 border-b border-white/7 lg:min-h-dvh lg:border-b-0"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-white/6 lg:min-h-dvh lg:border-t-0 lg:border-l lg:border-white/7">
        <LibraryTopNav items={navItems} user={user} />
        <ImportStreamingLinkPanel config={panel} className="min-h-0 flex-1 overflow-auto px-6 py-1.5 md:px-10 md:pb-4 md:pt-1.5" />
        <LibraryPageFooter className="mt-0 shrink-0 border-t border-white/7" />
      </div>
    </div>
  );
}
