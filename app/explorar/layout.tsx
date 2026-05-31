import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import { Suspense } from "react";

import { ExplorarIngestBlockedDialog } from "@/components/library/explorar-ingest-blocked-dialog";
import { getAuth0SessionCached } from "@/lib/auth0";

export default async function ExplorarLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAuth0SessionCached();

  return (
    <Auth0Provider user={session?.user}>
      <Suspense fallback={null}>
        <ExplorarIngestBlockedDialog />
      </Suspense>
      {children}
    </Auth0Provider>
  );
}
