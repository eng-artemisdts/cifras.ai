"use client";

import { useCallback, useMemo, useState } from "react";

import { AuthMarketingSidebar } from "@/components/layout/auth-marketing-sidebar";
import type { ExistingChordDialogLayout } from "@/components/library/library-import-dialog-layout";
import type { BillingPlan } from "@/lib/billing/plan-types";
import type { AuthSidebarFeature } from "@/lib/auth-layout/types";
import type { LibraryNavItem } from "@/lib/library/types";
import type { ImportMetadataContext } from "@/lib/library/import-metadata-context";
import { cn } from "@/lib/utils";

import { ImportAudioUploadPanel, type QueuedFile } from "./import-audio-upload-panel";
import { ImportMetadataStep } from "./import-metadata-step";
import { LibraryPageFooter } from "./library-page-footer";
import { LibraryTopNav, type LibraryTopNavUser } from "./library-top-nav";

/** Frame ZcVmf — detecção. */
const uploadSidebarFeatures: AuthSidebarFeature[] = [
  { title: "01  Enviar", description: "MP3 · WAV · M4A", accent: "teal" },
  { title: "02  IA analisa", description: "Acordes sugeridos", accent: "muted" },
  { title: "03  Exportar", description: "PDF · texto · projeto", accent: "muted" },
];

const uploadIntro =
  "Harmonia estimada a partir do áudio — você revisa, ajusta e exporta a cifra.";

/** Sidebar L2 / frame U7xp7 — revisão de metadados (passo 2). */
const metadataSidebarFeatures: AuthSidebarFeature[] = [
  { title: "01  Captura", description: "Arquivo ingerido", accent: "muted" },
  { title: "02  Revisão", description: "Metadados + acordes", accent: "teal" },
  { title: "03  Biblioteca", description: "Salvar na sua lista", accent: "muted" },
];

const metadataIntro =
  "Ajuste nome, tom e acordes sugeridos antes de guardar na sua lista pessoal.";

export type ImportAudioLibraryFlowProps = {
  navItems: LibraryNavItem[];
  user?: LibraryTopNavUser | null;
  billingPlan?: BillingPlan | null;
  className?: string;
  existingChordDialogLayout?: ExistingChordDialogLayout;
};

export function ImportAudioLibraryFlow({
  navItems,
  user,
  billingPlan,
  className,
  existingChordDialogLayout,
}: ImportAudioLibraryFlowProps) {
  const [metadataContext, setMetadataContext] = useState<ImportMetadataContext | null>(null);
  const [restoreQueue, setRestoreQueue] = useState<QueuedFile[] | null>(null);
  const [uploadPanelKey, setUploadPanelKey] = useState(0);

  const handleProceedToMetadata = useCallback((ctx: ImportMetadataContext, q: QueuedFile[]) => {
    setMetadataContext(ctx);
    setRestoreQueue(q);
  }, []);

  const handleBackFromMetadata = useCallback(() => {
    setMetadataContext(null);
    setUploadPanelKey((k) => k + 1);
  }, []);

  const handleDoneNavigation = useCallback(() => {
    setMetadataContext(null);
    setRestoreQueue(null);
  }, []);

  const metadataStepKey = useMemo(() => {
    if (!metadataContext) return "";
    const v =
      metadataContext.variationBaseTrackId?.trim() ??
      `${metadataContext.file.name}-${metadataContext.file.size}-${metadataContext.mode}`;
    return `${metadataContext.file.name}-${metadataContext.file.size}-${metadataContext.mode}-${v}`;
  }, [metadataContext]);

  const isMetadata = Boolean(metadataContext);

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-cifra-bg text-cifra-text lg:flex-row lg:items-stretch",
        className,
      )}
    >
      <AuthMarketingSidebar
        contextLabel="cifra · lab"
        contextUppercase={false}
        titleLine1={isMetadata ? "Revisão" : "Detecção"}
        titleLine2={isMetadata ? "da cifra" : "de cifra"}
        titleLine3={isMetadata ? "manual" : "no áudio"}
        introText={isMetadata ? metadataIntro : uploadIntro}
        features={isMetadata ? metadataSidebarFeatures : uploadSidebarFeatures}
        className="hidden min-h-0 shrink-0 lg:flex lg:min-h-dvh"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-dvh lg:border-l lg:border-white/7">
        <LibraryTopNav items={navItems} user={user} billingPlan={billingPlan ?? undefined} />
        {metadataContext ? (
          <ImportMetadataStep
            key={metadataStepKey}
            context={metadataContext}
            onBack={handleBackFromMetadata}
            onDoneNavigation={handleDoneNavigation}
            billingPlan={billingPlan}
            className="min-h-0 min-w-0 w-full flex-1 overflow-auto px-5 py-1 md:px-10 md:pb-3 md:pt-1"
          />
        ) : (
          <ImportAudioUploadPanel
            key={uploadPanelKey}
            initialQueue={restoreQueue ?? undefined}
            onProceedToMetadata={handleProceedToMetadata}
            className="min-h-0 min-w-0 w-full flex-1 overflow-auto px-5 py-1 md:px-10 md:pb-3 md:pt-1"
            existingChordDialogLayout={existingChordDialogLayout}
          />
        )}
        <LibraryPageFooter className="mt-0 shrink-0 border-t border-white/7" />
      </div>
    </div>
  );
}
