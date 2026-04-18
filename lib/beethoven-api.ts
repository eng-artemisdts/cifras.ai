import { headers } from "next/headers";

import { beethovenProxyUrl } from "./beethoven-browser-client";

export { beethovenProxyUrl, fetchBeethovenFromBrowser } from "./beethoven-browser-client";

/**
 * Server Components / Route Handlers: reencaminha cookies para o BFF no mesmo host.
 */
export async function fetchBeethovenFromServer(path: string, init?: RequestInit): Promise<Response> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    throw new Error("Host em falta para fetchBeethovenFromServer");
  }
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}${beethovenProxyUrl(path)}`;
  const nextHeaders = new Headers(init?.headers);
  const cookie = h.get("cookie");
  if (cookie && !nextHeaders.has("cookie")) {
    nextHeaders.set("cookie", cookie);
  }
  return fetch(url, { ...init, headers: nextHeaders });
}
