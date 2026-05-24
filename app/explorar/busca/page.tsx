import type { Metadata } from "next";
import { Suspense } from "react";

import { LibraryPageFooter } from "@/components/library/library-page-footer";
import { LibrarySearchResultsBody } from "@/components/library/library-search-results-body";
import { LibraryTopNav, type LibraryTopNavUser } from "@/components/library/library-top-nav";
import { getAuth0SessionCached } from "@/lib/auth0";
import { resolveBillingPlanForSessionUser } from "@/lib/billing/resolve-billing-plan";
import { libraryNavForPath } from "@/lib/library/mock-data";

export const metadata: Metadata = {
  title: "Busca · Explorar · cifra.ai",
  description: "Resultados da pesquisa na biblioteca.",
};

export default async function ExplorarBuscaPage() {
  const session = await getAuth0SessionCached();
  const user: LibraryTopNavUser | null = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        picture: session.user.picture ?? null,
      }
    : null;

  const billingPlan = await resolveBillingPlanForSessionUser(session?.user ?? null);

  return (
    <div className="flex min-h-dvh flex-col bg-cifra-bg text-cifra-text">
      <LibraryTopNav
        items={libraryNavForPath("/explorar/busca")}
        user={user}
        billingPlan={billingPlan ?? undefined}
      />
      <main className="relative flex flex-1 flex-col items-center overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 z-1 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -20%, var(--cifra-glow) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 100% 0%, rgba(28, 31, 62, 0.5) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 w-full flex-1">
          <Suspense
            fallback={
              <div className="mx-auto max-w-[720px] px-6 py-16 text-center text-sm text-cifra-muted md:px-8">
                Carregando…
              </div>
            }
          >
            <LibrarySearchResultsBody />
          </Suspense>
        </div>
      </main>
      <LibraryPageFooter />
    </div>
  );
}
