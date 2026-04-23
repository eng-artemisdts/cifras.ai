import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";

import { CifraSheetPageView } from "@/components/cifra/cifra-sheet-page-view";
import { CifraVariationSelect } from "@/components/cifra/cifra-variation-select";
import { resolveCifraSlugPairFromTrack } from "@/lib/cifra/cifra-routes";
import { normalizeDemoPayload } from "@/lib/cifra/normalize-payload";
import {
  resolveArtistNameFromSchubertTrack,
  schubertTrackToDemoPayload,
} from "@/lib/cifra/schubert-to-payload";
import {
  type BeethovenVariationJson,
} from "@/lib/beethoven-variations";
import {
  fetchBeethovenVariationByTrackIdFromServer,
  fetchBeethovenVariationsByBaseTrackIdFromServer,
} from "@/lib/beethoven-variations.server";
import { getAuth0SessionCached } from "@/lib/auth0";
import { resolveBillingPlanForSessionUser } from "@/lib/billing/resolve-billing-plan";
import { publicMp3UrlForTrackId } from "@/lib/media/public-mp3-for-track";
import type { SchubertTrackJson } from "@/lib/schubert-api";
import {
  fetchSchubertTrackByKey,
  fetchSchubertTrackBySlug,
} from "@/lib/schubert-fetch-track";

import { RegisterLibraryTrackAccess } from "./register-library-track-access";

function formatDurationClock(sec: number | undefined): string | undefined {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return undefined;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function resolveDurationSeconds(track: {
  meta?: { duration_seconds?: number };
  chords?: { end?: number }[];
}): number | undefined {
  const fromMeta = track.meta?.duration_seconds;
  if (Number.isFinite(fromMeta) && (fromMeta as number) > 0) return fromMeta as number;
  const ends = (track.chords ?? []).map((c) => Number(c.end)).filter((n) => Number.isFinite(n));
  if (!ends.length) return undefined;
  return Math.max(...ends);
}

function formatVariationLabel(
  v: Pick<SchubertTrackJson, "variationLabel" | "owner" | "userId" | "is_private">,
  index: number,
  sessionSub: string,
): string {
  const custom =
    typeof v.variationLabel === "string" && v.variationLabel.trim() ? v.variationLabel.trim() : "";
  if (custom) return custom;
  const mine =
    (typeof v.owner === "string" && v.owner === sessionSub) ||
    (typeof v.userId === "string" && v.userId === sessionSub);
  if (mine) return "Minha versão";
  if (v.is_private !== true) return "Versão partilhada";
  return `Versão ${index + 1}`;
}

export type CifraTrackViewProps =
  | { artistSlug: string; songSlug: string; variationTrackId?: string | null }
  | { trackKey: string };

/**
 * Visualização pública da cifra em `/cifras/...` (rota fora do bloqueio da biblioteca).
 */
export async function CifraTrackView(props: CifraTrackViewProps) {
  const session = await getAuth0SessionCached();
  const billingPlan = await resolveBillingPlanForSessionUser(session?.user ?? null);
  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        picture: session.user.picture ?? null,
      }
    : null;

  let track: Awaited<ReturnType<typeof fetchSchubertTrackBySlug>>;

  try {
    track =
      "artistSlug" in props
        ? await fetchSchubertTrackBySlug(props.artistSlug, props.songSlug)
        : await fetchSchubertTrackByKey(props.trackKey);
  } catch (error) {
    unstable_rethrow(error);
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-cifra-bg px-6 text-center">
        <p className="max-w-md text-sm text-cifra-muted">
          Não foi possível contactar a Schubert API. Verifique a rede e as variáveis de ambiente, ou tente novamente
          mais tarde.
        </p>
        <Link href="/biblioteca/importar/arquivo" className="text-sm font-semibold text-cifra-teal">
          Voltar à importação
        </Link>
      </div>
    );
  }

  if (!track) {
    notFound();
  }

  const sessionSub = session?.user?.sub?.trim() || "";
  const variationTrackId =
    "artistSlug" in props && typeof props.variationTrackId === "string"
      ? props.variationTrackId.trim()
      : "";
  const baseTrackId = typeof track.trackId === "string" ? track.trackId.trim() : "";
  const schubertVariations = Array.isArray(track.variations) ? track.variations : [];
  const beethovenVariations: BeethovenVariationJson[] =
    baseTrackId && "artistSlug" in props
      ? await fetchBeethovenVariationsByBaseTrackIdFromServer(baseTrackId).catch(() => [])
      : [];
  const variations = [...schubertVariations, ...beethovenVariations];
  /**
   * Sem `?v=` → cifra base (`track`). Nunca usar fallback automático para «minha versão»:
   * isso impedia ver a base e fazia `?? owner` mascarar falhas do find (bloqueando o fetch por id).
   */
  let selectedVariation =
    variationTrackId.trim().length > 0
      ? variations.find((v) => typeof v.trackId === "string" && v.trackId.trim() === variationTrackId) ?? null
      : null;

  if ("artistSlug" in props && variationTrackId && !selectedVariation) {
    const direct = await fetchSchubertTrackByKey(variationTrackId);
    if (direct) {
      const pair = resolveCifraSlugPairFromTrack(direct);
      const asp = props.artistSlug.trim().toLowerCase();
      const ssp = props.songSlug.trim().toLowerCase();
      if (
        !pair ||
        pair.artistSlug.trim().toLowerCase() !== asp ||
        pair.songSlug.trim().toLowerCase() !== ssp
      ) {
        notFound();
      }
      selectedVariation = direct;
    } else {
      const localVariation = await fetchBeethovenVariationByTrackIdFromServer(variationTrackId).catch(() => null);
      if (!localVariation) notFound();
      selectedVariation = localVariation as NonNullable<typeof selectedVariation>;
    }
  }

  const mergedVariations = [...variations];
  const selectedTid =
    selectedVariation && typeof selectedVariation.trackId === "string"
      ? selectedVariation.trackId.trim()
      : "";
  if (
    selectedVariation &&
    selectedTid &&
    !variations.some((v) => typeof v.trackId === "string" && v.trackId.trim() === selectedTid)
  ) {
    mergedVariations.push(selectedVariation);
  }

  const resolvedTrack = selectedVariation ?? track;

  const slugPair = resolveCifraSlugPairFromTrack(track);
  const mp3Id =
    typeof resolvedTrack.trackId === "string" && resolvedTrack.trackId.trim()
      ? resolvedTrack.trackId.trim()
      : "";

  const fromSchubert = schubertTrackToDemoPayload(resolvedTrack as SchubertTrackJson);
  const payload = normalizeDemoPayload({
    ...fromSchubert,
    meta: {
      ...fromSchubert.meta,
      ...(mp3Id ? { audioUrl: publicMp3UrlForTrackId(mp3Id) } : {}),
    },
  });

  const title =
    typeof resolvedTrack.name === "string" && resolvedTrack.name.trim()
      ? resolvedTrack.name.trim()
      : (resolvedTrack.meta?.name ?? "Faixa sem título");
  const artist = resolveArtistNameFromSchubertTrack(resolvedTrack as SchubertTrackJson);
  const subtitle = `${artist}`;
  const durationLabel = formatDurationClock(resolveDurationSeconds(resolvedTrack));

  const reactKey =
    slugPair !== null
      ? `${slugPair.artistSlug}/${slugPair.songSlug}${selectedTid ? `:v:${selectedTid}` : ""}`
      : mp3Id || ("artistSlug" in props ? `${props.artistSlug}/${props.songSlug}` : props.trackKey);

  const variationSidebarAccessory =
    "artistSlug" in props && mergedVariations.length > 0 ? (
      <CifraVariationSelect
        artistSlug={props.artistSlug}
        songSlug={props.songSlug}
        currentValue={
          selectedVariation && typeof selectedVariation.trackId === "string"
            ? selectedVariation.trackId.trim()
            : ""
        }
        options={[
          { value: "", label: "Cifra base" },
          ...mergedVariations
            .filter((v) => typeof v.trackId === "string" && v.trackId.trim())
            .map((v, index) => ({
              value: (v.trackId as string).trim(),
              label: formatVariationLabel(v, index, sessionSub),
            })),
        ]}
      />
    ) : null;

  return (
    <>
      {session?.user?.sub && mp3Id ? (
        <RegisterLibraryTrackAccess trackKey={mp3Id} />
      ) : null}
      <CifraSheetPageView
        user={user}
        billingPlan={billingPlan}
        trackKey={reactKey}
        libraryTrackKey={mp3Id || undefined}
        title={title}
        subtitle={subtitle}
        durationLabel={durationLabel}
        payload={payload}
        variationSidebarAccessory={variationSidebarAccessory}
      />
    </>
  );
}
