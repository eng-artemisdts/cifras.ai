import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { LibraryImportProviderView } from "@/components/library/library-import-provider-view";
import { getAuth0SessionCached } from "@/lib/auth0";
import { resolveBillingPlanForSessionUser } from "@/lib/billing/resolve-billing-plan";
import { hasProStreamingImports } from "@/lib/entitlements";
import {
  isStreamingImportProviderSlug,
  streamingLinkImportConfig,
} from "@/lib/library/streaming-link-import-config";
import { libraryNavForPath } from "@/lib/library/mock-data";

type PageProps = {
  params: Promise<{ provider: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { provider } = await params;
  if (!isStreamingImportProviderSlug(provider)) {
    return { title: "Importar · cifra.ai" };
  }
  const label = streamingLinkImportConfig[provider].pageTitle;
  return {
    title: `Importar · ${label} · cifra.ai`,
    description: `Cole o link público do ${label} para continuar a importação no cifra.ai.`,
  };
}

export default async function BibliotecaImportarProviderPage({ params }: PageProps) {
  const { provider } = await params;
  if (!isStreamingImportProviderSlug(provider)) {
    notFound();
  }

  const session = await getAuth0SessionCached();
  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        picture: session.user.picture ?? null,
      }
    : null;

  const config = streamingLinkImportConfig[provider];
  const billingPlan = await resolveBillingPlanForSessionUser(session?.user ?? null);
  const proEntitled = hasProStreamingImports(session?.user ?? null, billingPlan);

  if (config.panel.requiresPro && !proEntitled) {
    redirect("/biblioteca/importar");
  }

  return (
    <LibraryImportProviderView
      config={config}
      navItems={libraryNavForPath(`/biblioteca/importar/${provider}`)}
      user={user}
      billingPlan={billingPlan}
      proEntitled={proEntitled}
    />
  );
}
