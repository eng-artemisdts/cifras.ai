import type { Metadata } from "next";

import { LibraryHomeView } from "@/components/library/library-home-view";
import { getAuth0SessionCached } from "@/lib/auth0";
import { resolveBillingPlanForSessionUser } from "@/lib/billing/resolve-billing-plan";
import { libraryNavForPath } from "@/lib/library/mock-data";
import { fetchLibraryHomeFeed } from "@/lib/library/beethoven-tracks";

export const metadata: Metadata = {
  title: "Biblioteca · cifra.ai",
  description: "Busque músicas, veja recomendações e seus últimos acessos.",
};

export default async function BibliotecaPage() {
  const session = await getAuth0SessionCached();
  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        picture: session.user.picture ?? null,
      }
    : null;

  const billingPlan = await resolveBillingPlanForSessionUser(session?.user ?? null);
  const { recommendationItems, recentAccessItems } = await fetchLibraryHomeFeed(
    session?.user?.sub,
  ).catch(() => ({
    recommendationItems: [],
    recentAccessItems: [],
  }));

  return (
    <LibraryHomeView
      navItems={libraryNavForPath("/biblioteca")}
      user={user}
      billingPlan={billingPlan}
      recommendationItems={recommendationItems}
      recentAccessItems={recentAccessItems}
    />
  );
}
