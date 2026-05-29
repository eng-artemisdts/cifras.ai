"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { ChevronRight, Library, Link2, ListMusic, Loader2, Music2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ChordFoundAccessDialog } from "@/components/library/chord-found-access-dialog";
import type { ExistingChordDialogLayout } from "@/components/library/library-import-dialog-layout";
import { RecognizedMusicConfirmDialog } from "@/components/library/recognized-music-confirm-dialog";
import { fetchMyBeethovenVariationByBaseTrackIdFromBrowser } from "@/lib/beethoven-variations";
import { cifraEditHref, resolveCifraSlugPairFromTrack } from "@/lib/cifra/cifra-routes";
import type { StreamingLinkImportPanelConfig } from "@/lib/library/streaming-link-import-config";
import type { SpotifyImportPrefill } from "@/lib/library/spotify-import-storage";
import { useIngestJobs } from "@/components/providers/ingest-jobs-context";
import {
  mapRecognizedSongToChordPreview,
  mapSchubertMatchToChordPreview,
  postSpotifySourceIngest,
  SchubertIdentifyError,
  type ChordFoundPreview,
} from "@/lib/schubert-identify-service";
import type { SchubertRecognizedSong } from "@/lib/schubert-identify-types";
import { fetchSchubertFromBrowser, type SchubertTrackJson } from "@/lib/schubert-api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function extractSpotifyTrackId(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const fromUrl = /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]+)/i.exec(t);
  if (fromUrl?.[1]) return fromUrl[1];
  if (/^[a-zA-Z0-9]{22}$/.test(t)) return t;
  return null;
}

async function buildPrefillFromTrackId(trackId: string): Promise<SpotifyImportPrefill> {
  try {
    const res = await fetch(`/api/spotify/tracks/${encodeURIComponent(trackId)}`, {
      credentials: "include",
    });
    if (res.ok) {
      const j = (await res.json()) as SpotifyImportPrefill & { durationMs?: number };
      return {
        trackId: j.trackId,
        title: j.title,
        artistLine: j.artistLine,
        album: j.album,
        coverUrl: j.coverUrl,
        previewUrl: j.previewUrl ?? null,
      };
    }
  } catch {
    /* fallback oEmbed */
  }
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${trackId}`)}`;
  const oe = await fetch(oembedUrl);
  const j = (await oe.json()) as { title?: string; thumbnail_url?: string };
  const title = typeof j.title === "string" ? j.title : "";
  return {
    trackId,
    title,
    artistLine: "",
    album: "",
    coverUrl: typeof j.thumbnail_url === "string" ? j.thumbnail_url : null,
  };
}

type PlaylistRow = { id: string; name: string; imageUrl: string | null; trackCount: number };
type TrackRow = {
  id: string;
  name: string;
  artistLine: string;
  album: string;
  durationMs: number;
  coverUrl: string | null;
  /** MP3 preview (~30 s) da Spotify Web API, quando existir. */
  previewUrl?: string | null;
  importable?: boolean;
};

function trackRowToSong(tr: TrackRow): SchubertRecognizedSong {
  return {
    title: tr.name,
    artist: tr.artistLine,
    album: tr.album,
    release_date: "",
    label: "",
    timecode: "",
    song_link: `https://open.spotify.com/track/${tr.id}`,
    spotify_track_id: tr.id,
    spotify_artist_ids: [],
    cover_image_url: tr.coverUrl ?? "",
    ...(Number.isFinite(tr.durationMs) && tr.durationMs > 0 ? { duration_ms: tr.durationMs } : {}),
    ...(tr.previewUrl?.trim() ? { spotify_preview_url: tr.previewUrl.trim() } : {}),
  };
}

function prefillToRecognizedSong(p: SpotifyImportPrefill): SchubertRecognizedSong {
  return {
    title: p.title,
    artist: p.artistLine,
    album: p.album ?? "",
    release_date: "",
    label: "",
    timecode: "",
    song_link: `https://open.spotify.com/track/${p.trackId}`,
    spotify_track_id: p.trackId,
    spotify_artist_ids: [],
    cover_image_url: p.coverUrl ?? "",
    ...(p.previewUrl?.trim() ? { spotify_preview_url: p.previewUrl.trim() } : {}),
  };
}

/** Refresca `preview_url` via BFF quando a lista de playlist não o tinha. */
async function enrichSongWithSpotifyTrackApi(
  song: SchubertRecognizedSong,
  trackId: string,
): Promise<SchubertRecognizedSong> {
  if (song.spotify_preview_url?.trim()) return song;
  try {
    const r = await fetch(`/api/spotify/tracks/${encodeURIComponent(trackId)}`, {
      credentials: "include",
    });
    if (!r.ok) return song;
    const j = (await r.json()) as { previewUrl?: string | null };
    const p = typeof j.previewUrl === "string" ? j.previewUrl.trim() : "";
    if (p) return { ...song, spotify_preview_url: p };
  } catch {
    /* ignore */
  }
  return song;
}

function isTrackOwner(track: Record<string, unknown>, sub?: string | null): boolean {
  if (!sub?.trim()) return false;
  const owner =
    typeof track.owner === "string" && track.owner.trim()
      ? track.owner.trim()
      : typeof track.userId === "string" && track.userId.trim()
        ? track.userId.trim()
        : "";
  return owner === sub.trim();
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export type SpotifyImportPanelProps = {
  config: StreamingLinkImportPanelConfig;
  proEntitled?: boolean;
  /** Variante visual dos modais (alinhada ao fluxo de importação por ficheiro). */
  existingChordDialogLayout?: ExistingChordDialogLayout;
  className?: string;
};

export function SpotifyImportPanel({
  config,
  proEntitled = false,
  existingChordDialogLayout = "default",
  className,
}: SpotifyImportPanelProps) {
  const { user } = useUser();
  const { registerIngestJob, blockNewIngestIfBusy } = useIngestJobs();
  const router = useRouter();
  const pathname = usePathname();
  const returnToConnect = `${pathname || "/biblioteca/importar/spotify"}`;
  const connectHref = `/api/spotify/connect?returnTo=${encodeURIComponent(returnToConnect)}`;

  const [tab, setTab] = useState<"browse" | "link">("browse");
  const [url, setUrl] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [playlistsOffset, setPlaylistsOffset] = useState(0);
  const [playlistsTotal, setPlaylistsTotal] = useState(0);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);

  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistRow | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [tracksOffset, setTracksOffset] = useState(0);
  const [tracksTotal, setTracksTotal] = useState(0);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksHasMore, setTracksHasMore] = useState(false);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [tracksErrorDetails, setTracksErrorDetails] = useState<string | null>(null);
  const [tracksNeedReconnect, setTracksNeedReconnect] = useState(false);

  const [matchedChordPreview, setMatchedChordPreview] = useState<ChordFoundPreview | null>(null);
  const [matchedChordOpen, setMatchedChordOpen] = useState(false);
  const [trackLookupLoading, setTrackLookupLoading] = useState(false);
  const [spotifyIngestBusy, setSpotifyIngestBusy] = useState(false);
  const [spotifyIngestError, setSpotifyIngestError] = useState<string | null>(null);

  const [recognitionPreview, setRecognitionPreview] = useState<ChordFoundPreview | null>(null);
  const [recognitionConfirmOpen, setRecognitionConfirmOpen] = useState(false);
  const [pendingSpotifyIngest, setPendingSpotifyIngest] = useState<{
    song: SchubertRecognizedSong;
    trackId: string;
  } | null>(null);

  const proGateActive = Boolean(config.requiresPro && !proEntitled);

  const loadPlaylists = useCallback(async (offset: number, append: boolean) => {
    setPlaylistsLoading(true);
    setPlaylistsError(null);
    try {
      const res = await fetch(`/api/spotify/playlists?limit=20&offset=${offset}`, { credentials: "include" });
      if (res.status === 401) {
        setPlaylistsError("Inicie sessão para ver as suas playlists.");
        setPlaylists([]);
        return;
      }
      if (res.status === 403) {
        setPlaylistsError("Ligue a sua conta Spotify e autorize a leitura de playlists (volte a ligar se já tinha ligado antes).");
        setPlaylists([]);
        return;
      }
      if (!res.ok) {
        setPlaylistsError("Não foi possível carregar playlists.");
        return;
      }
      const json = (await res.json()) as {
        playlists?: PlaylistRow[];
        total?: number;
        offset?: number;
      };
      const next = Array.isArray(json.playlists) ? json.playlists : [];
      setPlaylists((prev) => (append ? [...prev, ...next] : next));
      setPlaylistsTotal(typeof json.total === "number" ? json.total : next.length);
      setPlaylistsOffset(typeof json.offset === "number" ? json.offset : offset);
    } catch {
      setPlaylistsError("Erro de rede ao carregar playlists.");
    } finally {
      setPlaylistsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "browse" || proGateActive) return;
    void loadPlaylists(0, false);
  }, [tab, proGateActive, loadPlaylists]);

  const loadTracks = useCallback(async (playlistId: string, offset: number, append: boolean) => {
    setTracksLoading(true);
    setTracksError(null);
    setTracksErrorDetails(null);
    setTracksNeedReconnect(false);
    try {
      const res = await fetch(
        `/api/spotify/playlists/${encodeURIComponent(playlistId)}/tracks?limit=50&offset=${offset}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        if (res.status === 401) {
          setTracksError("Sessão expirada. Entre novamente para carregar as faixas.");
          return;
        }
        if (res.status === 403) {
          const payload = (await res.json().catch(() => null)) as
            | { error?: string; details?: string }
            | null;
          if (payload?.details) setTracksErrorDetails(payload.details);
          if (payload?.error === "spotify_insufficient_scope" || payload?.error === "spotify_not_connected") {
            setTracksNeedReconnect(true);
            setTracksError("É preciso reconectar o Spotify para autorizar leitura de playlists/faixas.");
            return;
          }
          if (payload?.error === "spotify_playlist_access_denied") {
            setTracksError(
              "Esta playlist não permite leitura desta conta/app no momento (permissão do Spotify). Tente outra playlist.",
            );
            return;
          }
          setTracksError("Permissão negada para esta playlist. Reconecte o Spotify e tente novamente.");
          return;
        }
        setTracksError("Não foi possível carregar faixas desta playlist.");
        return;
      }
      const json = (await res.json()) as {
        tracks?: TrackRow[];
        total?: number;
        offset?: number;
        hasMore?: boolean;
      };
      const next = Array.isArray(json.tracks) ? json.tracks : [];
      setTracks((prev) => (append ? [...prev, ...next] : next));
      setTracksTotal(typeof json.total === "number" ? json.total : next.length);
      setTracksOffset(typeof json.offset === "number" ? json.offset : offset);
      setTracksHasMore(Boolean(json.hasMore));
    } catch {
      setTracksError("Erro de rede ao carregar faixas.");
    } finally {
      setTracksLoading(false);
    }
  }, []);

  const selectPlaylist = useCallback(
    (pl: PlaylistRow) => {
      setSelectedPlaylist(pl);
      setTracks([]);
      setTracksOffset(0);
      void loadTracks(pl.id, 0, false);
    },
    [loadTracks],
  );

  const loadMoreTracks = useCallback(() => {
    if (!selectedPlaylist || tracksLoading || !tracksHasMore) return;
    void loadTracks(selectedPlaylist.id, tracks.length, true);
  }, [selectedPlaylist, tracksLoading, tracksHasMore, tracks.length, loadTracks]);

  const loadMorePlaylists = useCallback(() => {
    if (playlistsLoading || playlists.length >= playlistsTotal) return;
    void loadPlaylists(playlistsOffset + 20, true);
  }, [playlistsLoading, playlists.length, playlistsTotal, playlistsOffset, loadPlaylists]);

  const handleMatchedChordDialogOpenChange = useCallback((open: boolean) => {
    setMatchedChordOpen(open);
    if (!open) setMatchedChordPreview(null);
  }, []);

  const handleRecognitionDialogOpenChange = useCallback((open: boolean) => {
    setRecognitionConfirmOpen(open);
    if (!open) {
      setRecognitionPreview(null);
      setPendingSpotifyIngest(null);
    }
  }, []);

  const runSpotifyIngestFlow = useCallback(
    async (song: SchubertRecognizedSong, spotifyTrackId: string) => {
      setSpotifyIngestError(null);
      setSpotifyIngestBusy(true);
      try {
        if (blockNewIngestIfBusy()) return;
        const ingestResp = await postSpotifySourceIngest({ trackId: spotifyTrackId, meta: song });

        if (ingestResp.status === "completed" && ingestResp.track && typeof ingestResp.track === "object") {
          const resolvedTrack = ingestResp.track as SchubertTrackJson;
          const pair = resolveCifraSlugPairFromTrack(resolvedTrack);
          if (pair) {
            router.push(cifraEditHref(pair.artistSlug, pair.songSlug));
            return;
          }
          const tid =
            typeof resolvedTrack.trackId === "string" && resolvedTrack.trackId.trim()
              ? resolvedTrack.trackId.trim()
              : "";
          if (tid) {
            router.push(`/cifras/edit?trackId=${encodeURIComponent(tid)}`);
            return;
          }
          const q = encodeURIComponent(`${song.title} ${song.artist}`.trim());
          router.push(`/biblioteca?q=${q}`);
          return;
        }

        const jobId = typeof ingestResp.jobId === "string" ? ingestResp.jobId.trim() : "";
        if (!jobId) {
          throw new Error("O servidor não devolveu um jobId de ingestão.");
        }

        const registered = registerIngestJob({
          jobId,
          title: song.title,
          artist: song.artist,
          source: "spotify",
          coverUrl:
            typeof song.cover_image_url === "string" && song.cover_image_url.trim()
              ? song.cover_image_url.trim()
              : null,
        });
        if (!registered) return;
        router.push("/biblioteca/ingestoes");
      } catch (e) {
        const msg =
          e instanceof SchubertIdentifyError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Não foi possível concluir a ingestão.";
        setSpotifyIngestError(msg);
      } finally {
        setSpotifyIngestBusy(false);
      }
    },
    [blockNewIngestIfBusy, registerIngestJob, router],
  );

  const onConfirmSpotifyIngest = useCallback(async () => {
    const p = pendingSpotifyIngest;
    if (!p) return;
    setRecognitionConfirmOpen(false);
    setRecognitionPreview(null);
    setPendingSpotifyIngest(null);
    await runSpotifyIngestFlow(p.song, p.trackId);
  }, [pendingSpotifyIngest, runSpotifyIngestFlow]);

  const onPickTrack = useCallback(
    async (tr: TrackRow) => {
      if (tr.importable === false || trackLookupLoading) return;
      setTrackLookupLoading(true);
      setMatchedChordOpen(false);
      setMatchedChordPreview(null);
      try {
        const res = await fetchSchubertFromBrowser(`tracks/by-key/${encodeURIComponent(tr.id)}`);
        if (res.status === 404) {
          const base = trackRowToSong(tr);
          const song = await enrichSongWithSpotifyTrackApi(base, tr.id);
          setPendingSpotifyIngest({ song, trackId: tr.id });
          setRecognitionPreview(mapRecognizedSongToChordPreview(song));
          setRecognitionConfirmOpen(true);
          return;
        }
        if (!res.ok) {
          setTracksError("Não foi possível verificar se já existe cifra para esta faixa.");
          return;
        }
        const trackJson = (await res.json()) as Record<string, unknown>;
        const song = trackRowToSong(tr);
        const preview = mapSchubertMatchToChordPreview(trackJson, song);
        const matchedTrack = trackJson as { trackId?: unknown };
        const resolvedTrackId =
          typeof matchedTrack.trackId === "string" && matchedTrack.trackId.trim()
            ? matchedTrack.trackId.trim()
            : null;
        const canEditTrack = isTrackOwner(trackJson, user?.sub);
        let editHref = preview.editHref;
        if (resolvedTrackId && !canEditTrack) {
          const ownedVariation = await fetchMyBeethovenVariationByBaseTrackIdFromBrowser(resolvedTrackId).catch(
            () => null,
          );
          const ownedVariationTrackId =
            ownedVariation && typeof ownedVariation.trackId === "string" ? ownedVariation.trackId.trim() : "";
          if (ownedVariationTrackId && preview.editHref) {
            editHref = `${preview.editHref}?v=${encodeURIComponent(ownedVariationTrackId)}`;
          }
        }
        setMatchedChordPreview({
          ...preview,
          editHref,
        });
        setMatchedChordOpen(true);
      } catch {
        setTracksError("Não foi possível verificar se já existe cifra para esta faixa.");
      } finally {
        setTrackLookupLoading(false);
      }
    },
    [trackLookupLoading, user],
  );

  const onContinueLink = useCallback(async () => {
    setLinkError(null);
    const id = extractSpotifyTrackId(url);
    if (!id) {
      setLinkError("Cole um URL de faixa open.spotify.com/track/… ou o ID da faixa.");
      return;
    }
    setLinkBusy(true);
    try {
      const prefill = await buildPrefillFromTrackId(id);
      let song = prefillToRecognizedSong(prefill);
      song = await enrichSongWithSpotifyTrackApi(song, prefill.trackId);
      setPendingSpotifyIngest({ song, trackId: prefill.trackId });
      setRecognitionPreview(mapRecognizedSongToChordPreview(song));
      setRecognitionConfirmOpen(true);
    } catch {
      setLinkError("Não foi possível ler esta faixa. Verifique o link ou ligue o Spotify.");
    } finally {
      setLinkBusy(false);
    }
  }, [url]);

  const showLoadMorePlaylistsButton = playlists.length < playlistsTotal;

  const browseHint = useMemo(
    () =>
      "Escolha uma playlist e uma faixa. Se ainda não existir cifra, a plataforma obtém o áudio e corre a IA — acompanhe em «Ingestões» sem bloquear esta página.",
    [],
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 md:gap-4", className)}>
      {spotifyIngestBusy ? (
        <div
          className="fixed bottom-6 left-1/2 z-[120] flex max-w-[min(100vw-2rem,420px)] -translate-x-1/2 items-center gap-2 rounded-full border border-cifra-teal/35 bg-cifra-bg/95 px-4 py-2.5 text-[11px] text-cifra-text shadow-lg backdrop-blur-sm"
          role="status"
        >
          <Loader2 className="size-4 shrink-0 animate-spin text-cifra-teal" aria-hidden />
          A enviar pedido de ingestão…
        </div>
      ) : null}
      {spotifyIngestError ? (
        <div className="fixed bottom-6 left-1/2 z-[120] max-w-[min(100vw-2rem,420px)] -translate-x-1/2 rounded-xl border border-red-400/40 bg-red-950/90 px-4 py-3 text-[11px] leading-snug text-red-100 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <span>{spotifyIngestError}</span>
            <button
              type="button"
              onClick={() => setSpotifyIngestError(null)}
              className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200 hover:bg-white/10"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
      {recognitionPreview ? (
        <RecognizedMusicConfirmDialog
          open={recognitionConfirmOpen}
          onOpenChange={handleRecognitionDialogOpenChange}
          songTitle={recognitionPreview.songTitle}
          artistName={recognitionPreview.artistName}
          coverImageUrl={recognitionPreview.coverImageUrl}
          copyVariant="spotify"
          montarComIaHref={null}
          primaryMontarSemHrefLabel="Criar cifra"
          onMontarComIaSemHref={onConfirmSpotifyIngest}
          onNotThisMusic={() => handleRecognitionDialogOpenChange(false)}
          layout={existingChordDialogLayout}
        />
      ) : null}
      {matchedChordPreview ? (
        <ChordFoundAccessDialog
          open={matchedChordOpen}
          onOpenChange={handleMatchedChordDialogOpenChange}
          songTitle={matchedChordPreview.songTitle}
          artistName={matchedChordPreview.artistName}
          coverImageUrl={matchedChordPreview.coverImageUrl}
          chordHref={matchedChordPreview.chordHref}
          editHref={matchedChordPreview.editHref}
          canCreateVariation={false}
          creatingVariation={false}
          layout={existingChordDialogLayout}
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 shrink-0 text-cifra-teal" strokeWidth={1.75} aria-hidden />
          <h2 className="text-xs font-semibold leading-none text-cifra-text">{config.rowTopTitle}</h2>
        </div>
        <p className="text-right font-mono text-[10px] leading-tight text-cifra-teal">{config.rowTopMonoHint}</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 md:gap-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-cifra-border bg-cifra-surface">
          <div className="h-1 w-full shrink-0 bg-cifra-teal" aria-hidden />
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 px-5 py-3">
            <span className="font-mono text-[10px] tracking-[0.2em] text-cifra-muted">{config.cardTag}</span>
            <span className="max-w-[min(100%,260px)] text-right font-mono text-[9px] leading-snug text-cifra-muted">
              Playlists da conta · ou cole um link
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-5 pb-4 pt-4">
            {proGateActive ? (
              <div className="flex items-start gap-2 rounded-xl border border-cifra-gold/40 bg-cifra-gold/10 px-3.5 py-2.5 text-[11px] leading-snug text-cifra-gold">
                <span>
                  Exclusivo <span className="font-mono font-semibold">Pro</span> — faça upgrade para importar desta
                  origem.
                </span>
              </div>
            ) : null}

            <div className="flex gap-1 rounded-lg border border-white/10 bg-[#0c0c14] p-1">
              <button
                type="button"
                onClick={() => setTab("browse")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-semibold transition",
                  tab === "browse" ? "bg-cifra-teal text-cifra-bg" : "text-cifra-muted hover:text-cifra-text",
                )}
              >
                <ListMusic className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                Minhas playlists
              </button>
              <button
                type="button"
                onClick={() => setTab("link")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-semibold transition",
                  tab === "link" ? "bg-cifra-teal text-cifra-bg" : "text-cifra-muted hover:text-cifra-text",
                )}
              >
                <Link2 className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                Colar link
              </button>
            </div>

            {tab === "browse" ? (
              <div className="flex min-h-0 flex-col gap-3 sm:min-h-[320px] lg:h-[380px] lg:min-h-[380px] lg:flex-row lg:gap-4">
                <div className="flex max-h-[min(280px,48vh)] min-h-0 min-w-0 shrink-0 flex-col overflow-hidden rounded-xl border border-white/8 bg-[#0c0c14] lg:max-h-none lg:h-full lg:max-w-[min(100%,280px)] lg:shrink lg:flex-1">
                  <div className="flex shrink-0 items-center gap-2 border-b border-white/8 px-3 py-2">
                    <Library className="size-4 text-cifra-teal" strokeWidth={1.75} aria-hidden />
                    <span className="text-[11px] font-semibold text-cifra-text">Playlists</span>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col">
                    <ScrollArea className="min-h-0 flex-1 px-1 pt-1">
                      {playlistsError ? (
                        <div className="space-y-2 px-2 py-2">
                          <p className="text-[11px] leading-snug text-cifra-muted">{playlistsError}</p>
                          <Link
                            href={connectHref}
                            className="inline-flex rounded-full bg-cifra-teal px-3 py-1.5 text-[11px] font-semibold text-cifra-bg"
                          >
                            Ligar Spotify
                          </Link>
                        </div>
                      ) : null}
                      {!playlistsError && playlistsLoading && playlists.length === 0 ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-[11px] text-cifra-muted">
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          A carregar…
                        </div>
                      ) : null}
                      <ul className="space-y-0.5 pb-1">
                        {playlists.map((pl) => (
                          <li key={pl.id}>
                            <button
                              type="button"
                              onClick={() => selectPlaylist(pl)}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] transition",
                                selectedPlaylist?.id === pl.id
                                  ? "bg-cifra-teal/15 text-cifra-text"
                                  : "text-cifra-text hover:bg-white/6",
                              )}
                            >
                              <div className="relative size-9 shrink-0 overflow-hidden rounded bg-[#16162a]">
                                {pl.imageUrl ? (
                                  <Image src={pl.imageUrl} alt="" fill className="object-cover" sizes="36px" />
                                ) : (
                                  <Music2 className="absolute inset-0 m-auto size-4 text-cifra-muted" strokeWidth={1.5} />
                                )}
                              </div>
                              <span className="min-w-0 flex-1 truncate font-medium">{pl.name}</span>
                              <ChevronRight className="size-4 shrink-0 text-cifra-muted" strokeWidth={1.75} aria-hidden />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                    {showLoadMorePlaylistsButton ? (
                      <div className="shrink-0 border-t border-white/8 px-2 pb-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={loadMorePlaylists}
                          disabled={playlistsLoading}
                          className="h-auto w-full gap-1.5 border-white/10 bg-transparent py-2 text-[10px] font-semibold text-cifra-teal hover:bg-white/5"
                        >
                          {playlistsLoading ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" aria-hidden />
                              A carregar…
                            </>
                          ) : (
                            "Carregar mais playlists"
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex min-h-[min(280px,48vh)] min-w-0 flex-[1.25] flex-col overflow-hidden rounded-xl border border-white/8 bg-[#0c0c14] lg:min-h-0 lg:h-full">
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/8 px-3 py-2">
                    <span className="min-w-0 truncate text-[11px] font-semibold text-cifra-text">
                      {selectedPlaylist ? selectedPlaylist.name : "Faixas"}
                    </span>
                    {selectedPlaylist ? (
                      <span className="shrink-0 font-mono text-[9px] text-cifra-muted">
                        {tracksTotal || selectedPlaylist.trackCount} faixas
                      </span>
                    ) : null}
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col">
                    <ScrollArea className="min-h-0 flex-1 px-1 pt-1">
                      {!selectedPlaylist ? (
                        <p className="px-3 py-8 text-center text-[11px] leading-relaxed text-cifra-muted">
                          Selecione uma playlist para ver as músicas.
                        </p>
                      ) : tracksError ? (
                        <div className="space-y-2 px-3 py-6">
                          <p className="text-[11px] text-red-300/90">{tracksError}</p>
                          {process.env.NODE_ENV === "development" && tracksErrorDetails ? (
                            <details className="rounded-md border border-white/10 bg-[#12121f] px-2.5 py-2">
                              <summary className="cursor-pointer text-[10px] font-semibold text-cifra-muted">
                                Mostrar detalhes técnicos
                              </summary>
                              <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-cifra-muted">
                                {tracksErrorDetails}
                              </pre>
                            </details>
                          ) : null}
                          {tracksNeedReconnect ? (
                            <Link
                              href={connectHref}
                              className="inline-flex rounded-full bg-cifra-teal px-3 py-1.5 text-[11px] font-semibold text-cifra-bg"
                            >
                              Reconectar Spotify
                            </Link>
                          ) : null}
                        </div>
                      ) : tracksLoading && tracks.length === 0 ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-[11px] text-cifra-muted">
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          A carregar faixas…
                        </div>
                      ) : (
                        <ul className="space-y-0.5 pb-1">
                          {tracks.map((tr) => (
                            <li key={`${selectedPlaylist.id}-${tr.id}-${tr.name}`}>
                              <button
                                type="button"
                                disabled={tr.importable === false || trackLookupLoading}
                                onClick={() => void onPickTrack(tr)}
                                className={cn(
                                  "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-[11px] text-cifra-text transition",
                                  tr.importable === false
                                    ? "cursor-not-allowed opacity-55"
                                    : "hover:bg-cifra-teal/12",
                                )}
                              >
                                <div className="relative mt-0.5 size-10 shrink-0 overflow-hidden rounded bg-[#16162a]">
                                  {tr.coverUrl ? (
                                    <Image src={tr.coverUrl} alt="" fill className="object-cover" sizes="40px" />
                                  ) : (
                                    <Music2 className="absolute inset-0 m-auto size-4 text-cifra-muted" strokeWidth={1.5} />
                                  )}
                                </div>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-semibold">{tr.name}</span>
                                  <span className="block truncate text-[10px] text-cifra-muted">{tr.artistLine}</span>
                                  {tr.importable === false ? (
                                    <span className="block truncate text-[10px] text-cifra-muted/80">
                                      Item indisponível para importação via API.
                                    </span>
                                  ) : null}
                                </span>
                                <span className="shrink-0 font-mono text-[10px] tabular-nums text-cifra-muted">
                                  {formatMs(tr.durationMs)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </ScrollArea>
                    {selectedPlaylist && tracksHasMore ? (
                      <div className="shrink-0 border-t border-white/8 px-2 pb-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={loadMoreTracks}
                          disabled={tracksLoading}
                          className="h-auto w-full gap-1.5 border-white/10 bg-transparent py-2 text-[10px] font-semibold text-cifra-teal hover:bg-white/5 disabled:opacity-45"
                        >
                          {tracksLoading ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" aria-hidden />
                              A carregar…
                            </>
                          ) : (
                            "Carregar mais faixas"
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {config.instructions.slice(0, 2).map((line, i) => (
                  <p key={i} className="text-xs leading-normal text-cifra-text">
                    {line}
                  </p>
                ))}
                <div className="rounded-lg bg-[#12121f] px-3.5 py-3">
                  <p className="font-mono text-[9px] tracking-wide text-cifra-muted">Exemplos de URL</p>
                  <pre className="mt-1.5 whitespace-pre-wrap break-all font-mono text-[10px] leading-[1.55] text-cifra-teal">
                    {config.exampleUrls}
                  </pre>
                </div>
                <div>
                  <label className="sr-only" htmlFor="spotify-import-url">
                    URL
                  </label>
                  <input
                    id="spotify-import-url"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    placeholder={config.urlPlaceholder}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full rounded-lg border border-cifra-border bg-cifra-surface-2 px-3 py-2.5 text-[13px] text-cifra-text placeholder:text-cifra-muted outline-none ring-cifra-teal/30 focus:border-cifra-teal focus:ring-2"
                  />
                </div>
                {linkError ? <p className="text-[11px] text-red-300/90">{linkError}</p> : null}
                <button
                  type="button"
                  disabled={linkBusy || !url.trim() || proGateActive}
                  onClick={() => void onContinueLink()}
                  className="rounded-lg bg-cifra-teal px-4 py-2 text-[11px] font-semibold text-cifra-bg transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {linkBusy ? "A iniciar…" : "Gerar cifra com IA"}
                </button>
              </div>
            )}

            {tab === "browse" ? (
              <p className="rounded-lg border border-white/8 bg-[#12121f]/80 px-3 py-2 text-[10px] leading-relaxed text-cifra-muted">
                {browseHint}
              </p>
            ) : null}

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/biblioteca/importar"
                className="text-[11px] font-medium text-cifra-teal transition-colors hover:text-cifra-teal-hover"
              >
                ← Voltar para escolher outra origem
              </Link>
              <Link
                href="/biblioteca/importar/arquivo"
                className="text-[11px] font-medium text-cifra-muted transition-colors hover:text-cifra-text"
              >
                Já tenho o áudio · Ir para enviar ficheiro →
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-px overflow-hidden rounded-xl border border-cifra-border bg-cifra-border sm:grid-cols-3">
          {config.metaColumns.map((col) => (
            <div
              key={col.title}
              className="bg-cifra-surface-2 px-4 py-3 sm:border-r sm:border-white/6 last:sm:border-r-0"
            >
              <p
                className={cn(
                  "text-[10px] font-semibold leading-tight",
                  col.titleVariant === "gold" ? "text-cifra-gold" : "text-cifra-text",
                )}
              >
                {col.title}
              </p>
              <p className="mt-1.5 text-[10px] leading-[1.4] text-cifra-muted">{col.body}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2.5 pt-0.5">
          <p className="text-[10px] leading-[1.45] text-cifra-muted">{config.hint}</p>
        </div>
      </div>
    </div>
  );
}
