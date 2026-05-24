import { AuthMarketingSidebar } from "@/components/layout/auth-marketing-sidebar";
import type { BillingPlan } from "@/lib/billing/plan-types";
import type { AuthSidebarFeature } from "@/lib/auth-layout/types";
import type { LibraryNavItem } from "@/lib/library/types";
import { cn } from "@/lib/utils";

import { LibraryPageFooter } from "./library-page-footer";
import { LibraryTopNav, type LibraryTopNavUser } from "./library-top-nav";
import { StreamingImportRightPanel } from "./streaming-import-right-panel";

export type LibraryImportStreamingViewProps = {
  navItems: LibraryNavItem[];
  user?: LibraryTopNavUser | null;
  billingPlan: BillingPlan;
  proStreamingUnlocked: boolean;
  className?: string;
};

/** Passos da importação no mesmo formato da sidebar de login (`AuthMarketingSidebar`). */
const importStreamingSidebarFeatures: AuthSidebarFeature[] = [
  {
    title: "01  Origem",
    description: "YouTube · Spotify · Pro: Reels e TikTok",
    accent: "teal",
  },
  {
    title: "02  Captura",
    description: "Link ou arquivo de áudio",
    accent: "muted",
  },
  {
    title: "03  IA analisa",
    description: "Acordes sugeridos",
    accent: "muted",
  },
];

const importStreamingIntro =
  "Selecione YouTube, Spotify, TikTok ou Instagram Reels. Na próxima etapa você cola o link ou segue com arquivo do disco.";

/**
 * Importar do streaming: sidebar reutiliza `AuthMarketingSidebar` (login);
 * cabeçalho e painel ficam na coluna à direita (frame EB4ZS no Pencil).
 */
export function LibraryImportStreamingView({
  navItems,
  user,
  billingPlan,
  proStreamingUnlocked,
  className,
}: LibraryImportStreamingViewProps) {
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
        showBrandCaption={false}
        titleLine1="Importar"
        titleLine2="música"
        titleLine3="do streaming"
        introText={importStreamingIntro}
        features={importStreamingSidebarFeatures}
        className="hidden min-h-0 shrink-0 lg:flex lg:min-h-dvh"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-dvh lg:border-l lg:border-white/7">
        <LibraryTopNav items={navItems} user={user} billingPlan={billingPlan} />
        <StreamingImportRightPanel
          proStreamingUnlocked={proStreamingUnlocked}
          className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-auto px-5 py-1 md:px-8 md:pb-3 md:pt-1"
        />
        <LibraryPageFooter className="mt-0 shrink-0 border-t border-white/7" />
      </div>
    </div>
  );
}
