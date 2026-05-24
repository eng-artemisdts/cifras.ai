import {
  fetchAuth0UserUserMetadata,
  patchAuth0UserUserMetadataFull,
} from "@/lib/billing/auth0-management";
import {
  AUTH0_USER_META_CHORD_DIAGRAM_VARIATIONS_KEY,
  MAX_CHORD_PREF_LABEL_LEN,
} from "@/lib/cifra/chord-diagram-prefs-constants";
import { normalizeChordDiagramPrefKey } from "@/lib/cifra/chord-diagram/chord-diagram-pref-key";

export function parseChordDiagramVariationMap(
  userMetadata: Record<string, unknown>,
): Record<string, number> {
  const raw = userMetadata[AUTH0_USER_META_CHORD_DIAGRAM_VARIATIONS_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[k] = Math.min(99, Math.floor(v));
    }
  }
  return out;
}

export async function loadChordDiagramVariationPrefsForUser(
  auth0UserId: string,
): Promise<Record<string, number>> {
  const um = await fetchAuth0UserUserMetadata(auth0UserId);
  return parseChordDiagramVariationMap(um);
}

export async function saveChordDiagramVariationPref(
  auth0UserId: string,
  labelRaw: string,
  variationIndex: number,
): Promise<void> {
  const key = normalizeChordDiagramPrefKey(labelRaw).slice(0, MAX_CHORD_PREF_LABEL_LEN);
  if (!key) throw new Error("invalid_label");
  const idx = Math.max(0, Math.min(99, Math.floor(variationIndex)));
  const um = await fetchAuth0UserUserMetadata(auth0UserId);
  const prevMapRaw = um[AUTH0_USER_META_CHORD_DIAGRAM_VARIATIONS_KEY];
  const prevMap =
    typeof prevMapRaw === "object" && prevMapRaw !== null && !Array.isArray(prevMapRaw)
      ? { ...(prevMapRaw as Record<string, unknown>) }
      : {};
  prevMap[key] = idx;
  um[AUTH0_USER_META_CHORD_DIAGRAM_VARIATIONS_KEY] = prevMap;
  await patchAuth0UserUserMetadataFull(auth0UserId, um);
}
