"use client";

import { getPublicAnalyticsConfig } from "@/lib/analytics/config";
import { AnalyticsBootstrap } from "./analytics-bootstrap";

/** Lê variáveis públicas no cliente e monta o provedor de métricas configurado. */
export function AnalyticsRoot() {
  const config = getPublicAnalyticsConfig();
  return <AnalyticsBootstrap config={config} />;
}
