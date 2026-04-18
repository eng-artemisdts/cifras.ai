import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";

import { CifraSheetPageView } from "@/components/cifra/cifra-sheet-page-view";
import { cifraHref, resolveCifraSlugPairFromTrack } from "@/lib/cifra/cifra-routes";
import { normalizeDemoPayload } from "@/lib/cifra/normalize-payload";
import {
  resolveArtistNameFromSchubertTrack,
  schubertLyricsSourceLabel,
  schubertTrackToDemoPayload,
} from "@/lib/cifra/schubert-to-payload";
import { getAuth0SessionCached } from "@/lib/auth0";
import { registerLibraryTrackAccess } from "@/lib/library/beethoven-tracks";
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

export type CifraTrackViewProps =
  | { artistSlug: string; songSlug: string }
  | { trackKey: string };

/**
 * Visualização pública da cifra em `/cifras/...` (rota fora do bloqueio da biblioteca).
 */
export async function CifraTrackView(props: CifraTrackViewProps) {
  const session = await getAuth0SessionCached();
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

  const slugPair = resolveCifraSlugPairFromTrack(track);
  const mp3Id =
    typeof track.trackId === "string" && track.trackId.trim() ? track.trackId.trim() : "";

  const fromSchubert = schubertTrackToDemoPayload(track);
  const payload = normalizeDemoPayload({
    ...fromSchubert,
    meta: {
      ...fromSchubert.meta,
      ...(mp3Id ? { audioUrl: publicMp3UrlForTrackId(mp3Id) } : {}),
    },
  });

  const title =
    typeof track.name === "string" && track.name.trim()
      ? track.name.trim()
      : (track.meta?.name ?? "Faixa sem título");
  const artist = resolveArtistNameFromSchubertTrack(track);
  const subtitle = `${artist} · cifra sincronizada (Schubert) · ${schubertLyricsSourceLabel(track.lyricsSource)}`;
  const durationLabel = formatDurationClock(resolveDurationSeconds(track));

  const reactKey =
    slugPair !== null
      ? `${slugPair.artistSlug}/${slugPair.songSlug}`
      : mp3Id || ("artistSlug" in props ? `${props.artistSlug}/${props.songSlug}` : props.trackKey);

  if (session?.user?.sub && mp3Id) {
    await registerLibraryTrackAccess({
      userId: session.user.sub,
      trackKey: mp3Id,
    }).catch(() => {});
  }

  return (
    <CifraSheetPageView
      user={user}
      trackKey={reactKey}
      title={title}
      subtitle={subtitle}
      durationLabel={durationLabel}
      payload={payload}
    />
  );
}
