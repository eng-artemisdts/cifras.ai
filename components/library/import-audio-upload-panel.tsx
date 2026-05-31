"use client";

import {
  AudioLines,
  FolderOpen,
  Lightbulb,
  Music2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import type { DragEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { SchubertRecognizedSong } from "@/lib/schubert-identify-types";
import { fetchMyBeethovenVariationByBaseTrackIdFromBrowser } from "@/lib/beethoven-variations";

import { ChordFoundAccessDialog } from "@/components/library/chord-found-access-dialog";
import type { ExistingChordDialogLayout } from "@/components/library/library-import-dialog-layout";
import { RecognizedMusicConfirmDialog } from "@/components/library/recognized-music-confirm-dialog";
import {
  identifyTrackFromMp3,
  mapRecognizedSongToChordPreview,
  mapSchubertMatchToChordPreview,
  SchubertIdentifyError,
  type ChordFoundPreview,
} from "@/lib/schubert-identify-service";
import {
  emptyRecognizedSong,
  recognizedSongForVariation,
  type ImportMetadataContext,
} from "@/lib/library/import-metadata-context";
import {
  SPOTIFY_IMPORT_PREFILL_STORAGE_KEY,
  type SpotifyImportPrefill,
} from "@/lib/library/spotify-import-storage";
import type { SchubertTrackJson } from "@/lib/schubert-api";
import { cn } from "@/lib/utils";

const ACCEPT = "audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a";
const MAX_BYTES = 50 * 1024 * 1024;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function QueueCoverThumb({ coverUrl }: { coverUrl: string | null | undefined }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [coverUrl]);
  const showImg = Boolean(coverUrl?.trim()) && !broken;
  return (
    <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-[#16162a]">
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL dinâmica (Spotify / Apple)
        <img
          src={coverUrl!.trim()}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <Music2 className="size-[18px] text-cifra-gold" strokeWidth={1.75} aria-hidden />
      )}
    </div>
  );
}

export type QueuedFile = {
  id: string;
  file: File;
};

export type ImportAudioUploadPanelProps = {
  className?: string;
  /** Ao concluir a detecção (ou sem match), envia ao passo de revisão de metadados antes da ingestão/variação. */
  onProceedToMetadata: (ctx: ImportMetadataContext, restoreQueue: QueuedFile[]) => void;
  /** Ao voltar do passo de metadados, repõe o mesmo arquivo na fila. */
  initialQueue?: QueuedFile[];
  /** Variante visual do modal de confirmação da música (alinhada ao frame de variante no Pencil). */
  existingChordDialogLayout?: ExistingChordDialogLayout;
  /** Metadados da faixa escolhida em «Importar · Spotify». */
  fromSpotifyImport?: boolean;
};

export function ImportAudioUploadPanel({
  className,
  onProceedToMetadata,
  initialQueue,
  existingChordDialogLayout = "default",
  fromSpotifyImport = false,
}: ImportAudioUploadPanelProps) {
  const inputId = useId();
  const addInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueuedFile[]>(() => initialQueue ?? []);
  const [dragOver, setDragOver] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [recognitionConfirmOpen, setRecognitionConfirmOpen] = useState(false);
  const [recognitionPreview, setRecognitionPreview] = useState<ChordFoundPreview | null>(null);
  const [pendingIngest, setPendingIngest] = useState<{ file: File; song: SchubertRecognizedSong } | null>(
    null,
  );
  const [matchedChordPreview, setMatchedChordPreview] = useState<ChordFoundPreview | null>(null);
  const [matchedChordOpen, setMatchedChordOpen] = useState(false);
  const [canCreateVariation, setCanCreateVariation] = useState(false);
  const [variationBaseTrackId, setVariationBaseTrackId] = useState<string | null>(null);
  const [variationBaseTrack, setVariationBaseTrack] = useState<SchubertTrackJson | null>(null);
  const [identifyMessage, setIdentifyMessage] = useState<string | null>(null);
  /** Metadados AudD quando a faixa é reconhecida — capa na fila antes ou depois do modal. */
  const [recognizedSong, setRecognizedSong] = useState<SchubertRecognizedSong | null>(null);
  const [spotifyPrefill, setSpotifyPrefill] = useState<SpotifyImportPrefill | null>(null);

  useEffect(() => {
    if (!fromSpotifyImport || typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(SPOTIFY_IMPORT_PREFILL_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SpotifyImportPrefill;
      if (parsed?.trackId?.trim()) {
        setSpotifyPrefill(parsed);
      }
      sessionStorage.removeItem(SPOTIFY_IMPORT_PREFILL_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [fromSpotifyImport]);

  const mergeSpotifyPrefill = useCallback(
    (song: SchubertRecognizedSong): SchubertRecognizedSong => {
      if (!spotifyPrefill) return song;
      const link = `https://open.spotify.com/track/${spotifyPrefill.trackId}`;
      return {
        ...song,
        title: song.title?.trim() || spotifyPrefill.title,
        artist: song.artist?.trim() || spotifyPrefill.artistLine,
        album: song.album?.trim() || spotifyPrefill.album,
        spotify_track_id: spotifyPrefill.trackId,
        song_link: song.song_link?.trim() || link,
        cover_image_url: song.cover_image_url?.trim() || spotifyPrefill.coverUrl || "",
      };
    },
    [spotifyPrefill],
  );

  const ingestLabel =
    queue.length === 0 ? "Nenhum arquivo ainda" : "1 arquivo · pronto para processar";

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = Array.from(list).filter((f) => {
      const okType =
        f.type.startsWith("audio/") || /\.(mp3|wav|m4a)$/i.test(f.name);
      return okType && f.size <= MAX_BYTES;
    });
    const file = incoming[0];
    if (!file) return;
    setIdentifyMessage(null);
    setRecognizedSong(null);
    setRecognitionPreview(null);
    setRecognitionConfirmOpen(false);
    setPendingIngest(null);
    setMatchedChordPreview(null);
    setMatchedChordOpen(false);
    setCanCreateVariation(false);
    setVariationBaseTrackId(null);
    setVariationBaseTrack(null);
    setQueue([
      {
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 9)}`,
        file,
      },
    ]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setRecognizedSong(null);
    setIdentifyMessage(null);
    setRecognitionPreview(null);
    setRecognitionConfirmOpen(false);
    setPendingIngest(null);
    setMatchedChordPreview(null);
    setMatchedChordOpen(false);
    setCanCreateVariation(false);
    setVariationBaseTrackId(null);
    setVariationBaseTrack(null);
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setRecognizedSong(null);
    setIdentifyMessage(null);
    setRecognitionPreview(null);
    setRecognitionConfirmOpen(false);
    setPendingIngest(null);
    setMatchedChordPreview(null);
    setMatchedChordOpen(false);
    setCanCreateVariation(false);
    setVariationBaseTrackId(null);
    setVariationBaseTrack(null);
    setQueue([]);
  }, []);

  const handleRecognitionDialogOpenChange = useCallback((open: boolean) => {
    setRecognitionConfirmOpen(open);
    if (!open) {
      setRecognitionPreview(null);
      setPendingIngest(null);
      setRecognizedSong(null);
    }
  }, []);

  const handleNotThisMusic = useCallback(() => {
    handleRecognitionDialogOpenChange(false);
    clearQueue();
  }, [handleRecognitionDialogOpenChange, clearQueue]);

  const handleMontarComIaSemHref = useCallback(async () => {
    if (!pendingIngest) return;
    setIdentifyMessage(null);
    onProceedToMetadata(
      { file: pendingIngest.file, mode: "ingest", song: mergeSpotifyPrefill(pendingIngest.song) },
      queue,
    );
    handleRecognitionDialogOpenChange(false);
  }, [
    pendingIngest,
    queue,
    mergeSpotifyPrefill,
    onProceedToMetadata,
    handleRecognitionDialogOpenChange,
  ]);

  const handleMatchedChordDialogOpenChange = useCallback((open: boolean) => {
    setMatchedChordOpen(open);
    if (!open) {
      setMatchedChordPreview(null);
      setRecognizedSong(null);
      setCanCreateVariation(false);
      setVariationBaseTrackId(null);
      setVariationBaseTrack(null);
    }
  }, []);

  const handleCreateVariation = useCallback(async () => {
    const baseTrackId = variationBaseTrackId?.trim();
    const baseTrack = variationBaseTrack;
    const file = queue[0]?.file;
    if (!baseTrackId || !baseTrack || !file) return;
    setIdentifyMessage(null);
    onProceedToMetadata(
      {
        file,
        mode: "variation",
        song: recognizedSongForVariation(
          baseTrack,
          recognizedSong ? mergeSpotifyPrefill(recognizedSong) : null,
        ),
        variationBaseTrack: baseTrack,
        variationBaseTrackId: baseTrackId,
      },
      queue,
    );
    handleMatchedChordDialogOpenChange(false);
  }, [
    variationBaseTrackId,
    variationBaseTrack,
    queue,
    recognizedSong,
    mergeSpotifyPrefill,
    onProceedToMetadata,
    handleMatchedChordDialogOpenChange,
  ]);

  const runDetection = useCallback(async () => {
    const item = queue[0];
    if (!item) return;
    setIdentifyMessage(null);
    setRecognizedSong(null);
    setRecognitionPreview(null);
    setRecognitionConfirmOpen(false);
    setPendingIngest(null);
    setMatchedChordPreview(null);
    setMatchedChordOpen(false);
    setCanCreateVariation(false);
    setVariationBaseTrackId(null);
    setVariationBaseTrack(null);
    setDetecting(true);
    try {
      const res = await identifyTrackFromMp3(item.file);
      if (res.recognized && res.song && res.track) {
        const mergedSong = mergeSpotifyPrefill(res.song);
        setRecognizedSong(mergedSong);
        const preview = mapSchubertMatchToChordPreview(res.track, mergedSong);
        const matchedTrack = res.track as { trackId?: unknown };
        const resolvedTrackId =
          typeof matchedTrack.trackId === "string" && matchedTrack.trackId.trim()
            ? matchedTrack.trackId.trim()
            : null;
        const ownedVariation =
          resolvedTrackId && !res.canEditTrack
            ? await fetchMyBeethovenVariationByBaseTrackIdFromBrowser(resolvedTrackId).catch(() => null)
            : null;
        const ownedVariationTrackId =
          ownedVariation && typeof ownedVariation.trackId === "string" ? ownedVariation.trackId.trim() : "";
        setMatchedChordPreview({
          ...preview,
          editHref:
            res.canEditTrack
              ? preview.editHref
              : ownedVariationTrackId && preview.editHref
                ? `${preview.editHref}?v=${encodeURIComponent(ownedVariationTrackId)}`
                : null,
        });
        setVariationBaseTrackId(resolvedTrackId);
        setVariationBaseTrack(res.track as unknown as SchubertTrackJson);
        setCanCreateVariation(Boolean(res.canCreateVariation && resolvedTrackId));
        setMatchedChordOpen(true);
        return;
      }
      if (res.recognized && res.song) {
        const mergedSong = mergeSpotifyPrefill(res.song);
        setRecognizedSong(mergedSong);
        setRecognitionPreview(mapRecognizedSongToChordPreview(mergedSong));
        setPendingIngest({ file: item.file, song: mergedSong });
        setRecognitionConfirmOpen(true);
        return;
      }
      onProceedToMetadata(
        { file: item.file, mode: "ingest", song: mergeSpotifyPrefill(emptyRecognizedSong()) },
        queue,
      );
      return;
    } catch (e) {
      if (e instanceof SchubertIdentifyError) {
        setIdentifyMessage(e.message);
        return;
      }
      setIdentifyMessage("Erro inesperado ao contactar o serviço de identificação.");
    } finally {
      setDetecting(false);
    }
  }, [queue, mergeSpotifyPrefill, onProceedToMetadata]);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  return (
    <div className={cn("flex min-h-0 min-w-0 w-full flex-1 flex-col gap-3 md:gap-4", className)}>
      {matchedChordPreview ? (
        <ChordFoundAccessDialog
          open={matchedChordOpen}
          onOpenChange={handleMatchedChordDialogOpenChange}
          songTitle={matchedChordPreview.songTitle}
          artistName={matchedChordPreview.artistName}
          coverImageUrl={matchedChordPreview.coverImageUrl}
          chordHref={matchedChordPreview.chordHref}
          editHref={matchedChordPreview.editHref}
          onAccessClick={clearQueue}
          canCreateVariation={canCreateVariation}
          creatingVariation={false}
          onCreateVariation={canCreateVariation ? handleCreateVariation : undefined}
          layout={existingChordDialogLayout}
        />
      ) : null}
      {recognitionPreview ? (
        <RecognizedMusicConfirmDialog
          open={recognitionConfirmOpen}
          onOpenChange={handleRecognitionDialogOpenChange}
          songTitle={recognitionPreview.songTitle}
          artistName={recognitionPreview.artistName}
          coverImageUrl={recognitionPreview.coverImageUrl}
          montarComIaHref={null}
          onMontarComIaSemHref={pendingIngest ? handleMontarComIaSemHref : undefined}
          confirmLoading={false}
          onNotThisMusic={handleNotThisMusic}
          onMontarComIaWithHrefClick={clearQueue}
          layout={existingChordDialogLayout}
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AudioLines className="size-4 shrink-0 text-cifra-teal" strokeWidth={1.75} aria-hidden />
          <h2 className="text-xs font-semibold leading-none text-cifra-text">Enviar áudio</h2>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] leading-tight text-cifra-teal">{ingestLabel}</p>
          <p className="mt-0.5 max-w-[min(100%,280px)] text-right font-mono text-[9px] leading-snug text-cifra-muted">
            MP3 · máx. 50 MB
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 md:gap-3">
        {spotifyPrefill ? (
          <div
            role="status"
            className="flex gap-3 rounded-xl border border-[#1db954]/35 bg-[#1db954]/8 px-3 py-2.5"
          >
            <div className="size-11 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/30">
              {spotifyPrefill.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL CDN Spotify
                <img
                  src={spotifyPrefill.coverUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Music2 className="size-5 text-[#1db954]/80" strokeWidth={1.5} aria-hidden />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1db954]">
                Faixa escolhida no Spotify
              </p>
              <p className="truncate text-xs font-semibold text-cifra-text">{spotifyPrefill.title}</p>
              <p className="truncate font-mono text-[10px] text-cifra-muted">{spotifyPrefill.artistLine}</p>
            </div>
          </div>
        ) : null}
        {identifyMessage ? (
          <p
            role="status"
            className="rounded-lg border border-cifra-border bg-cifra-surface-2 px-3 py-2 text-[11px] leading-snug text-cifra-muted"
          >
            {identifyMessage}
          </p>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-cifra-border bg-cifra-surface">
          <div className="h-1 w-full shrink-0 bg-cifra-teal" aria-hidden />
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 px-5 py-3">
            <span className="font-mono text-[10px] tracking-[0.2em] text-cifra-muted">CAPTURA</span>
            <span className="font-mono text-[9px] text-cifra-muted">MP3 · WAV · M4A · máx. 50 MB</span>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label="Abrir seletor de um arquivo de áudio ou soltar o arquivo aqui"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                addInputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className={cn(
              "flex shrink-0 cursor-pointer flex-col items-center gap-1.5 border-b border-white/6 bg-[#12121f] px-4 py-4 text-center transition-colors",
              dragOver && "bg-cifra-teal/8 ring-1 ring-inset ring-cifra-teal/30"
            )}
            onClick={() => addInputRef.current?.click()}
          >
            <Upload className="size-7 text-cifra-teal" strokeWidth={1.5} aria-hidden />
            <p className="text-sm font-medium text-cifra-text">Solte o arquivo aqui ou escolha no disco</p>
            <p className="max-w-63 text-center text-[11px] leading-[1.45] text-cifra-muted">
              Um arquivo por vez — MP3, WAV ou M4A (máx. 50 MB). Novo envio substitui o anterior.
            </p>
            <input
              ref={addInputRef}
              id={inputId}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-white/6 px-5 py-2.5">
              <span className="text-[11px] font-semibold text-cifra-text">Fila atual</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearQueue();
                }}
                disabled={queue.length === 0}
                className="text-[11px] font-medium text-cifra-teal transition-colors hover:text-cifra-teal-hover disabled:opacity-40"
              >
                Esvaziar
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center gap-2 border-b border-white/6 px-5 py-8 text-center">
                  <Music2 className="size-[18px] text-cifra-muted/50" strokeWidth={1.5} aria-hidden />
                  <p className="text-[11px] text-cifra-muted">Nenhum arquivo na fila</p>
                  <p className="font-mono text-[10px] text-[#5c5c78]">Escolha um arquivo de áudio</p>
                </div>
              ) : (
                queue.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center gap-3 border-b border-white/6 bg-[#0c0c16] px-5 py-3"
                  >
                    <QueueCoverThumb
                      coverUrl={recognizedSong?.cover_image_url ?? spotifyPrefill?.coverUrl ?? undefined}
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-xs font-semibold text-cifra-text">{q.file.name}</p>
                      <p className="font-mono text-[10px] text-cifra-muted">
                        {formatBytes(q.file.size)}
                        {recognizedSong
                          ? ` · identificada: ${recognizedSong.artist} — ${recognizedSong.title}`
                          : spotifyPrefill
                            ? ` · Spotify: ${spotifyPrefill.artistLine} — ${spotifyPrefill.title}`
                            : " · aguardando análise"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md border border-cifra-teal/30 bg-cifra-teal/10 px-2.5 py-1 font-mono text-[9px] text-cifra-teal">
                      Pronto
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(q.id)}
                      className="shrink-0 rounded-md p-1 text-cifra-muted transition-colors hover:bg-white/6 hover:text-cifra-text"
                      aria-label={`Remover ${q.file.name}`}
                    >
                      <X className="size-4" strokeWidth={1.75} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-white/6 bg-[#080810]/35 px-5 py-3">
              <button
                type="button"
                onClick={() => addInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cifra-border px-3.5 py-2 text-[11px] font-semibold text-cifra-text transition-colors hover:border-cifra-teal/35"
              >
                <FolderOpen className="size-4" strokeWidth={1.75} aria-hidden />
                Trocar arquivo
              </button>
              <button
                type="button"
                disabled={queue.length === 0 || detecting}
                onClick={runDetection}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cifra-teal px-4 py-2.5 text-[11px] font-semibold text-cifra-bg transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles className="size-4" strokeWidth={1.75} aria-hidden />
                {detecting ? "Detectando…" : "Rodar detecção"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-px overflow-hidden rounded-xl border border-cifra-border bg-cifra-border sm:grid-cols-3">
          <div className="bg-cifra-surface-2 px-4 py-3 sm:border-r sm:border-white/6">
            <p className="text-[10px] font-semibold leading-tight text-cifra-text">Um arquivo</p>
            <p className="mt-1.5 text-[10px] leading-[1.4] text-cifra-muted">
              Remova ou troque o arquivo antes de rodar a detecção.
            </p>
          </div>
          <div className="bg-cifra-surface-2 px-4 py-3 sm:border-r sm:border-white/6">
            <p className="text-[10px] font-semibold leading-tight text-cifra-text">Qualidade do sinal</p>
            <p className="mt-1.5 text-[10px] leading-[1.4] text-cifra-muted">
              Takes secos e menos compressão ajudam o modelo.
            </p>
          </div>
          <div className="bg-cifra-surface-2 px-4 py-3">
            <p className="text-[10px] font-semibold leading-tight text-cifra-gold">Exportação</p>
            <p className="mt-1.5 text-[10px] leading-[1.4] text-cifra-muted">
              Editar acordes, salvar versão, exportar texto ou PDF.
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 pt-0.5">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-cifra-gold" strokeWidth={1.75} aria-hidden />
          <p className="text-[10px] leading-[1.45] text-cifra-muted">
            Grave com poucos instrumentos sobrepostos; o modelo lê melhor o núcleo harmônico central do mix.
          </p>
        </div>

        <p className="text-center text-[11px] text-cifra-muted md:text-left">
          <Link href="/biblioteca/importar" className="font-medium text-cifra-teal hover:text-cifra-teal-hover">
            ← Voltar à escolha de origem
          </Link>
        </p>
      </div>
    </div>
  );
}
