import type { AnalyticsProviderId } from "./types";

/**
 * Configuração pública de analytics (somente NEXT_PUBLIC_*).
 *
 * Variáveis:
 * - NEXT_PUBLIC_ANALYTICS_PROVIDER: `none` | `google` (padrão: none)
 * - NEXT_PUBLIC_GA_MEASUREMENT_ID: ID GA4 (formato G-XXXXXXXXXX), obrigatório se provider=google
 */

export type PublicAnalyticsConfig =
  | { provider: "none" }
  | { provider: "google"; measurementId: string };

function normalizeProvider(raw: string | undefined): AnalyticsProviderId {
  const v = raw?.trim().toLowerCase();
  if (v === "google") return "google";
  return "none";
}

function isValidGa4Id(id: string): boolean {
  return /^G-[A-Z0-9]+$/i.test(id);
}

export function getPublicAnalyticsConfig(): PublicAnalyticsConfig {
  const provider = normalizeProvider(process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER);
  if (provider !== "google") {
    return { provider: "none" };
  }

  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
  if (!isValidGa4Id(measurementId)) {
    return { provider: "none" };
  }

  return { provider: "google", measurementId };
}
