"use client";

import type { ReactNode } from "react";

import { IngestJobsProvider } from "@/components/providers/ingest-jobs-context";
import { ImportQuotaProvider } from "@/components/providers/import-quota-context";

/**
 * Providers que devem envolver toda a app (polling de ingestões continua entre rotas).
 */
export function AppShellProviders({ children }: { children: ReactNode }) {
  return (
    <IngestJobsProvider>
      <ImportQuotaProvider>{children}</ImportQuotaProvider>
    </IngestJobsProvider>
  );
}
