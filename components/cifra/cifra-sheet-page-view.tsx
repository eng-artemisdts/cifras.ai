import type { ReactNode } from "react";

import type { AuthMarketingSidebarProps } from "@/components/layout/auth-marketing-sidebar";
import { AuthMarketingSidebar } from "@/components/layout/auth-marketing-sidebar";
import type { BillingPlan } from "@/lib/billing/plan-types";
import {
  bibliotecaCifraSheetMarketingSidebar,
} from "@/lib/library/cifra-sheet-marketing";

export { bibliotecaCifraSheetMarketingSidebar } from "@/lib/library/cifra-sheet-marketing";

import type { MusicAiDemoPayload } from "@/lib/cifra/musicai-types";

import { CifraCenterChrome } from "./cifra-center-chrome";
import { CifraPocMount } from "./cifra-poc-mount";
import type { LibraryTopNavUser } from "@/components/library/library-top-nav";

export type CifraSheetPageViewProps = {
  user?: LibraryTopNavUser | null;
  billingPlan?: BillingPlan | null;
  trackKey: string;
  libraryTrackKey?: string;
  title: string;
  subtitle: string;
  durationLabel?: string;
  payload: MusicAiDemoPayload;
  /** Selector de variação no painel direito (Painel da faixa). */
  variationSidebarAccessory?: ReactNode;
  /**
   * Conteúdo da `AuthMarketingSidebar` (mesmo padrão que `/login` e importação por áudio).
   * Omitir usa o copy da biblioteca; mesclar parcialmente com `{ ...bibliotecaCifraSheetMarketingSidebar, titleLine1: "..." }`.
   */
  marketingSidebar?: Partial<AuthMarketingSidebarProps>;
};

/**
 * Layout: sidebar de marketing · coluna central (header + cifra + painel direito `CifraPocMount`).
 */
export function CifraSheetPageView({
  user,
  billingPlan,
  trackKey,
  libraryTrackKey,
  title,
  subtitle,
  durationLabel,
  payload,
  variationSidebarAccessory,
  marketingSidebar,
}: CifraSheetPageViewProps) {
  const sidebarProps: AuthMarketingSidebarProps = {
    ...bibliotecaCifraSheetMarketingSidebar,
    ...marketingSidebar,
  };

  return (
    <div className="flex min-h-dvh flex-col bg-cifra-bg text-cifra-text lg:flex-row lg:items-stretch">
      <AuthMarketingSidebar
        {...sidebarProps}
        className="hidden min-h-0 shrink-0 lg:flex lg:min-h-dvh"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-dvh lg:border-l lg:border-white/7">
        <CifraCenterChrome
          user={user}
          billingPlan={billingPlan}
          title={title}
          subtitle={subtitle}
          durationLabel={durationLabel}
          className="min-h-0 flex-1 border-l-0"
        >
          <CifraPocMount
            trackKey={trackKey}
            libraryTrackKey={libraryTrackKey}
            payload={payload}
            trackTitle={title}
            variationSidebarAccessory={variationSidebarAccessory}
          />
        </CifraCenterChrome>
      </div>
    </div>
  );
}
