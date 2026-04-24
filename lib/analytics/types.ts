/** Identificador do backend de métricas ativo no cliente (extensível). */
export type AnalyticsProviderId = "none" | "google";

export type AnalyticsEventParams = Record<
  string,
  string | number | boolean | undefined
>;
