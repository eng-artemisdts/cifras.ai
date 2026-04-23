import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CifraEditShell } from "@/components/cifra/cifra-edit-shell";
import { resolveCifraSlugPairFromTrack } from "@/lib/cifra/cifra-routes";
import { normalizeDemoPayload } from "@/lib/cifra/normalize-payload";
import {
  resolveArtistNameFromSchubertTrack,
  schubertLyricsSourceEditorLabel,
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
import { appLoginHref } from "@/lib/auth0-routes";
import { isAuth0Configured } from "@/lib/auth0-env";
import { resolveBillingPlanForSessionUser } from "@/lib/billing/resolve-billing-plan";
import type { SchubertLyricsSource, SchubertTrackJson } from "@/lib/schubert-api";
import { publicMp3UrlForTrackId } from "@/lib/media/public-mp3-for-track";
import {
  fetchSchubertTrackByKey,
  fetchSchubertTrackBySlug,
} from "@/lib/schubert-fetch-track";

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

function resolveLyricsSource(track: NonNullable<Awaited<ReturnType<typeof fetchSchubertTrackBySlug>>>): SchubertLyricsSource {
  if (track.lyricsSource === "MATCH") return "MATCH";
  return "AI";
}

/**
 * Variações persistidas na Beethoven trazem `baseArtistSlug` / `baseSongSlug`; documentos Schubert não.
 * Também cobre o caso em que a variação foi carregada só por id (fetch direto) e não entrou na lista agregada.
 */
function isBeethovenVariationResolved(
  resolved: unknown,
  variationTrackKey: string,
  beethovenVariations: BeethovenVariationJson[],
): boolean {
  const key = variationTrackKey.trim();
  if (!key) return false;
  if (
    beethovenVariations.some((v) => typeof v.trackId === "string" && v.trackId.trim() === key)
  ) {
    return true;
  }
  if (!resolved || typeof resolved !== "object") return false;
  const r = resolved as BeethovenVariationJson;
  return Boolean(
    typeof r.baseArtistSlug === "string" &&
      r.baseArtistSlug.trim() &&
      typeof r.baseSongSlug === "string" &&
      r.baseSongSlug.trim(),
  );
}

export type CifraEditViewProps =
  | { artistSlug: string; songSlug: string; variationTrackId?: string | null }
  | { trackKey: string };

export async function CifraEditView(props: CifraEditViewProps) {
  if (!isAuth0Configured()) {
    notFound();
  }

  const session = await getAuth0SessionCached();
  const returnToLogin =
    "artistSlug" in props
      ? `/cifras/${encodeURIComponent(props.artistSlug)}/${encodeURIComponent(props.songSlug)}/edit`
      : `/cifras/edit?trackId=${encodeURIComponent(props.trackKey)}`;

  if (!session?.user) {
    redirect(appLoginHref(returnToLogin));
  }

  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    picture: session.user.picture ?? null,
  };
  const billingPlan = await resolveBillingPlanForSessionUser(session.user);

  let track: Awaited<ReturnType<typeof fetchSchubertTrackBySlug>>;
  try {
    track =
      "artistSlug" in props
        ? await fetchSchubertTrackBySlug(props.artistSlug, props.songSlug)
        : await fetchSchubertTrackByKey(props.trackKey);
  } catch {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-cifra-bg px-6 text-center">
        <p className="max-w-md text-sm text-cifra-muted">
          Não foi possível contactar a Schubert API. Verifique a rede e tente novamente.
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

  const sessionSub = session.user.sub?.trim() || "";
  const requestedVariationId =
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
  const ownerVariation = variations.find((v) => {
    const owner =
      typeof v.userId === "string"
        ? v.userId.trim()
        : "owner" in v && typeof v.owner === "string"
          ? v.owner.trim()
          : "";
    return owner && owner === sessionSub;
  });
  let selectedVariation =
    (requestedVariationId
      ? variations.find((v) => typeof v.trackId === "string" && v.trackId.trim() === requestedVariationId)
      : null) ?? ownerVariation ?? null;
  if ("artistSlug" in props && requestedVariationId && !selectedVariation) {
    const directSchubert = await fetchSchubertTrackByKey(requestedVariationId).catch(() => null);
    selectedVariation =
      directSchubert ??
      ((await fetchBeethovenVariationByTrackIdFromServer(requestedVariationId).catch(() => null)) as
        | (typeof selectedVariation)
        | null);
  }
  const resolvedTrack = selectedVariation ?? track;

  const pairFromDoc = resolveCifraSlugPairFromTrack(track);
  const lyricsSource = resolveLyricsSource(resolvedTrack);
  const mp3Id =
    typeof resolvedTrack.trackId === "string" && resolvedTrack.trackId.trim()
      ? resolvedTrack.trackId.trim()
      : "";

  const fromSchubert = schubertTrackToDemoPayload(resolvedTrack as SchubertTrackJson);
  const initialPayload = normalizeDemoPayload({
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
  const subtitle = `${artist} · edição de cifra · ${schubertLyricsSourceEditorLabel(lyricsSource)}`;
  const durationLabel = formatDurationClock(resolveDurationSeconds(resolvedTrack));

  const slugForShell =
    pairFromDoc ??
    ("artistSlug" in props
      ? { artistSlug: props.artistSlug.trim(), songSlug: props.songSlug.trim() }
      : null);

  const variationMeta =
    typeof resolvedTrack.variationOfTrackId === "string" && resolvedTrack.variationOfTrackId.trim() && mp3Id
      ? {
          variationTrackKey: mp3Id,
          initialLabel:
            typeof resolvedTrack.variationLabel === "string" ? resolvedTrack.variationLabel.trim() : "",
          source: isBeethovenVariationResolved(resolvedTrack, mp3Id, beethovenVariations)
            ? ("beethoven" as const)
            : ("schubert" as const),
        }
      : undefined;

  if (slugForShell) {
    return (
      <CifraEditShell
        user={user}
        billingPlan={billingPlan}
        patchMode="slug"
        artistSlug={slugForShell.artistSlug}
        songSlug={slugForShell.songSlug}
        lyricsSource={lyricsSource}
        initialPayload={initialPayload}
        title={title}
        subtitle={subtitle}
        durationLabel={durationLabel}
        variationMeta={variationMeta}
      />
    );
  }

  const fallbackKey =
    "trackKey" in props
      ? props.trackKey.trim()
      : typeof resolvedTrack.trackId === "string"
        ? resolvedTrack.trackId.trim()
        : "";
  if (!fallbackKey) {
    notFound();
  }

  return (
    <CifraEditShell
      user={user}
      billingPlan={billingPlan}
      patchMode="key"
      trackKey={fallbackKey}
      lyricsSource={lyricsSource}
      initialPayload={initialPayload}
      title={title}
      subtitle={subtitle}
      durationLabel={durationLabel}
      variationMeta={variationMeta}
    />
  );
}

