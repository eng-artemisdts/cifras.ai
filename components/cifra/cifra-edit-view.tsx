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
import { getAuth0SessionCached } from "@/lib/auth0";
import { appLoginHref } from "@/lib/auth0-routes";
import { isAuth0Configured } from "@/lib/auth0-env";
import type { SchubertLyricsSource } from "@/lib/schubert-api";
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

export type CifraEditViewProps =
  | { artistSlug: string; songSlug: string }
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

  const pairFromDoc = resolveCifraSlugPairFromTrack(track);
  const lyricsSource = resolveLyricsSource(track);
  const mp3Id =
    typeof track.trackId === "string" && track.trackId.trim() ? track.trackId.trim() : "";

  const fromSchubert = schubertTrackToDemoPayload(track);
  const initialPayload = normalizeDemoPayload({
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
  const subtitle = `${artist} · edição de cifra · ${schubertLyricsSourceEditorLabel(lyricsSource)}`;
  const durationLabel = formatDurationClock(resolveDurationSeconds(track));

  const slugForShell =
    pairFromDoc ??
    ("artistSlug" in props
      ? { artistSlug: props.artistSlug.trim(), songSlug: props.songSlug.trim() }
      : null);

  if (slugForShell) {
    return (
      <CifraEditShell
        user={user}
        patchMode="slug"
        artistSlug={slugForShell.artistSlug}
        songSlug={slugForShell.songSlug}
        lyricsSource={lyricsSource}
        initialPayload={initialPayload}
        title={title}
        subtitle={subtitle}
        durationLabel={durationLabel}
      />
    );
  }

  const fallbackKey =
    "trackKey" in props ? props.trackKey.trim() : typeof track.trackId === "string" ? track.trackId.trim() : "";
  if (!fallbackKey) {
    notFound();
  }

  return (
    <CifraEditShell
      user={user}
      patchMode="key"
      trackKey={fallbackKey}
      lyricsSource={lyricsSource}
      initialPayload={initialPayload}
      title={title}
      subtitle={subtitle}
      durationLabel={durationLabel}
    />
  );
}

