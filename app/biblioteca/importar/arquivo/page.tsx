import type { Metadata } from "next";

import { LibraryImportAudioUploadView } from "@/components/library/library-import-audio-upload-view";
import { getAuth0SessionCached } from "@/lib/auth0";
import { libraryNavForPath } from "@/lib/library/mock-data";

export const metadata: Metadata = {
  title: "Enviar áudio · Importar música · cifra.ai",
  description:
    "Carregue um arquivo MP3, WAV ou M4A para detecção de cifra. Máximo 50 MB.",
};

export default async function BibliotecaImportarArquivoPage() {
  const session = await getAuth0SessionCached();
  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        picture: session.user.picture ?? null,
      }
    : null;

  return (
    <LibraryImportAudioUploadView
      navItems={libraryNavForPath("/biblioteca/importar/arquivo")}
      user={user}
    />
  );
}
