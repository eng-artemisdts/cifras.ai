import { AuthMarketingSidebar } from "@/components/layout/auth-marketing-sidebar";
import type { AuthSidebarFeature } from "@/lib/auth-layout/types";
import type { LibraryNavItem } from "@/lib/library/types";
import { cn } from "@/lib/utils";

import { LibraryPageFooter } from "./library-page-footer";
import { LibraryTopNav, type LibraryTopNavUser } from "./library-top-nav";
import { StreamingImportRightPanel } from "./streaming-import-right-panel";

export type LibraryImportStreamingViewProps = {
  navItems: LibraryNavItem[];
  user?: LibraryTopNavUser | null;
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
        titleLine1="Importar"
        titleLine2="música"
        titleLine3="do streaming"
        introText={importStreamingIntro}
        features={importStreamingSidebarFeatures}
        className="min-h-0 border-b border-white/7 lg:min-h-dvh lg:border-b-0"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-white/6 lg:min-h-dvh lg:border-t-0 lg:border-l lg:border-white/7">
        <LibraryTopNav items={navItems} user={user} />
        <StreamingImportRightPanel className="min-h-0 flex-1 overflow-auto px-6 py-1.5 md:px-10 md:pb-4 md:pt-1.5" />
        <LibraryPageFooter className="mt-0 shrink-0 border-t border-white/7" />
      </div>
    </div>
  );
}
