import type { BillingPlan } from "@/lib/billing/plan-types";
import { fetchSchubertFromBrowser } from "@/lib/schubert-api";

export type ImportQuotaStatus = {
  plan: BillingPlan;
  limit: number;
  used: number;
  remaining: number;
  windowDays: number;
  nextSlotAt: string | null;
};

export function isImportQuotaStatus(value: unknown): value is ImportQuotaStatus {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.limit === "number" &&
    typeof o.used === "number" &&
    typeof o.remaining === "number"
  );
}

export async function fetchImportQuota(): Promise<ImportQuotaStatus | null> {
  const res = await fetchSchubertFromBrowser("tracks/ingest/quota", { method: "GET" });
  if (!res.ok) return null;
  const json: unknown = await res.json().catch(() => null);
  return isImportQuotaStatus(json) ? json : null;
}

export function isImportQuotaExceededError(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  if (o.code === "import_quota_exceeded") return true;
  const msg = o.message;
  if (msg && typeof msg === "object" && !Array.isArray(msg)) {
    return (msg as Record<string, unknown>).code === "import_quota_exceeded";
  }
  return false;
}

export function formatImportQuotaResetLabel(nextSlotAt: string | null): string | null {
  if (!nextSlotAt) return null;
  const at = new Date(nextSlotAt);
  if (Number.isNaN(at.getTime())) return null;
  const diffMs = at.getTime() - Date.now();
  if (diffMs <= 0) return "em breve";
  const hours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (hours < 24) return `em ${hours} h`;
  const days = Math.ceil(hours / 24);
  return `em ${days} dia${days === 1 ? "" : "s"}`;
}
