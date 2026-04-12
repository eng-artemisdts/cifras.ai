import { AuthMarketingSidebar } from "@/components/layout/auth-marketing-sidebar";
import type { AuthSidebarFeature } from "@/lib/auth-layout/types";
import type { LibraryNavItem } from "@/lib/library/types";
import { cn } from "@/lib/utils";

import type { ExistingChordDialogLayout } from "@/components/library/existing-chord-found-dialog";

import { ImportAudioUploadPanel } from "./import-audio-upload-panel";
import { LibraryPageFooter } from "./library-page-footer";
import { LibraryTopNav, type LibraryTopNavUser } from "./library-top-nav";

export type LibraryImportAudioUploadViewProps = {
  navItems: LibraryNavItem[];
  user?: LibraryTopNavUser | null;
  className?: string;
  /** Variante do modal «cifra já existe»; ver frame `vK9pq` no Pencil. */
  existingChordDialogLayout?: ExistingChordDialogLayout;
};

/** Passos alinhados ao frame `ZcVmf` (Pencil — Tela Detecção IA). */
const importAudioUploadSidebarFeatures: AuthSidebarFeature[] = [
  { title: "01  Enviar", description: "MP3 · WAV · M4A", accent: "teal" },
  { title: "02  IA analisa", description: "Acordes sugeridos", accent: "muted" },
  { title: "03  Exportar", description: "PDF · texto · projeto", accent: "muted" },
];

const importAudioUploadIntro =
  "Harmonia estimada a partir do áudio — você revisa, ajusta e exporta a cifra.";

/**
 * Etapa de upload de arquivos de áudio (após «Pular · enviar arquivo do computador»).
 * Layout espelha o frame ZcVmf no Pencil.
 */
export function LibraryImportAudioUploadView({
  navItems,
  user,
  className,
  existingChordDialogLayout,
}: LibraryImportAudioUploadViewProps) {
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
        titleLine1="Detecção"
        titleLine2="de cifra"
        titleLine3="no áudio"
        introText={importAudioUploadIntro}
        features={importAudioUploadSidebarFeatures}
        className="hidden min-h-0 shrink-0 lg:flex lg:min-h-dvh"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-dvh lg:border-l lg:border-white/7">
        <LibraryTopNav items={navItems} user={user} />
        <ImportAudioUploadPanel
          className="min-h-0 min-w-0 w-full flex-1 overflow-auto px-5 py-1 md:px-10 md:pb-3 md:pt-1"
          existingChordDialogLayout={existingChordDialogLayout}
        />
        <LibraryPageFooter className="mt-0 shrink-0 border-t border-white/7" />
      </div>
    </div>
  );
}
