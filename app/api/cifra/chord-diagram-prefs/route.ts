import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { isAuth0ManagementConfigured } from "@/lib/billing/auth0-management";
import { getChordDiagramVariationCount } from "@/lib/cifra/chord-diagram/svguitar-from-db";
import { normalizeChordDiagramPrefKey } from "@/lib/cifra/chord-diagram/chord-diagram-pref-key";
import { MAX_CHORD_PREF_LABEL_LEN } from "@/lib/cifra/chord-diagram-prefs-constants";
import {
  loadChordDiagramVariationPrefsForUser,
  saveChordDiagramVariationPref,
} from "@/lib/cifra/chord-diagram-prefs-server";

export const runtime = "nodejs";

type PatchBody = {
  label?: string;
  variationIndex?: number;
};

export async function GET() {
  if (!isAuth0Configured()) {
    return NextResponse.json({ diagramByLabel: {}, error: "auth0_not_configured" }, { status: 503 });
  }
  const session = await getAuth0Session();
  const sub = session?.user?.sub?.trim();
  if (!sub) {
    return NextResponse.json({ diagramByLabel: {} });
  }
  if (!isAuth0ManagementConfigured()) {
    return NextResponse.json({ diagramByLabel: {}, warning: "management_api_not_configured" });
  }
  try {
    const diagramByLabel = await loadChordDiagramVariationPrefsForUser(sub);
    return NextResponse.json({ diagramByLabel });
  } catch {
    return NextResponse.json({ diagramByLabel: {} });
  }
}

export async function PATCH(req: Request) {
  if (!isAuth0Configured()) {
    return NextResponse.json({ ok: false, error: "auth0_not_configured" }, { status: 503 });
  }
  const session = await getAuth0Session();
  const sub = session?.user?.sub?.trim();
  if (!sub) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 });
  }
  if (!isAuth0ManagementConfigured()) {
    return NextResponse.json({ ok: false, error: "management_api_not_configured" }, { status: 503 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const labelRaw = typeof body.label === "string" ? body.label : "";
  const normalized = normalizeChordDiagramPrefKey(labelRaw).slice(0, MAX_CHORD_PREF_LABEL_LEN);
  if (!normalized) {
    return NextResponse.json({ ok: false, error: "invalid_label" }, { status: 400 });
  }

  const vi = body.variationIndex;
  if (typeof vi !== "number" || !Number.isFinite(vi)) {
    return NextResponse.json({ ok: false, error: "invalid_variation_index" }, { status: 400 });
  }
  const idx = Math.floor(vi);
  if (idx < 0) {
    return NextResponse.json({ ok: false, error: "invalid_variation_index" }, { status: 400 });
  }

  const max = getChordDiagramVariationCount(normalized);
  if (max <= 0) {
    return NextResponse.json({ ok: false, error: "chord_not_in_library" }, { status: 400 });
  }
  if (idx >= max) {
    return NextResponse.json({ ok: false, error: "variation_out_of_range" }, { status: 400 });
  }

  try {
    await saveChordDiagramVariationPref(sub, normalized, idx);
  } catch (e) {
    const message = e instanceof Error ? e.message : "save_failed";
    return NextResponse.json({ ok: false, error: "persist_failed", details: message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, label: normalized, variationIndex: idx });
}
