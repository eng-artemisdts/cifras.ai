import { getPublicAnalyticsConfig } from "./config";
import { dispatchAnalyticsEvent } from "./registry";
import type { AnalyticsEventParams } from "./types";

/**
 * Evento de produto no provedor ativo. Seguro em SSR (no-op).
 */
export function trackAnalyticsEvent(
  name: string,
  params?: AnalyticsEventParams,
): void {
  if (typeof window === "undefined") return;
  dispatchAnalyticsEvent(getPublicAnalyticsConfig(), name, params);
}
