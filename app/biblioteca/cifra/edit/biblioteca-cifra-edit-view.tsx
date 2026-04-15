import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BibliotecaCifraEditShell } from "@/components/cifra/biblioteca-cifra-edit-shell";
import { normalizeDemoPayload } from "@/lib/cifra/normalize-payload";
import type { SchubertLyricsVariant } from "@/lib/cifra/schubert-to-payload";
import {
  resolveArtistNameFromSchubertTrack,
  schubertTrackToDemoPayload,
} from "@/lib/cifra/schubert-to-payload";
import { getAuth0SessionCached } from "@/lib/auth0";
import { auth0LoginHref } from "@/lib/auth0-routes";
import { isAuth0Configured } from "@/lib/auth0-env";
import type { BibliotecaCifraLyricsPath } from "@/lib/library/biblioteca-cifra-href";
import { bibliotecaCifraEditHref } from "@/lib/library/biblioteca-cifra-href";
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

function lyricsPathFromParam(v: string | undefined): BibliotecaCifraLyricsPath {
  return v === "m" ? "m" : "a";
}

function lyricsVariantFromPath(p: BibliotecaCifraLyricsPath): SchubertLyricsVariant {
  return p === "m" ? "match" : "ai";
}

type Props = {
  trackId: string;
  lyricsPath: BibliotecaCifraLyricsPath;
};

export async function BibliotecaCifraEditView({ trackId, lyricsPath }: Props) {
  if (!isAuth0Configured()) {
    notFound();
  }

  const session = await getAuth0SessionCached();
  if (!session?.user) {
    redirect(
      auth0LoginHref({
        returnTo: bibliotecaCifraEditHref(trackId, lyricsPath),
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

  const variant = lyricsVariantFromPath(lyricsPath);
  const fromSchubert = schubertTrackToDemoPayload(track, variant);
  const initialPayload = normalizeDemoPayload({
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
  const subtitle = `${artist} · edição de cifra · ${variant === "match" ? "letra match" : "letra IA"}`;
  const durationLabel = formatDurationClock(resolveDurationSeconds(track));

  return (
    <BibliotecaCifraEditShell
      user={user}
      trackId={trackId}
      lyricsPath={lyricsPath}
      initialPayload={initialPayload}
      title={title}
      subtitle={subtitle}
      durationLabel={durationLabel}
    />
  );
}

export function resolveLyricsPathFromSearch(v: string | undefined): BibliotecaCifraLyricsPath {
  return lyricsPathFromParam(v);
}
