import type { PublicAnalyticsConfig } from "./config";
import { sendGoogleAnalyticsEvent } from "./providers/google-analytics";
import type { AnalyticsEventParams } from "./types";

/**
 * Despacha eventos para o provedor configurado. Adicione novos `case` ao trocar/estender backends.
 */
export function dispatchAnalyticsEvent(
  config: PublicAnalyticsConfig,
  name: string,
  params?: AnalyticsEventParams,
): void {
  switch (config.provider) {
    case "google":
      sendGoogleAnalyticsEvent(name, params);
      break;
    case "none":
    default:
      break;
  }
}
