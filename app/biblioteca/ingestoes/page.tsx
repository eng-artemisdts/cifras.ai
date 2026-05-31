import type { Metadata } from "next";

import { BibliotecaIngestoesView } from "@/components/library/biblioteca-ingestoes-view";
import { getAuth0SessionCached } from "@/lib/auth0";
import { resolveBillingPlanForSessionUser } from "@/lib/billing/resolve-billing-plan";
import { libraryNavForPath } from "@/lib/library/mock-data";

export const metadata: Metadata = {
  title: "Cifras em progresso · Biblioteca · cifra.ai",
  description: "Acompanhe importações e geração de cifras em segundo plano.",
};

export default async function BibliotecaIngestoesPage() {
  const session = await getAuth0SessionCached();
  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        picture: session.user.picture ?? null,
      }
    : null;

  const billingPlan = await resolveBillingPlanForSessionUser(session?.user ?? null);

  return (
    <BibliotecaIngestoesView
      navItems={libraryNavForPath("/biblioteca/ingestoes")}
      user={user}
      billingPlan={billingPlan}
    />
  );
}
