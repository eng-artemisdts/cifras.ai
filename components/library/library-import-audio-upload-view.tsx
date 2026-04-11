import { AuthMarketingSidebar } from "@/components/layout/auth-marketing-sidebar";
import type { AuthSidebarFeature } from "@/lib/auth-layout/types";
import type { LibraryNavItem } from "@/lib/library/types";
import { cn } from "@/lib/utils";

import { ImportAudioUploadPanel } from "./import-audio-upload-panel";
import { LibraryPageFooter } from "./library-page-footer";
import { LibraryTopNav, type LibraryTopNavUser } from "./library-top-nav";

export type LibraryImportAudioUploadViewProps = {
  navItems: LibraryNavItem[];
  user?: LibraryTopNavUser | null;
  className?: string;
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
        className="min-h-0 border-b border-white/7 lg:min-h-dvh lg:border-b-0"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-white/6 lg:min-h-dvh lg:border-t-0 lg:border-l lg:border-white/7">
        <LibraryTopNav items={navItems} user={user} />
        <ImportAudioUploadPanel className="min-h-0 flex-1 overflow-auto px-6 py-1.5 md:px-10 md:pb-4 md:pt-1.5" />
        <LibraryPageFooter className="mt-0 shrink-0 border-t border-white/7" />
      </div>
    </div>
  );
}
