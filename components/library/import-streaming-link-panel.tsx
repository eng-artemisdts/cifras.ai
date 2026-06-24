"use client";

import { Lightbulb, Link2, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { RecognizedMusicConfirmDialog } from "@/components/library/recognized-music-confirm-dialog";
import { useImportQuota } from "@/components/providers/import-quota-context";
import { useIngestJobs } from "@/components/providers/ingest-jobs-context";
import { cifraEditHref, resolveCifraSlugPairFromTrack } from "@/lib/cifra/cifra-routes";
import type { StreamingLinkImportPanelConfig } from "@/lib/library/streaming-link-import-config";
import { validateStreamingImportUrl } from "@/lib/library/streaming-url-validation";
import { fetchYoutubeImportPreview } from "@/lib/library/youtube-import-preview";
import type { SchubertTrackJson } from "@/lib/schubert-api";
import {
  postUrlSourceIngest,
  SchubertIdentifyError,
  type ChordFoundPreview,
} from "@/lib/schubert-identify-service";
import { cn } from "@/lib/utils";

export type ImportStreamingLinkPanelProps = {
  /** Dados do provider (frames lCtH3, 0dhNf, O39X7, o1Z4x no Pencil). */
  config: StreamingLinkImportPanelConfig;
  /** Plano Pro ativo (Management API / claims) — desbloqueia origens `requiresPro`. */
  proEntitled?: boolean;
  className?: string;
};

type PendingUrlIngest = {
  sourceUrl: string;
  title: string;
  artist: string;
  coverUrl: string | null;
};

function defaultPreviewForProvider(slug: StreamingLinkImportPanelConfig["slug"]): {
  title: string;
  artist: string;
} {
  switch (slug) {
    case "youtube":
      return { title: "Vídeo do YouTube", artist: "YouTube" };
    case "tiktok":
      return { title: "Vídeo do TikTok", artist: "TikTok" };
    case "instagram":
      return { title: "Reel do Instagram", artist: "Instagram" };
    default:
      return { title: "Conteúdo do link", artist: "Streaming" };
  }
}

/**
 * Painel único de importação por URL — recebe `config` por provider (YouTube, TikTok, Instagram).
 */
export function ImportStreamingLinkPanel({ config, proEntitled = false, className }: ImportStreamingLinkPanelProps) {
  const router = useRouter();
  const { registerIngestJob, blockNewIngestIfBusy } = useIngestJobs();
  const { canImport, refreshQuota } = useImportQuota();

  const [url, setUrl] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [urlIngestBusy, setUrlIngestBusy] = useState(false);
  const [urlIngestError, setUrlIngestError] = useState<string | null>(null);

  const [recognitionPreview, setRecognitionPreview] = useState<ChordFoundPreview | null>(null);
  const [recognitionConfirmOpen, setRecognitionConfirmOpen] = useState(false);
  const [pendingUrlIngest, setPendingUrlIngest] = useState<PendingUrlIngest | null>(null);

  const proGateActive = Boolean(config.requiresPro && !proEntitled);
  const quotaBlocked = !canImport;

  const handleRecognitionDialogOpenChange = useCallback((open: boolean) => {
    setRecognitionConfirmOpen(open);
    if (!open) {
      setRecognitionPreview(null);
      setPendingUrlIngest(null);
    }
  }, []);

  const runUrlIngestFlow = useCallback(
    async (pending: PendingUrlIngest) => {
      setUrlIngestError(null);
      setUrlIngestBusy(true);
      try {
        if (blockNewIngestIfBusy()) return;
        if (!canImport) {
          setUrlIngestError("Atingiu o limite semanal de importações do seu plano.");
          return;
        }

        const ingestResp = await postUrlSourceIngest({
          sourceUrl: pending.sourceUrl,
          title: pending.title,
          artist: pending.artist,
          ...(pending.coverUrl ? { coverImageUrl: pending.coverUrl } : {}),
        });

        if (ingestResp.status === "completed" && ingestResp.track && typeof ingestResp.track === "object") {
          const resolvedTrack = ingestResp.track as SchubertTrackJson;
          const pair = resolveCifraSlugPairFromTrack(resolvedTrack);
          if (pair) {
            void refreshQuota();
            router.push(cifraEditHref(pair.artistSlug, pair.songSlug));
            return;
          }
          const tid =
            typeof resolvedTrack.trackId === "string" && resolvedTrack.trackId.trim()
              ? resolvedTrack.trackId.trim()
              : "";
          if (tid) {
            void refreshQuota();
            router.push(`/cifras/edit?trackId=${encodeURIComponent(tid)}`);
            return;
          }
          const q = encodeURIComponent(`${pending.title} ${pending.artist}`.trim());
          void refreshQuota();
          router.push(`/biblioteca?q=${q}`);
          return;
        }

        const jobId = typeof ingestResp.jobId === "string" ? ingestResp.jobId.trim() : "";
        if (!jobId) {
          throw new Error("Não foi possível iniciar a preparação da cifra.");
        }

        const registered = registerIngestJob({
          jobId,
          title: pending.title,
          artist: pending.artist,
          source: "url",
          coverUrl: pending.coverUrl,
        });
        if (!registered) return;
        void refreshQuota();
        router.push("/biblioteca/ingestoes");
      } catch (e) {
        const msg =
          e instanceof SchubertIdentifyError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Não foi possível preparar a cifra.";
        setUrlIngestError(msg);
      } finally {
        setUrlIngestBusy(false);
      }
    },
    [blockNewIngestIfBusy, canImport, refreshQuota, registerIngestJob, router],
  );

  const onConfirmUrlIngest = useCallback(async () => {
    const pending = pendingUrlIngest;
    if (!pending) return;
    setRecognitionConfirmOpen(false);
    setRecognitionPreview(null);
    setPendingUrlIngest(null);
    await runUrlIngestFlow(pending);
  }, [pendingUrlIngest, runUrlIngestFlow]);

  const onContinue = useCallback(async () => {
    setLinkError(null);
    const validated = validateStreamingImportUrl(url, config.slug);
    if (!validated.ok) {
      setLinkError(validated.message);
      return;
    }

    setLinkBusy(true);
    try {
      let title = "";
      let artist = "";
      let coverUrl: string | null = null;

      if (config.slug === "youtube") {
        const preview = await fetchYoutubeImportPreview(validated.url);
        if (preview) {
          title = preview.title;
          artist = preview.channel;
          coverUrl = preview.thumbnailUrl;
        }
      }

      if (!title || !artist) {
        const fallback = defaultPreviewForProvider(config.slug);
        title = title || fallback.title;
        artist = artist || fallback.artist;
      }

      const pending: PendingUrlIngest = {
        sourceUrl: validated.url,
        title,
        artist,
        coverUrl,
      };

      setPendingUrlIngest(pending);
      setRecognitionPreview({
        songTitle: title,
        artistName: artist,
        coverImageUrl: coverUrl,
        chordHref: `/biblioteca?q=${encodeURIComponent(`${title} ${artist}`.trim())}`,
        trackId: null,
        editHref: null,
      });
      setRecognitionConfirmOpen(true);
    } catch {
      setLinkError("Não foi possível ler este link. Verifique se o conteúdo é público e tente novamente.");
    } finally {
      setLinkBusy(false);
    }
  }, [url, config.slug]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 md:gap-4", className)}>
      {urlIngestBusy ? (
        <div
          className="fixed bottom-6 left-1/2 z-[120] flex max-w-[min(100vw-2rem,420px)] -translate-x-1/2 items-center gap-2 rounded-full border border-cifra-teal/35 bg-cifra-bg/95 px-4 py-2.5 text-[11px] text-cifra-text shadow-lg backdrop-blur-sm"
          role="status"
        >
          <Loader2 className="size-4 shrink-0 animate-spin text-cifra-teal" aria-hidden />
          A preparar a sua cifra…
        </div>
      ) : null}
      {urlIngestError ? (
        <div className="fixed bottom-6 left-1/2 z-[120] max-w-[min(100vw-2rem,420px)] -translate-x-1/2 rounded-xl border border-red-400/40 bg-red-950/90 px-4 py-3 text-[11px] leading-snug text-red-100 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <span>{urlIngestError}</span>
            <button
              type="button"
              onClick={() => setUrlIngestError(null)}
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
          copyVariant="url"
          montarComIaHref={null}
          primaryMontarSemHrefLabel="Gerar cifra com IA"
          onMontarComIaSemHref={onConfirmUrlIngest}
          onNotThisMusic={() => handleRecognitionDialogOpenChange(false)}
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
              {config.cardTagRight}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-5 pb-4 pt-4">
            {proGateActive ? (
              <div className="flex items-start gap-2 rounded-xl border border-cifra-gold/40 bg-cifra-gold/10 px-3.5 py-2.5 text-[11px] leading-snug text-cifra-gold">
                <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                <span>
                  Exclusivo <span className="font-mono font-semibold">Pro</span> — faça upgrade para importar desta
                  origem. Pode explorar os passos e colar o link à vontade; o envio à IA ficará disponível no plano
                  pago.
                </span>
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              {config.instructions.map((line, i) => (
                <p key={i} className="text-xs leading-normal text-cifra-text">
                  {line}
                </p>
              ))}
            </div>

            <div className="rounded-lg bg-[#12121f] px-3.5 py-3">
              <p className="font-mono text-[9px] tracking-wide text-cifra-muted">Exemplos de URL</p>
              <pre className="mt-1.5 whitespace-pre-wrap break-all font-mono text-[10px] leading-[1.55] text-cifra-teal">
                {config.exampleUrls}
              </pre>
            </div>

            <div>
              <label className="sr-only" htmlFor="streaming-import-url">
                URL
              </label>
              <input
                id="streaming-import-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder={config.urlPlaceholder}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (linkError) setLinkError(null);
                }}
                disabled={linkBusy || urlIngestBusy}
                className="w-full rounded-lg border border-cifra-border bg-cifra-surface-2 px-3 py-2.5 text-[13px] text-cifra-text placeholder:text-cifra-muted outline-none ring-cifra-teal/30 focus:border-cifra-teal focus:ring-2 disabled:opacity-60"
              />
              {linkError ? (
                <p className="mt-2 text-[11px] leading-snug text-red-300" role="alert">
                  {linkError}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/biblioteca/importar"
                className="text-[11px] font-medium text-cifra-teal transition-colors hover:text-cifra-teal-hover"
              >
                ← Voltar para escolher outra origem
              </Link>
              <button
                type="button"
                onClick={() => void onContinue()}
                disabled={proGateActive || !url.trim() || linkBusy || urlIngestBusy || !canImport}
                className="rounded-lg bg-cifra-teal px-4 py-2 text-[11px] font-semibold text-cifra-bg transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {linkBusy ? "A ler link…" : "Continuar"}
              </button>
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
                  col.titleVariant === "gold" ? "text-cifra-gold" : "text-cifra-text"
                )}
              >
                {col.title}
              </p>
              <p className="mt-1.5 text-[10px] leading-[1.4] text-cifra-muted">{col.body}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2.5 pt-0.5">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-cifra-gold" strokeWidth={1.75} aria-hidden />
          <p className="text-[10px] leading-[1.45] text-cifra-muted">{config.hint}</p>
        </div>
      </div>
    </div>
  );
}
