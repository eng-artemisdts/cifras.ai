"use client";

import { ArrowLeft, LibraryBig, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useState } from "react";

import { ChordIngestLoadingOverlay } from "@/components/library/chord-ingest-loading-overlay";
import { createBeethovenVariationFromSchubertTrack } from "@/lib/beethoven-variations";
import { isPaidPlan, type BillingPlan } from "@/lib/billing/plan-types";
import { cifraEditHref, resolveCifraSlugPairFromTrack } from "@/lib/cifra/cifra-routes";
import { mergeSongMeta, type ImportMetadataContext } from "@/lib/library/import-metadata-context";
import {
  getIngestJobStatus,
  postTrackIngestWithMeta,
  SchubertIdentifyError,
} from "@/lib/schubert-identify-service";
import { fetchSchubertFromBrowser, type SchubertTrackJson } from "@/lib/schubert-api";
import { cn } from "@/lib/utils";

/** Alinhado ao badge do frame `rk0Ri` (Pencil). */
const IA_REVISION_BADGE = "IA v0.12 · rascunho";

const KEY_OPTIONS = ["C", "Am", "Dm", "G", "F"] as const;
const GENRE_OPTIONS = ["MPB", "Indie", "Pop", "Rock", "Bossa", "Sertanejo"] as const;

const CUSTOM_GENRES_STORAGE_KEY = "cifra.import.customGenres";
const GENRE_MAX_LEN = 48;

function normalizeGenreLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, GENRE_MAX_LEN);
}
const INSTRUMENT_OPTIONS = ["Violão", "Piano", "Baixo", "Bateria", "Voz", "Synth"] as const;

export type ImportMetadataStepProps = {
  context: ImportMetadataContext;
  onBack: () => void;
  /** Chamado depois da ingestão / criação da variação e antes da navegação para edição. */
  onDoneNavigation: () => void;
  /** Para regras de «Salvar como privado» (Pro). */
  billingPlan?: BillingPlan | null;
  className?: string;
};

function SectionMonoLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cifra-muted">{children}</p>
  );
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  id,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative flex h-[26px] w-12 shrink-0 items-center rounded-[13px] p-[3px] transition-colors",
        checked ? "justify-end bg-cifra-teal" : "justify-start bg-white/15",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <span className="pointer-events-none block size-5 shrink-0 rounded-[10px] bg-white shadow-sm" />
    </button>
  );
}

export function ImportMetadataStep({
  context,
  onBack,
  onDoneNavigation,
  billingPlan,
  className,
}: ImportMetadataStepProps) {
  const router = useRouter();
  const baseId = useId();
  const song = context.song;
  const isVariation = context.mode === "variation";
  const isIngest = context.mode === "ingest";
  const paid = isPaidPlan(billingPlan ?? "free");

  const [title, setTitle] = useState(song.title?.trim() ?? "");
  const [artist, setArtist] = useState(song.artist?.trim() ?? "");
  const [album, setAlbum] = useState(song.album?.trim() ?? "");
  const [variationLabel, setVariationLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState<string>("Am");
  const [customKeyMode, setCustomKeyMode] = useState(false);
  const [customKey, setCustomKey] = useState("");

  const [genreSet, setGenreSet] = useState(() => new Set<string>(["MPB"]));
  const [extraGenres, setExtraGenres] = useState<string[]>([]);
  const [genreDraft, setGenreDraft] = useState("");
  const [customGenresOpen, setCustomGenresOpen] = useState(false);
  const [instrumentSet, setInstrumentSet] = useState(() => new Set<string>(["Violão"]));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_GENRES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const next = parsed
        .filter((x): x is string => typeof x === "string")
        .map((x) => normalizeGenreLabel(x))
        .filter(Boolean);
      const dedup: string[] = [];
      const seen = new Set<string>();
      for (const g of next) {
        const key = g.toLowerCase();
        if (seen.has(key)) continue;
        if (GENRE_OPTIONS.some((p) => p.toLowerCase() === key)) continue;
        seen.add(key);
        dedup.push(g);
      }
      setExtraGenres(dedup);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_GENRES_STORAGE_KEY, JSON.stringify(extraGenres));
    } catch {
      /* ignore */
    }
  }, [extraGenres]);

  const [capoAt, setCapoAt] = useState(0);

  const [saveAsPrivate, setSaveAsPrivate] = useState(true);

  const effectivePrivate = isVariation && paid && saveAsPrivate;

  const toggleGenre = useCallback((g: string) => {
    setGenreSet((prev) => {
      const n = new Set(prev);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
  }, []);

  const addCustomGenre = useCallback(() => {
    const g = normalizeGenreLabel(genreDraft);
    if (!g) return;
    const key = g.toLowerCase();
    const presetHit = GENRE_OPTIONS.find((p) => p.toLowerCase() === key);
    if (presetHit) {
      setGenreSet((prev) => new Set(prev).add(presetHit));
      setGenreDraft("");
      return;
    }
    setExtraGenres((prev) => {
      if (prev.some((x) => x.toLowerCase() === key)) return prev;
      return [...prev, g];
    });
    setGenreSet((prev) => new Set(prev).add(g));
    setGenreDraft("");
  }, [genreDraft]);

  const removeExtraGenre = useCallback((g: string) => {
    setExtraGenres((prev) => prev.filter((x) => x !== g));
    setGenreSet((prev) => {
      const n = new Set(prev);
      n.delete(g);
      return n;
    });
  }, []);

  const toggleInstrument = useCallback((g: string) => {
    setInstrumentSet((prev) => {
      const n = new Set(prev);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
  }, []);

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
          isPrivate: effectivePrivate,
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

      const capoClamped = Math.min(24, Math.max(0, Math.round(Number(capoAt))));
      const ingestFile = context.file;
      if (!ingestFile) {
        throw new Error("Arquivo de áudio em falta para ingestão.");
      }

      const ingestResponse = await postTrackIngestWithMeta(ingestFile, mergedSong, {
        capo_at: capoClamped,
      });
      let resolvedTrack = ingestResponse.track as SchubertTrackJson | undefined;
      if (!resolvedTrack || !resolvedTrack.trackId) {
        const jobId = typeof ingestResponse.jobId === "string" ? ingestResponse.jobId.trim() : "";
        if (!jobId) throw new Error("Ingest não retornou track nem jobId.");
        const startedAt = Date.now();
        let last: Awaited<ReturnType<typeof getIngestJobStatus>> | null = null;
        for (let attempt = 0; attempt < 180; attempt++) {
          last = await getIngestJobStatus(jobId);
          if (last.status === "completed") break;
          if (last.status === "failed" || last.status === "cancelled") {
            throw new Error(last.error || "Ingest assíncrono falhou.");
          }
          const waitMs = attempt < 10 ? 1500 : 3000;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          if (Date.now() - startedAt > 10 * 60 * 1000) {
            throw new Error("Ingest assíncrono excedeu tempo limite de 10 minutos.");
          }
        }
        const key = last?.resultTrackId?.trim();
        if (!key) throw new Error("Ingest concluído sem resultTrackId.");
        const trackRes = await fetchSchubertFromBrowser(`tracks/by-key/${encodeURIComponent(key)}`, {
          method: "GET",
        });
        if (!trackRes.ok) {
          throw new Error("Faixa criada, mas falha ao carregar dados finais.");
        }
        resolvedTrack = (await trackRes.json()) as SchubertTrackJson;
      }
      const tid =
        resolvedTrack && typeof resolvedTrack === "object" && "trackId" in resolvedTrack && typeof resolvedTrack.trackId === "string"
          ? resolvedTrack.trackId.trim()
          : "";
      onDoneNavigation();
      const pair = resolveCifraSlugPairFromTrack(resolvedTrack as SchubertTrackJson);
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
    effectivePrivate,
    onDoneNavigation,
    router,
    capoAt,
  ]);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 w-full flex-1 flex-col bg-cifra-bg",
        className,
      )}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-[880px] flex-1 flex-col gap-4 px-5 py-2 md:gap-5 md:px-10 md:pb-6 md:pt-2">
        {/* hdrM — frame rk0Ri */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-cifra-text">Metadados e edição manual</h2>
          <span className="inline-flex items-center rounded-full border border-cifra-teal/35 bg-cifra-teal/8 px-2.5 py-1 font-mono text-[9px] text-cifra-teal">
            {IA_REVISION_BADGE}
          </span>
        </div>

        {/* fc — cartão principal */}
        <div className="relative flex min-h-0 flex-1 flex-col rounded-[14px] border border-cifra-border bg-cifra-surface p-5 shadow-sm md:p-[22px]">
          {submitting && isIngest ? (
            <ChordIngestLoadingOverlay
              songTitle={title.trim() || "Música sem título"}
              artistName={artist.trim() || "Artista desconhecido"}
              className="z-40 rounded-[14px]"
            />
          ) : null}
          <div className="flex flex-col gap-4 md:gap-[14px]">
            <SectionMonoLabel>Informações da música</SectionMonoLabel>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${baseId}-title`} className="text-xs font-semibold text-cifra-text">
                Nome da música
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
                placeholder="Ensaio sem título"
                className="w-full rounded-[10px] border border-cifra-border bg-cifra-surface-2 px-3.5 py-3 text-[13px] text-cifra-text outline-none ring-cifra-teal/25 placeholder:text-[#6b6b8a] focus:border-cifra-teal/40 focus:ring-1 read-only:opacity-80"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-cifra-text">Tom</span>
              <div className="flex flex-wrap items-center gap-2">
                {KEY_OPTIONS.map((k) => {
                  const active = !customKeyMode && selectedKey === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setCustomKeyMode(false);
                        setSelectedKey(k);
                      }}
                      className={cn(
                        "rounded-lg border px-3 py-2 font-mono text-xs transition-colors",
                        active
                          ? "border-cifra-teal/65 bg-cifra-teal/10 font-semibold text-cifra-teal"
                          : "border-cifra-border bg-transparent font-normal text-cifra-muted hover:border-white/16",
                      )}
                    >
                      {k}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCustomKeyMode(true)}
                  className={cn(
                    "text-xs font-normal transition-colors",
                    customKeyMode ? "font-semibold text-cifra-teal" : "text-cifra-teal hover:text-cifra-teal-hover",
                  )}
                >
                  + custom
                </button>
              </div>
              {customKeyMode ? (
                <input
                  type="text"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value.slice(0, 8))}
                  placeholder="Ex.: Bbm"
                  className="max-w-[180px] rounded-[10px] border border-dashed border-cifra-teal/40 bg-cifra-surface-2 px-3 py-2 font-mono text-xs text-cifra-text outline-none focus:border-cifra-teal/60"
                />
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${baseId}-artist`} className="text-xs font-semibold text-cifra-text">
                Artista / projeto
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
                placeholder="Você · demo caseira"
                className="w-full rounded-[10px] border border-cifra-border bg-cifra-surface-2 px-3.5 py-3 text-[13px] text-cifra-text outline-none ring-cifra-teal/25 placeholder:text-[#8a8aa8] focus:border-cifra-teal/40 focus:ring-1 read-only:opacity-80"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-cifra-text">Gênero</span>
              <div className="flex flex-wrap items-center gap-2">
                {GENRE_OPTIONS.map((g) => {
                  const on = genreSet.has(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGenre(g)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[11px] transition-colors",
                        on
                          ? "border-cifra-border bg-[#16162a] font-medium text-cifra-text"
                          : "border-cifra-border/80 text-cifra-muted hover:text-cifra-text",
                      )}
                    >
                      {g}
                    </button>
                  );
                })}
                {!customGenresOpen ? (
                  <button
                    type="button"
                    onClick={() => setCustomGenresOpen(true)}
                    className="text-[11px] font-normal text-cifra-teal transition-colors hover:text-cifra-teal-hover"
                  >
                    + adicionar
                  </button>
                ) : null}
              </div>

              {customGenresOpen ? (
                <div className="flex flex-col gap-2 border-l-2 border-cifra-teal/25 pl-3">
                  <div className="flex flex-wrap gap-2">
                    {extraGenres.map((g) => {
                      const on = genreSet.has(g);
                      return (
                        <span
                          key={`custom-${g}`}
                          className={cn(
                            "inline-flex max-w-full items-center gap-0.5 rounded-full border pl-3 pr-1 py-1 text-[11px] transition-colors",
                            on
                              ? "border-cifra-border bg-[#16162a] font-medium text-cifra-text"
                              : "border-cifra-border/80 text-cifra-muted",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleGenre(g)}
                            className={cn(
                              "min-w-0 truncate rounded-full py-0.5 text-left transition-colors",
                              on ? "text-cifra-text" : "text-cifra-muted hover:text-cifra-text",
                            )}
                          >
                            {g}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              removeExtraGenre(g);
                            }}
                            className="flex size-6 shrink-0 items-center justify-center rounded-full text-cifra-muted transition-colors hover:bg-white/10 hover:text-cifra-text"
                            aria-label={`Remover gênero ${g}`}
                            title="Remover dos meus gêneros"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor={`${baseId}-genre-custom`} className="sr-only">
                      Novo gênero
                    </label>
                    <input
                      id={`${baseId}-genre-custom`}
                      type="text"
                      value={genreDraft}
                      onChange={(e) => setGenreDraft(e.target.value.slice(0, GENRE_MAX_LEN))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomGenre();
                        }
                      }}
                      placeholder="Outro gênero…"
                      autoComplete="off"
                      className="min-w-[140px] max-w-full flex-1 rounded-[10px] border border-dashed border-cifra-border/90 bg-cifra-surface-2 px-3 py-2 text-[12px] text-cifra-text outline-none placeholder:text-cifra-muted focus:border-cifra-teal/45 focus:ring-1 focus:ring-cifra-teal/30"
                    />
                    <button
                      type="button"
                      onClick={() => addCustomGenre()}
                      className="shrink-0 rounded-lg border border-cifra-border px-3 py-2 text-[11px] font-medium text-cifra-teal transition-colors hover:border-cifra-teal/40 hover:bg-cifra-teal/8"
                    >
                      Adicionar
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomGenresOpen(false)}
                    className="self-start text-[10px] text-cifra-muted underline-offset-2 transition-colors hover:text-cifra-text hover:underline"
                  >
                    Ocultar gêneros personalizados
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <SectionMonoLabel>Instrumentos</SectionMonoLabel>
              <p className="text-[11px] leading-[1.45] text-cifra-muted">
                Camadas prováveis no arranjo — ajudam a contextualizar acordes e levadas.
              </p>
              <div className="flex flex-wrap gap-2">
                {INSTRUMENT_OPTIONS.map((name) => {
                  const on = instrumentSet.has(name);
                  const supported = name === "Violão";
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => supported && toggleInstrument(name)}
                      disabled={!supported}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] transition-colors",
                        on
                          ? "border-cifra-teal/65 bg-cifra-teal/10 font-semibold text-cifra-teal"
                          : supported
                            ? "border-cifra-border bg-[#16162a] font-normal text-cifra-text hover:border-white/14"
                            : "cursor-not-allowed border-cifra-border/70 bg-[#16162a]/70 font-normal text-cifra-muted/70",
                      )}
                    >
                      {!supported ? <Lock className="size-3 opacity-80" strokeWidth={1.9} /> : null}
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            {!isVariation ? (
              <>
                <div className="my-1 h-px w-full bg-white/6" aria-hidden />

                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${baseId}-capo`} className="text-xs font-semibold text-cifra-text">
                    Capotraste
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      id={`${baseId}-capo`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={24}
                      step={1}
                      value={Number.isFinite(capoAt) ? capoAt : 0}
                      onChange={(e) => {
                        const v = e.target.valueAsNumber;
                        if (!Number.isFinite(v)) {
                          setCapoAt(0);
                          return;
                        }
                        setCapoAt(Math.min(24, Math.max(0, Math.round(v))));
                      }}
                      className="w-[88px] rounded-[10px] border border-cifra-border bg-cifra-surface-2 px-3 py-2.5 text-center font-mono text-sm text-cifra-text outline-none focus:border-cifra-teal/40 focus:ring-1"
                      aria-describedby={`${baseId}-capo-hint`}
                    />
                    <span id={`${baseId}-capo-hint`} className="text-[11px] text-cifra-muted">
                      Casa do traste (0 = sem capotraste).
                    </span>
                  </div>
                </div>
              </>
            ) : null}

            {/* Álbum opcional — útil para ingest; compacto */}
            {!isVariation ? (
              <div className="flex flex-col gap-1.5 border-t border-white/6 pt-4">
                <label htmlFor={`${baseId}-album`} className="text-xs font-semibold text-cifra-text">
                  Álbum <span className="font-normal text-cifra-muted">(opcional)</span>
                </label>
                <input
                  id={`${baseId}-album`}
                  type="text"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  autoComplete="off"
                  placeholder="Álbum ou EP"
                  className="w-full rounded-[10px] border border-cifra-border bg-cifra-surface-2 px-3.5 py-3 text-[13px] text-cifra-text outline-none placeholder:text-cifra-muted focus:border-cifra-teal/40 focus:ring-1"
                />
              </div>
            ) : null}

            {isVariation ? (
              <div className="flex flex-col gap-2 border-t border-white/6 pt-4">
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-cifra-teal">
                  Versão personalizada
                </span>
                <label htmlFor={`${baseId}-var-label`} className="text-xs font-semibold text-cifra-text">
                  Nome desta versão
                </label>
                <input
                  id={`${baseId}-var-label`}
                  type="text"
                  value={variationLabel}
                  onChange={(e) => setVariationLabel(e.target.value.slice(0, 120))}
                  autoComplete="off"
                  placeholder="Ex.: Acústico · capo 2"
                  className="w-full rounded-[10px] border border-cifra-border bg-cifra-surface-2 px-3.5 py-3 text-[13px] text-cifra-text outline-none focus:border-cifra-teal/40 focus:ring-1"
                />
              </div>
            ) : null}

            {/* privPro */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-t border-white/6 pt-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-cifra-text">Salvar como privado</span>
                  <span className="rounded border border-cifra-teal/35 bg-cifra-teal/15 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide text-cifra-teal">
                    Pro
                  </span>
                </div>
                <p className="max-w-md text-[11px] leading-[1.45] text-cifra-muted">
                  {isVariation
                    ? paid
                      ? "Exclusivo do plano Pro: a cifra fica só na sua biblioteca, invisível para outros."
                      : "Faça upgrade para Pro para manter esta versão privada na biblioteca."
                    : "Após guardar, refine acordes e letra no editor. Privacidade avançada para novas faixas chega em breve."}
                </p>
              </div>
              <ToggleSwitch
                id={`${baseId}-private`}
                checked={Boolean(isVariation && paid && saveAsPrivate)}
                disabled={!isVariation || !paid}
                onChange={setSaveAsPrivate}
              />
            </div>
          </div>

          {error ? (
            <p
              className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200/90"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>

        {/* act2 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-[10px] border border-cifra-border px-[18px] py-2.5 text-xs font-semibold text-cifra-text transition-colors hover:border-cifra-teal/35 disabled:opacity-40"
          >
            <ArrowLeft className="size-4 shrink-0 text-cifra-muted" strokeWidth={1.75} aria-hidden />
            Voltar à captura
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-[10px] bg-cifra-teal px-[22px] py-3 text-xs font-semibold text-cifra-bg transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LibraryBig className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            {submitting ? "A guardar…" : "Salvar na minha biblioteca"}
          </button>
        </div>

        {/* ft2 — apenas o indicador de passo; links ficam no LibraryPageFooter global */}
        <div className="flex items-center justify-end border-t border-cifra-border py-3.5">
          <p className="font-mono text-[10px] text-[#5c5c78]">Passo 2 de 3</p>
        </div>
      </div>
    </div>
  );
}
