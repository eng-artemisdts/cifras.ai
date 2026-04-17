import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";

import { CifraSheetPageView } from "@/components/cifra/cifra-sheet-page-view";
import { normalizeDemoPayload } from "@/lib/cifra/normalize-payload";
import type { SchubertLyricsVariant } from "@/lib/cifra/schubert-to-payload";
import {
  resolveArtistNameFromSchubertTrack,
  schubertTrackToDemoPayload,
} from "@/lib/cifra/schubert-to-payload";
import { getAuth0SessionCached } from "@/lib/auth0";
import { auth0LoginHref } from "@/lib/auth0-routes";
import { isAuth0Configured } from "@/lib/auth0-env";
import { registerLibraryTrackAccess } from "@/lib/library/beethoven-tracks";
import type { BibliotecaCifraLyricsPath } from "@/lib/library/biblioteca-cifra-href";
import { bibliotecaCifraHref } from "@/lib/library/biblioteca-cifra-href";
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

function lyricsVariantLabel(v: SchubertLyricsVariant): string {
  return v === "match" ? "letra alinhada (match)" : "letra IA";
}

type Props = {
  trackId: string;
  lyricsVariant: SchubertLyricsVariant;
  lyricsPath: BibliotecaCifraLyricsPath;
};

export async function BibliotecaCifraTrackView({ trackId, lyricsVariant, lyricsPath }: Props) {
  if (!isAuth0Configured()) {
    notFound();
  }

  const session = await getAuth0SessionCached();
  if (!session?.user) {
    redirect(
      auth0LoginHref({
        returnTo: bibliotecaCifraHref(trackId, lyricsPath),
      }),
    );
  }

  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    picture: session.user.picture ?? null,
  };

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
    notFound();
  }

  const fromSchubert = schubertTrackToDemoPayload(track, lyricsVariant);
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
  const subtitle = `${artist} · cifra sincronizada (Schubert) · ${lyricsVariantLabel(lyricsVariant)}`;
  const durationLabel = formatDurationClock(resolveDurationSeconds(track));

  if (session.user.sub) {
    // Melhor esforço: não bloqueia a renderização caso o Beethoven esteja indisponível.
    await registerLibraryTrackAccess({ userId: session.user.sub, trackKey: trackId }).catch(() => { });
  }

  return (
    <CifraSheetPageView
      user={user}
      trackKey={`${trackId}:${lyricsPath}`}
      title={title}
      subtitle={subtitle}
      durationLabel={durationLabel}
      payload={payload}
    />
  );
}
