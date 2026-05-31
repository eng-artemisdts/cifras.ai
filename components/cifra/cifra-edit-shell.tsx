"use client";

import { Eye, PencilLine, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { AuthMarketingSidebar } from "@/components/layout/auth-marketing-sidebar";
import type { LibraryTopNavUser } from "@/components/library/library-top-nav";
import type { MusicAiDemoPayload } from "@/lib/cifra/musicai-types";
import type { BillingPlan } from "@/lib/billing/plan-types";
import { cifraHref } from "@/lib/cifra/cifra-routes";
import { normalizeDemoPayload } from "@/lib/cifra/normalize-payload";
import { bibliotecaCifraSheetMarketingSidebar } from "@/lib/library/cifra-sheet-marketing";
import { patchBeethovenVariationFromBrowser } from "@/lib/beethoven-variations";
import { fetchSchubertFromBrowser, type SchubertLyricsSource } from "@/lib/schubert-api";
import { cn } from "@/lib/utils";

import { CifraCenterChrome } from "./cifra-center-chrome";
import { CifraPocMount } from "./cifra-poc-mount";
import { CifraTranscriptionEditor, type CifraTranscriptionEditorHandle } from "./cifra-transcription-editor";

const editMarketing = {
  ...bibliotecaCifraSheetMarketingSidebar,
  titleLine2: "edição",
  introText:
    "Ajuste a letra ao duplo clique e arraste os acordes para as palavras certas. Pré-visualize com o mesmo leitor da cifra e guarde na sua biblioteca.",
};

export type CifraEditShellProps = {
  user: LibraryTopNavUser;
  billingPlan?: BillingPlan | null;
  lyricsSource: SchubertLyricsSource;
  initialPayload: MusicAiDemoPayload;
  title: string;
  subtitle: string;
  durationLabel?: string;
  /** Metadados só para documentos com `variationOfTrackId` (nome + visibilidade). */
  variationMeta?: {
    /** `trackId` público da versão (query `v=` na volta à cifra). */
    variationTrackKey: string;
    initialLabel: string;
    source: "schubert" | "beethoven";
  };
} & (
  | { patchMode: "slug"; artistSlug: string; songSlug: string }
  | { patchMode: "key"; trackKey: string }
);

export function CifraEditShell(props: CifraEditShellProps) {
  const {
    user,
    billingPlan,
    lyricsSource,
    initialPayload,
    title,
    subtitle,
    durationLabel,
    patchMode,
    variationMeta,
  } = props;
  const router = useRouter();
  const editorRef = useRef<CifraTranscriptionEditorHandle>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [previewPayload, setPreviewPayload] = useState(() => normalizeDemoPayload(initialPayload));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [variationLabel, setVariationLabel] = useState(variationMeta?.initialLabel ?? "");

  const syncPreviewFromEditor = useCallback(() => {
    const p = editorRef.current?.getPayload();
    if (p) setPreviewPayload(normalizeDemoPayload(p));
  }, []);

  const setPreviewMode = () => {
    syncPreviewFromEditor();
    setMode("preview");
  };

  const setEditMode = () => {
    setMode("edit");
  };

  const schubertPatchPath =
    patchMode === "slug"
      ? `tracks/by-slug/${encodeURIComponent(props.artistSlug)}/${encodeURIComponent(props.songSlug)}`
      : `tracks/by-key/${encodeURIComponent(props.trackKey)}`;

  const cifraPublicHref =
    patchMode === "slug"
      ? variationMeta
        ? `${cifraHref(props.artistSlug, props.songSlug)}?v=${encodeURIComponent(variationMeta.variationTrackKey)}`
        : cifraHref(props.artistSlug, props.songSlug)
      : `/cifras?trackId=${encodeURIComponent(props.trackKey)}`;

  const previewTrackKey =
    patchMode === "slug"
      ? `${props.artistSlug}:${props.songSlug}:${lyricsSource}`
      : `${props.trackKey}:edit-preview`;

  const save = async () => {
    const p = editorRef.current?.getPayload();
    if (!p) return;
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        chords: p.chords,
        lyrics: p.lyrics,
        lyricsSource,
        sections: p.sections,
      };
      if (variationMeta) {
        body.variationLabel = variationLabel.trim();
      }

      if (variationMeta?.source === "beethoven") {
        await patchBeethovenVariationFromBrowser(variationMeta.variationTrackKey, body);
      } else {
        const res = await fetchSchubertFromBrowser(schubertPatchPath, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const raw = await res.text();
          let detail = raw;
          try {
            const j = JSON.parse(raw) as { message?: unknown };
            if (Array.isArray(j.message)) detail = j.message.join("; ");
            else if (typeof j.message === "string") detail = j.message;
          } catch {
            /* ignore */
          }
          throw new Error(detail || `HTTP ${res.status}`);
        }
      }
      router.push(cifraPublicHref);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível gravar.");
    } finally {
      setSaving(false);
    }
  };

  const lyricsVariantLabel =
    lyricsSource === "MATCH" ? "Letra sincronizada" : "Letra gerada por IA";

  return (
    <div className="flex min-h-dvh flex-col bg-cifra-bg text-cifra-text lg:flex-row lg:items-stretch">
      <AuthMarketingSidebar
        {...editMarketing}
        className="hidden min-h-0 shrink-0 lg:flex lg:min-h-dvh"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-dvh lg:border-l lg:border-white/7">
        <CifraCenterChrome
          user={user}
          billingPlan={billingPlan}
          title={title}
          subtitle={subtitle}
          durationLabel={durationLabel}
          className="min-h-0 flex-1 border-l-0"
        >
          <div className="mb-4 flex min-h-0 flex-1 flex-col gap-3">
            {variationMeta ? (
              <div className="rounded-xl border border-cifra-border bg-cifra-surface-2/40 px-3 py-3 sm:px-4">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-cifra-teal">
                  Versão personalizada
                </p>
                <div className="mt-2 space-y-2">
                  <div className="space-y-1">
                    <label htmlFor="cifra-variation-label" className="block text-[10px] text-cifra-muted">
                      Nome desta versão
                    </label>
                    <input
                      id="cifra-variation-label"
                      type="text"
                      value={variationLabel}
                      onChange={(e) => setVariationLabel(e.target.value.slice(0, 120))}
                      autoComplete="off"
                      placeholder="Ex.: Acústico · capo 2"
                      className="w-full rounded-lg border border-cifra-border bg-[#0c0c16] px-3 py-2 text-[12px] text-cifra-text outline-none ring-cifra-teal/25 focus:border-cifra-teal/40 focus:ring-1"
                    />
                  </div>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={setEditMode}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-colors",
                    mode === "edit"
                      ? "border-cifra-teal/40 bg-cifra-teal/15 text-cifra-teal"
                      : "border-cifra-border text-cifra-muted hover:border-cifra-teal/30",
                  )}
                >
                  <PencilLine className="size-3.5" strokeWidth={1.75} aria-hidden />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={setPreviewMode}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-colors",
                    mode === "preview"
                      ? "border-cifra-teal/40 bg-cifra-teal/15 text-cifra-teal"
                      : "border-cifra-border text-cifra-muted hover:border-cifra-teal/30",
                  )}
                >
                  <Eye className="size-3.5" strokeWidth={1.75} aria-hidden />
                  Pré-visualizar cifra
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={cifraPublicHref}
                  className="rounded-lg border border-cifra-border px-3 py-2 text-[11px] font-semibold text-cifra-muted transition-colors hover:border-cifra-teal/30 hover:text-cifra-text"
                >
                  Cancelar
                </Link>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cifra-teal px-4 py-2 text-[11px] font-semibold text-cifra-bg transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Save className="size-3.5" strokeWidth={1.75} aria-hidden />
                  {saving ? "A gravar…" : "Gravar alterações"}
                </button>
              </div>
            </div>
            {msg ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200/90">
                {msg}
              </p>
            ) : null}
            <div
              className={cn(
                "min-h-0 flex-1 overflow-auto rounded-xl border border-cifra-border bg-cifra-surface-2/30 p-4 md:p-5",
                mode !== "edit" && "hidden",
              )}
            >
              <CifraTranscriptionEditor
                ref={editorRef}
                initial={initialPayload}
                lyricsVariantLabel={lyricsVariantLabel}
                onRequestPreview={() => {
                  syncPreviewFromEditor();
                  setMode("preview");
                }}
              />
            </div>
            <div
              className={cn(
                "flex min-h-[min(100%,calc(100dvh-14rem))] min-w-0 flex-1 flex-col",
                mode !== "preview" && "hidden",
              )}
            >
              <CifraPocMount
                trackKey={previewTrackKey}
                payload={previewPayload}
                trackTitle={title}
                trackArtist={subtitle}
              />
            </div>
          </div>
        </CifraCenterChrome>
      </div>
    </div>
  );
}
