/** Nomes estáveis para GA4 (snake_case, sem PII). */
export const GA_EVENTS = {
  OAUTH_PROVIDER_CLICK: "oauth_provider_click",
  LOGOUT_CLICK: "logout_click",
  ACCOUNT_MENU_NAV: "account_menu_nav",
  LANDING_CTA_CLICK: "landing_cta_click",
  LANDING_EARLY_ACCESS_SUBMIT: "landing_early_access_submit",
  LIBRARY_SEARCH_SUBMIT: "library_search_submit",
  LIBRARY_TRACK_OPEN: "library_track_open",
  BILLING_SUBSCRIBE_CLICK: "billing_subscribe_click",
  BILLING_MANAGE_CLICK: "billing_manage_click",
  IMPORT_FLOW_VIEW: "import_flow_view",
  LIBRARY_CATALOG_TAB: "library_catalog_tab",
  LIBRARY_IMPORT_CTA: "library_import_cta",
  CIFRA_VIEW: "cifra_view",
  PLAYBACK_PROVIDER_SELECT: "playback_provider_select",
  SPOTIFY_CONNECT_CLICK: "spotify_connect_click",
  LIBRARY_CARD_ACTION: "library_card_action",
} as const;

/** Tamanho aproximado da query (sem enviar o texto da busca ao GA). */
export function searchQueryLengthBucket(length: number): "short" | "medium" | "long" {
  if (length <= 12) return "short";
  if (length <= 40) return "medium";
  return "long";
}

export function inferSearchSurfaceFromResultsPath(resultsBasePath: string): string {
  if (resultsBasePath.includes("/biblioteca/")) return "biblioteca";
  if (resultsBasePath.includes("/explorar/")) return "explorar";
  return "other";
}
