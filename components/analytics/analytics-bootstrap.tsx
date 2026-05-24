"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import type { PublicAnalyticsConfig } from "@/lib/analytics/config";

type Props = {
  config: PublicAnalyticsConfig;
};

/**
 * Carrega scripts do provedor de métricas no cliente. Novos provedores: ramificar por `config.provider`.
 */
export function AnalyticsBootstrap({ config }: Props) {
  if (config.provider === "google") {
    return <GoogleAnalytics gaId={config.measurementId} />;
  }
  return null;
}
