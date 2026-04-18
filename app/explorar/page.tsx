import type { Metadata } from "next";

import { LibraryExploreView } from "@/components/library/library-explore-view";
import { getAuth0SessionCached } from "@/lib/auth0";
import { resolveBillingPlanForSessionUser } from "@/lib/billing/resolve-billing-plan";
import { fetchLibraryHomeFeed } from "@/lib/library/beethoven-tracks";
import { libraryNavForPath } from "@/lib/library/mock-data";

export const metadata: Metadata = {
  title: "Explorar · cifra.ai",
  description: "Busque músicas, veja recomendações e seus últimos acessos.",
};

export default async function ExplorarPage() {
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
    <LibraryExploreView
      navItems={libraryNavForPath("/explorar")}
      user={user}
      billingPlan={billingPlan}
      recommendationItems={recommendationItems}
      recentAccessItems={recentAccessItems}
    />
  );
}
