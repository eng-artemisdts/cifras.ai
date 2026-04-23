import { fetchBeethovenFromServer } from "@/lib/beethoven-server-api";

import type { BeethovenVariationJson } from "./beethoven-variations";

function parseBeethovenError(status: number, raw: string): never {
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as { message?: unknown; error?: unknown };
    if (Array.isArray(parsed.message)) detail = parsed.message.join("; ");
    else if (typeof parsed.message === "string" && parsed.message.trim()) detail = parsed.message;
    else if (typeof parsed.error === "string" && parsed.error.trim()) detail = parsed.error;
  } catch {
    // ignore JSON parse
  }
  throw new Error(detail || `HTTP ${status}`);
}

export async function fetchBeethovenVariationsByBaseTrackIdFromServer(
  baseTrackId: string,
): Promise<BeethovenVariationJson[]> {
  const key = baseTrackId.trim();
  if (!key) return [];
  const res = await fetchBeethovenFromServer(`tracks/variations/by-base-key/${encodeURIComponent(key)}`, {
    method: "GET",
    cache: "no-store",
  });
  if (res.status === 404) return [];
  const raw = await res.text();
  if (!res.ok) parseBeethovenError(res.status, raw);
  const data = raw ? (JSON.parse(raw) as unknown) : [];
  return Array.isArray(data) ? (data as BeethovenVariationJson[]) : [];
}

export async function fetchBeethovenVariationByTrackIdFromServer(
  variationTrackId: string,
): Promise<BeethovenVariationJson | null> {
  const key = variationTrackId.trim();
  if (!key) return null;
  const res = await fetchBeethovenFromServer(`tracks/variations/by-track-id/${encodeURIComponent(key)}`, {
    method: "GET",
    cache: "no-store",
  });
  if (res.status === 404) return null;
  const raw = await res.text();
  if (!res.ok) parseBeethovenError(res.status, raw);
  if (!raw) return null;
  return JSON.parse(raw) as BeethovenVariationJson;
}
