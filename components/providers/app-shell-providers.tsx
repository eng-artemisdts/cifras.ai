"use client";

import type { ReactNode } from "react";

import { IngestJobsProvider } from "@/components/providers/ingest-jobs-context";

/**
 * Providers que devem envolver toda a app (polling de ingestões continua entre rotas).
 */
export function AppShellProviders({ children }: { children: ReactNode }) {
  return <IngestJobsProvider>{children}</IngestJobsProvider>;
}
