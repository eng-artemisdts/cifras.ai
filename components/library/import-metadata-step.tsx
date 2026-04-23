"use client";

import { ArrowLeft, Disc3, Music2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useId, useState } from "react";

import { createBeethovenVariationFromSchubertTrack } from "@/lib/beethoven-variations";
import { cifraEditHref, resolveCifraSlugPairFromTrack } from "@/lib/cifra/cifra-routes";
import { mergeSongMeta, type ImportMetadataContext } from "@/lib/library/import-metadata-context";
import {
  postTrackIngestWithMeta,
  SchubertIdentifyError,
} from "@/lib/schubert-identify-service";
import type { SchubertTrackJson } from "@/lib/schubert-api";
import { cn } from "@/lib/utils";

export type ImportMetadataStepProps = {
  context: ImportMetadataContext;
  onBack: () => void;
  /** Chamado depois da ingestão / criação da variação e antes da navegação para edição. */
  onDoneNavigation: () => void;
  className?: string;
};

export function ImportMetadataStep({
  context,
  onBack,
  onDoneNavigation,
  className,
}: ImportMetadataStepProps) {
  const router = useRouter();
  const baseId = useId();
  const song = context.song;
  const isVariation = context.mode === "variation";

  const [title, setTitle] = useState(song.title?.trim() ?? "");
  const [artist, setArtist] = useState(song.artist?.trim() ?? "");
  const [album, setAlbum] = useState(song.album?.trim() ?? "");
  const [variationLabel, setVariationLabel] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    const t = title.trim();
    const a = artist.trim();
    if (!t || !a) {
      setError("Informe pelo menos o título e o artista.");
      return;
    }

    const mergedSong = mergeSongMeta(song, {
      title: t,
      artist: a,
      album: album.trim(),
    });

    setSubmitting(true);
    setError(null);
    try {
      if (context.mode === "variation") {
        const baseTrack = context.variationBaseTrack;
        const baseTrackId = context.variationBaseTrackId?.trim();
        if (!baseTrack || !baseTrackId) {
          throw new Error("Dados da faixa base em falta.");
        }
        const pair = resolveCifraSlugPairFromTrack(baseTrack);
        if (!pair) throw new Error("Não foi possível resolver os slugs da faixa base.");
        const created = await createBeethovenVariationFromSchubertTrack({
          baseTrackId,
          baseArtistSlug: pair.artistSlug,
          baseSongSlug: pair.songSlug,
          sourceTrack: baseTrack,
          variationLabel: variationLabel.trim().slice(0, 120),
          isPrivate: !isPublic,
        });
        const tid =
          created &&
          typeof created === "object" &&
          "trackId" in created &&
          typeof created.trackId === "string"
            ? created.trackId.trim()
            : "";
        onDoneNavigation();
        if (tid) {
          router.push(`${cifraEditHref(pair.artistSlug, pair.songSlug)}?v=${encodeURIComponent(tid)}`);
        }
        return;
      }

      const { track } = await postTrackIngestWithMeta(context.file, mergedSong);
      const tid =
        track && typeof track === "object" && "trackId" in track && typeof track.trackId === "string"
          ? track.trackId.trim()
          : "";
      onDoneNavigation();
      const pair = resolveCifraSlugPairFromTrack(track as unknown as SchubertTrackJson);
      if (pair) {
        router.push(cifraEditHref(pair.artistSlug, pair.songSlug));
        return;
      }
      if (tid) {
        router.push(`/cifras/edit?trackId=${encodeURIComponent(tid)}`);
        return;
      }
      const q = encodeURIComponent(`${mergedSong.title} ${mergedSong.artist}`.trim());
      router.push(`/biblioteca?q=${q}`);
    } catch (e) {
      if (e instanceof SchubertIdentifyError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Não foi possível continuar.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    title,
    artist,
    album,
    song,
    context,
    variationLabel,
    isPublic,
    onDoneNavigation,
    router,
  ]);

  return (
    <div className={cn("flex min-h-0 min-w-0 w-full flex-1 flex-col gap-4 px-5 py-2 md:px-10 md:pb-6 md:pt-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/7 pb-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg border border-cifra-border px-3 py-2 text-[12px] font-medium text-cifra-muted transition-colors hover:border-cifra-teal/35 hover:text-cifra-text disabled:opacity-40"
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          Voltar à detecção
        </button>
        <p className="font-mono text-[10px] text-[#5c5c78]">Passo 2 de 3</p>
      </div>

      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-4">
        <div className="space-y-1">
          <h2 className="font-serif text-xl font-normal text-cifra-text md:text-2xl">Revisão dos metadados</h2>
          <p className="text-[12px] leading-relaxed text-cifra-muted">
            Confirme ou corrija as informações da música antes de gerar a cifra. Se não houve detecção automática,
            preencha o título e o artista à mão.
          </p>
        </div>

        <div className="rounded-2xl border border-cifra-border bg-cifra-surface p-5 shadow-sm md:p-6">
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <label htmlFor={`${baseId}-title`} className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-cifra-muted">
                <Music2 className="size-3.5 text-cifra-teal" strokeWidth={1.75} aria-hidden />
                Título
              </label>
              <input
                id={`${baseId}-title`}
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError(null);
                }}
                readOnly={isVariation}
                autoComplete="off"
                placeholder="Nome da música"
                className="w-full rounded-xl border border-cifra-border bg-[#0c0c16] px-3.5 py-2.5 text-[13px] text-cifra-text outline-none ring-cifra-teal/25 placeholder:text-cifra-muted/60 focus:border-cifra-teal/40 focus:ring-1 read-only:opacity-80"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${baseId}-artist`} className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-cifra-muted">
                <User className="size-3.5 text-cifra-teal" strokeWidth={1.75} aria-hidden />
                Artista
              </label>
              <input
                id={`${baseId}-artist`}
                type="text"
                value={artist}
                onChange={(e) => {
                  setArtist(e.target.value);
                  setError(null);
                }}
                readOnly={isVariation}
                autoComplete="off"
                placeholder="Nome do artista ou banda"
                className="w-full rounded-xl border border-cifra-border bg-[#0c0c16] px-3.5 py-2.5 text-[13px] text-cifra-text outline-none ring-cifra-teal/25 placeholder:text-cifra-muted/60 focus:border-cifra-teal/40 focus:ring-1 read-only:opacity-80"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${baseId}-album`} className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-cifra-muted">
                <Disc3 className="size-3.5 text-cifra-teal" strokeWidth={1.75} aria-hidden />
                Álbum <span className="font-normal normal-case text-cifra-muted/70">(opcional)</span>
              </label>
              <input
                id={`${baseId}-album`}
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                readOnly={isVariation}
                autoComplete="off"
                placeholder="Álbum, se souber"
                className="w-full rounded-xl border border-cifra-border bg-[#0c0c16] px-3.5 py-2.5 text-[13px] text-cifra-text outline-none ring-cifra-teal/25 placeholder:text-cifra-muted/60 focus:border-cifra-teal/40 focus:ring-1 read-only:opacity-80"
              />
            </div>

            {isVariation ? (
              <div className="space-y-3 rounded-xl border border-white/8 bg-[#0c0c14] px-3 py-3">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-cifra-teal">
                  Versão personalizada
                </p>
                <div className="space-y-1.5">
                  <label htmlFor={`${baseId}-var-label`} className="block text-[10px] text-cifra-muted">
                    Nome desta versão
                  </label>
                  <input
                    id={`${baseId}-var-label`}
                    type="text"
                    value={variationLabel}
                    onChange={(e) => setVariationLabel(e.target.value.slice(0, 120))}
                    autoComplete="off"
                    placeholder="Ex.: Acústico · capo 2"
                    className="w-full rounded-lg border border-cifra-border bg-[#080810] px-3 py-2 text-[12px] text-cifra-text outline-none focus:border-cifra-teal/40 focus:ring-1"
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-2.5 text-[11px] leading-snug text-cifra-muted">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-3.5 rounded border-cifra-border bg-[#080810] text-cifra-teal focus:ring-cifra-teal/40"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-cifra-text">Tornar pública</span> — outros podem ver esta versão no
                    selector da mesma música.
                  </span>
                </label>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200/90" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="rounded-xl bg-cifra-teal px-5 py-2.5 text-[12px] font-semibold text-cifra-bg transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "A processar…" : "Continuar para edição da cifra"}
            </button>
          </div>
        </div>

        <p className="text-center font-mono text-[9px] text-[#5c5c78] md:text-left">
          Depois deste passo, abrimos o editor de cifra como hoje (letra e acordes).
        </p>
      </div>
    </div>
  );
}
