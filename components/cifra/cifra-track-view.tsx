import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";

import { CifraSheetPageView } from "@/components/cifra/cifra-sheet-page-view";
import { normalizeDemoPayload } from "@/lib/cifra/normalize-payload";
import { cifraHref } from "@/lib/cifra/cifra-routes";
import {
  resolveArtistNameFromSchubertTrack,
  schubertLyricsSourceLabel,
  schubertTrackToDemoPayload,
} from "@/lib/cifra/schubert-to-payload";
import { getAuth0SessionCached } from "@/lib/auth0";
import { auth0LoginHref } from "@/lib/auth0-routes";
import { isAuth0Configured } from "@/lib/auth0-env";
import { registerLibraryTrackAccess } from "@/lib/library/beethoven-tracks";
import { publicMp3UrlForTrackId } from "@/lib/media/public-mp3-for-track";
import { fetchSchubertTrackByKey } from "@/lib/schubert-fetch-track";

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

type Props = {
  trackId: string;
};

/**
 * Visualização pública da cifra em `/cifra` (rota fora do bloqueio da biblioteca).
 * A carga da faixa continua a exigir sessão na Schubert; visitantes vêem convite a entrar.
 */
export async function CifraTrackView({ trackId }: Props) {
  if (!isAuth0Configured()) {
    notFound();
  }

  const session = await getAuth0SessionCached();
  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        picture: session.user.picture ?? null,
      }
    : null;

  let track: Awaited<ReturnType<typeof fetchSchubertTrackByKey>>;

  try {
    track = await fetchSchubertTrackByKey(trackId);
  } catch (error) {
    unstable_rethrow(error);
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-cifra-bg px-6 text-center">
        <p className="max-w-md text-sm text-cifra-muted">
          Não foi possível contactar a Schubert API com a sua sessão. Verifique a rede e as variáveis de ambiente,
          ou tente novamente mais tarde.
        </p>
        <Link href="/biblioteca/importar/arquivo" className="text-sm font-semibold text-cifra-teal">
          Voltar à importação
        </Link>
      </div>
    );
  }

  if (!track) {
    if (!session?.user) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cifra-bg px-6 text-center text-cifra-text">
          <p className="max-w-md text-sm text-cifra-muted">
            Inicie sessão para carregar esta cifra a partir da Schubert.
          </p>
          <Link
            href={auth0LoginHref({ returnTo: cifraHref(trackId) })}
            className="rounded-full bg-cifra-teal px-5 py-2 text-sm font-semibold text-cifra-bg transition-opacity hover:opacity-95"
          >
            Entrar
          </Link>
        </div>
      );
    }
    notFound();
  }

  const fromSchubert = schubertTrackToDemoPayload(track);
  const payload = normalizeDemoPayload({
    ...fromSchubert,
    meta: {
      ...fromSchubert.meta,
      audioUrl: publicMp3UrlForTrackId(trackId),
    },
  });

  const title =
    typeof track.name === "string" && track.name.trim()
      ? track.name.trim()
      : (track.meta?.name ?? "Faixa sem título");
  const artist = resolveArtistNameFromSchubertTrack(track);
  const subtitle = `${artist} · cifra sincronizada (Schubert) · ${schubertLyricsSourceLabel(track.lyricsSource)}`;
  const durationLabel = formatDurationClock(resolveDurationSeconds(track));

  if (session?.user?.sub) {
    await registerLibraryTrackAccess({ userId: session.user.sub, trackKey: trackId }).catch(() => {});
  }

  return (
    <CifraSheetPageView
      user={user}
      trackKey={trackId}
      title={title}
      subtitle={subtitle}
      durationLabel={durationLabel}
      payload={payload}
    />
  );
}
