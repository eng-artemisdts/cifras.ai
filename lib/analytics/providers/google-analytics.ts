import { sendGAEvent } from "@next/third-parties/google";
import type { AnalyticsEventParams } from "../types";

/** Evento GA4 via dataLayer (mesmo canal do `GoogleAnalytics` do Next). */
export function sendGoogleAnalyticsEvent(
  name: string,
  params?: AnalyticsEventParams,
): void {
  if (typeof window === "undefined") return;
  sendGAEvent("event", name, params ?? {});
}
