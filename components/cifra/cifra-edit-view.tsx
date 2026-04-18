import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CifraEditShell } from "@/components/cifra/cifra-edit-shell";
import { normalizeDemoPayload } from "@/lib/cifra/normalize-payload";
import { cifraEditHref } from "@/lib/cifra/cifra-routes";
import {
  resolveArtistNameFromSchubertTrack,
  schubertLyricsSourceEditorLabel,
  schubertTrackToDemoPayload,
} from "@/lib/cifra/schubert-to-payload";
import { getAuth0SessionCached } from "@/lib/auth0";
import { auth0LoginHref } from "@/lib/auth0-routes";
import { isAuth0Configured } from "@/lib/auth0-env";
import type { SchubertLyricsSource } from "@/lib/schubert-api";
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

function resolveLyricsSource(track: Awaited<ReturnType<typeof fetchSchubertTrackByKey>>): SchubertLyricsSource {
  if (track && track.lyricsSource === "MATCH") return "MATCH";
  return "AI";
}

type Props = {
  trackId: string;
};

export async function CifraEditView({ trackId }: Props) {
  if (!isAuth0Configured()) {
    notFound();
  }

  const session = await getAuth0SessionCached();
  if (!session?.user) {
    redirect(
      auth0LoginHref({
        returnTo: cifraEditHref(trackId),
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

  const lyricsSource = resolveLyricsSource(track);
  const fromSchubert = schubertTrackToDemoPayload(track);
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
  const subtitle = `${artist} · edição de cifra · ${schubertLyricsSourceEditorLabel(lyricsSource)}`;
  const durationLabel = formatDurationClock(resolveDurationSeconds(track));

  return (
    <CifraEditShell
      user={user}
      trackId={trackId}
      lyricsSource={lyricsSource}
      initialPayload={initialPayload}
      title={title}
      subtitle={subtitle}
      durationLabel={durationLabel}
    />
  );
}
