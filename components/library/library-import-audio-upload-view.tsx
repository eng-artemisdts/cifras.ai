import type { BillingPlan } from "@/lib/billing/plan-types";
import type { LibraryNavItem } from "@/lib/library/types";

import type { ExistingChordDialogLayout } from "@/components/library/library-import-dialog-layout";

import type { LibraryTopNavUser } from "./library-top-nav";

import { ImportAudioLibraryFlow } from "./import-audio-library-flow";

export type LibraryImportAudioUploadViewProps = {
  navItems: LibraryNavItem[];
  user?: LibraryTopNavUser | null;
  billingPlan?: BillingPlan | null;
  className?: string;
  /** Variante do modal de confirmação da música; ver frame `vK9pq` no Pencil. */
  existingChordDialogLayout?: ExistingChordDialogLayout;
};

/**
 * Etapa de upload de arquivos de áudio (após «Pular · enviar arquivo do computador»).
 * Detectação (passo 1) → revisão de metadados (passo 2, frame `8gzeJ`) → edição da cifra (fluxo atual).
 */
export function LibraryImportAudioUploadView({
  navItems,
  user,
  billingPlan,
  className,
  existingChordDialogLayout,
}: LibraryImportAudioUploadViewProps) {
  return (
    <ImportAudioLibraryFlow
      navItems={navItems}
      user={user}
      billingPlan={billingPlan}
      className={className}
      existingChordDialogLayout={existingChordDialogLayout}
    />
  );
}
