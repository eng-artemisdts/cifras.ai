"use client";

import { ChevronDown, Eye, Plus } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useMemo, useState, forwardRef } from "react";

import { patchChordSymbolAndTimes } from "@/components/cifra/cifra-chord-edit-popover";
import { CifraEditInspectorPanel } from "@/components/cifra/cifra-edit-inspector-panel";
import { CifraEditMetaSidebar } from "@/components/cifra/cifra-edit-meta-sidebar";
import { Slider } from "@/components/ui/slider";
import type {
  MusicAiChordEvent,
  MusicAiDemoPayload,
  MusicAiLyricSegment,
  MusicAiSection,
} from "@/lib/cifra/musicai-types";
import { mergeConsecutiveDuplicateSectionLabels, sortSections } from "@/lib/cifra/lyric-expand-clamp";
import {
  addWordSlot,
  applyWordSlotMoveToTarget,
  buildWordSlots,
  chordDisplayLabel,
  chordAnchorSlotIds,
  chordIndicesAttachedToSlot,
  chordIndicesInSectionWithoutWordAnchor,
  clusterSlotsByLyricSegment,
  createChordEvent,
  defaultChordTimesOnTimeRange,
  defaultChordTimesOnWordSlot,
  defaultTimesForNewWordInGroup,
  ensureLyricsSegmentCount,
  groupSlotsForEditorDisplay,
  maxTimelineEndSec,
  moveChordToSlot,
  moveChordToTimeRange,
  pickSegmentIndexForEditorGroup,
  rebuildLyricsFromSlots,
  sortedChordIndices,
  type LyricWordSlot,
} from "@/lib/cifra/transcription-editor-model";
import { cn } from "@/lib/utils";

const CHORD_DRAG_MIME = "application/x-cifra-chord-index";
const WORD_DRAG_MIME = "application/x-cifra-word-slot-id";

function formatSectionTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function initialSectionsState(raw: MusicAiSection[] | undefined | null): MusicAiSection[] {
  const filtered = (raw ?? []).filter(
    (sec) => Number.isFinite(sec.start) && Number.isFinite(sec.end) && sec.end > sec.start,
  );
  return mergeConsecutiveDuplicateSectionLabels(sortSections(filtered));
}

function SectionTimeInputs({
  sections,
  activeSectionIdx,
  totalMax,
  step,
  onCommitAll,
}: {
  sections: MusicAiSection[];
  activeSectionIdx: number;
  totalMax: number;
  step?: number;
  onCommitAll: (nextSections: MusicAiSection[]) => void;
}) {
  const min = 0;
  const max = Math.max(0.1, totalMax);
  const sliderStep = step ?? 0.05;
  const minDistance = Math.max(0.05, sliderStep);

  const breakpoints = useMemo(() => {
    const out = new Set<number>();
    for (const sec of sections) {
      out.add(Math.max(min, Math.min(max, Number(sec.start))));
      out.add(Math.max(min, Math.min(max, Number(sec.end))));
    }
    return Array.from(out).sort((a, b) => a - b);
  }, [sections, min, max]);

  const startIdxBySection = useMemo(
    () =>
      sections.map((sec) => {
        const val = Math.max(min, Math.min(max, Number(sec.start)));
        const idx = breakpoints.findIndex((b) => Math.abs(b - val) < 1e-6);
        return idx >= 0 ? idx : 0;
      }),
    [sections, breakpoints, min, max],
  );

  const endIdxBySection = useMemo(
    () =>
      sections.map((sec) => {
        const val = Math.max(min, Math.min(max, Number(sec.end)));
        const idx = breakpoints.findIndex((b) => Math.abs(b - val) < 1e-6);
        return idx >= 0 ? idx : Math.max(0, breakpoints.length - 1);
      }),
    [sections, breakpoints, min, max],
  );

  const breakpointLabels = useMemo(() => {
    return breakpoints.map((bp, idx) => {
      const refs: string[] = [];
      sections.forEach((sec, secIdx) => {
        const start = Math.max(min, Math.min(max, Number(sec.start)));
        const end = Math.max(min, Math.min(max, Number(sec.end)));
        if (Math.abs(start - bp) < 1e-6) refs.push(`Início ${sec.label || `Secção ${secIdx + 1}`}`);
        if (Math.abs(end - bp) < 1e-6) refs.push(`Fim ${sec.label || `Secção ${secIdx + 1}`}`);
      });
      const refText = refs.length ? refs.join(" • ") : `Breakpoint ${idx + 1}`;
      return `${refText} (${formatSectionTime(bp)})`;
    });
  }, [breakpoints, sections, min, max]);

  const active = sections[activeSectionIdx];
  const activeStart = active ? active.start : 0;
  const activeEnd = active ? active.end : 0;

  const commitBreakpoints = useCallback(
    (next: number[]) => {
      if (!next.length) return;
      const sorted = [...next].sort((a, b) => a - b);
      const nextSections = sections.map((sec, i) => {
        const sIdx = startIdxBySection[i] ?? 0;
        const eIdx = endIdxBySection[i] ?? Math.max(0, sorted.length - 1);
        const ns = sorted[Math.max(0, Math.min(sorted.length - 1, sIdx))] ?? sec.start;
        const neRaw = sorted[Math.max(0, Math.min(sorted.length - 1, eIdx))] ?? sec.end;
        const ne = Math.max(ns + 0.01, neRaw);
        return { ...sec, start: ns, end: ne };
      });
      onCommitAll(nextSections);
    },
    [sections, startIdxBySection, endIdxBySection, onCommitAll],
  );

  return (
    <div className="flex max-w-full flex-col gap-1.5 font-mono text-[9px] text-cifra-muted">
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0">Início/Fim (todas as secções)</span>
        <span className="shrink-0">Breakpoints globais</span>
      </div>
      <Slider
        value={breakpoints}
        min={min}
        max={max}
        step={sliderStep}
        thumbLabels={breakpointLabels}
        minStepsBetweenThumbs={Math.max(1, Math.round(minDistance / Math.max(0.001, step ?? 0.05)))}
        onValueChange={commitBreakpoints}
        onValueCommit={commitBreakpoints}
      />
      <span className="shrink-0 text-right tabular-nums text-cifra-muted/90">
        Secção atual: {formatSectionTime(activeStart)} — {formatSectionTime(activeEnd)}
      </span>
    </div>
  );
}

function WordSlotInlineEditor({
  slot,
  onApply,
  onCancel,
}: {
  slot: LyricWordSlot;
  onApply: (text: string, start: number, end: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(slot.text);
  const [sStr, setSStr] = useState(() => String(Number(slot.start.toFixed(3))));
  const [eStr, setEStr] = useState(() => String(Number(slot.end.toFixed(3))));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setText(slot.text);
    setSStr(String(Number(slot.start.toFixed(3))));
    setEStr(String(Number(slot.end.toFixed(3))));
    setErr(null);
  }, [slot.id, slot.text, slot.start, slot.end]);

  const apply = () => {
    const t = text.trim() || "·";
    const s = parseFloat(sStr.replace(",", "."));
    const e = parseFloat(eStr.replace(",", "."));
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
      setErr("Use números válidos; o fim deve ser maior que o início.");
      return;
    }
    setErr(null);
    onApply(t, s, Math.max(s + 0.02, e));
  };

  return (
    <div className="flex w-full min-w-[8.5rem] max-w-56 flex-col gap-1.5 rounded-md border border-cifra-teal/40 bg-[#080810] p-1.5">
      <input
        autoFocus
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            apply();
          }
          if (ev.key === "Escape") onCancel();
        }}
        className="w-full rounded border border-cifra-border bg-[#0c0c16] px-1.5 py-1 text-center text-[12px] text-cifra-text outline-none focus:border-cifra-teal/40"
        aria-label="Texto da palavra"
      />
      <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5">
        <label className="col-span-2 text-[9px] font-medium text-cifra-muted">Tempos (s)</label>
        <input
          value={sStr}
          onChange={(ev) => setSStr(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              apply();
            }
            if (ev.key === "Escape") onCancel();
          }}
          inputMode="decimal"
          placeholder="Início"
          className="w-full rounded border border-cifra-border bg-[#0c0c16] px-1 py-0.5 font-mono text-[10px] text-cifra-text outline-none focus:border-cifra-teal/40"
          aria-label="Início da palavra em segundos"
        />
        <input
          value={eStr}
          onChange={(ev) => setEStr(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              apply();
            }
            if (ev.key === "Escape") onCancel();
          }}
          inputMode="decimal"
          placeholder="Fim"
          className="w-full rounded border border-cifra-border bg-[#0c0c16] px-1 py-0.5 font-mono text-[10px] text-cifra-text outline-none focus:border-cifra-teal/40"
          aria-label="Fim da palavra em segundos"
        />
      </div>
      {err ? (
        <p className="text-[10px] leading-tight text-red-300/90" role="alert">
          {err}
        </p>
      ) : null}
      <div className="flex justify-end gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-cifra-border px-2 py-0.5 text-[10px] font-semibold text-cifra-muted transition-colors hover:border-cifra-teal/30 hover:text-cifra-text"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={apply}
          className="rounded bg-cifra-teal px-2.5 py-0.5 text-[10px] font-semibold text-cifra-bg transition-opacity hover:opacity-95"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function formatDurationSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const frac = s.toFixed(2).padStart(5, "0");
  return `${m}:${frac}`;
}

function segmentIndexFromSegmentGroupKey(groupKey: string): number | null {
  const m = /^seg-(\d+)$/.exec(groupKey);
  if (!m) return null;
  return parseInt(m[1]!, 10);
}

function AddWordForm({
  defaultStart,
  defaultEnd,
  onApply,
  onCancel,
}: {
  defaultStart: number;
  defaultEnd: number;
  onApply: (text: string, start: number, end: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("·");
  const [sStr, setSStr] = useState(() => String(Number(defaultStart.toFixed(3))));
  const [eStr, setEStr] = useState(() => String(Number(defaultEnd.toFixed(3))));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSStr(String(Number(defaultStart.toFixed(3))));
    setEStr(String(Number(defaultEnd.toFixed(3))));
    setErr(null);
  }, [defaultStart, defaultEnd]);

  const apply = () => {
    const t = text.trim() || "·";
    const s = parseFloat(sStr.replace(",", "."));
    const e = parseFloat(eStr.replace(",", "."));
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
      setErr("Tempos inválidos.");
      return;
    }
    setErr(null);
    onApply(t, s, Math.max(s + 0.02, e));
  };

  return (
    <div className="flex w-full max-w-xs flex-col gap-1.5 rounded-md border border-cifra-teal/35 bg-[#0c0c14] p-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-cifra-muted">Nova palavra</p>
      <input
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        className="w-full rounded border border-cifra-border bg-[#0c0c16] px-1.5 py-1 text-[11px] text-cifra-text outline-none focus:border-cifra-teal/40"
        placeholder="Texto"
      />
      <div className="grid grid-cols-2 gap-1">
        <input
          value={sStr}
          onChange={(ev) => setSStr(ev.target.value)}
          inputMode="decimal"
          className="rounded border border-cifra-border bg-[#0c0c16] px-1 py-0.5 font-mono text-[10px] text-cifra-text"
          aria-label="Início (s)"
        />
        <input
          value={eStr}
          onChange={(ev) => setEStr(ev.target.value)}
          inputMode="decimal"
          className="rounded border border-cifra-border bg-[#0c0c16] px-1 py-0.5 font-mono text-[10px] text-cifra-text"
          aria-label="Fim (s)"
        />
      </div>
      {err ? <p className="text-[10px] text-red-300/90">{err}</p> : null}
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-cifra-border px-2 py-0.5 text-[10px] text-cifra-muted hover:border-cifra-teal/30"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={apply}
          className="rounded bg-cifra-teal px-2 py-0.5 text-[10px] font-semibold text-cifra-bg"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}

function AddChordForm({
  defaultStart,
  defaultEnd,
  onApply,
  onCancel,
}: {
  defaultStart: number;
  defaultEnd: number;
  onApply: (symbol: string, start: number, end: number) => void;
  onCancel: () => void;
}) {
  const [symbol, setSymbol] = useState("C");
  const [sStr, setSStr] = useState(() => String(Number(defaultStart.toFixed(3))));
  const [eStr, setEStr] = useState(() => String(Number(defaultEnd.toFixed(3))));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSStr(String(Number(defaultStart.toFixed(3))));
    setEStr(String(Number(defaultEnd.toFixed(3))));
    setErr(null);
  }, [defaultStart, defaultEnd]);

  const apply = () => {
    const s = parseFloat(sStr.replace(",", "."));
    const e = parseFloat(eStr.replace(",", "."));
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
      setErr("Tempos inválidos.");
      return;
    }
    setErr(null);
    onApply(symbol.trim() || "N.C.", s, Math.max(s + 0.05, e));
  };

  return (
    <div className="flex w-full max-w-[11.5rem] flex-col gap-1.5 rounded-md border border-cifra-teal/35 bg-[#0c0c14] p-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-cifra-muted">Novo acorde</p>
      <input
        value={symbol}
        onChange={(ev) => setSymbol(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            apply();
          }
          if (ev.key === "Escape") onCancel();
        }}
        className="w-full rounded border border-cifra-border bg-[#0c0c16] px-1.5 py-1 text-center font-mono text-[12px] text-cifra-text outline-none focus:border-cifra-teal/40"
        placeholder="ex. Am7"
        aria-label="Símbolo do acorde"
      />
      <div className="grid grid-cols-2 gap-1">
        <input
          value={sStr}
          onChange={(ev) => setSStr(ev.target.value)}
          inputMode="decimal"
          className="rounded border border-cifra-border bg-[#0c0c16] px-1 py-0.5 font-mono text-[10px] text-cifra-text"
          aria-label="Início (s)"
        />
        <input
          value={eStr}
          onChange={(ev) => setEStr(ev.target.value)}
          inputMode="decimal"
          className="rounded border border-cifra-border bg-[#0c0c16] px-1 py-0.5 font-mono text-[10px] text-cifra-text"
          aria-label="Fim (s)"
        />
      </div>
      {err ? <p className="text-[10px] text-red-300/90">{err}</p> : null}
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-cifra-border px-2 py-0.5 text-[10px] text-cifra-muted hover:border-cifra-teal/30"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={apply}
          className="rounded bg-cifra-teal px-2 py-0.5 text-[10px] font-semibold text-cifra-bg"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}

function AddSectionForm({
  defaultStart,
  defaultEnd,
  onAdd,
  onCancel,
}: {
  defaultStart: number;
  defaultEnd: number;
  onAdd: (label: string, start: number, end: number) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("Nova secção");
  const [sStr, setSStr] = useState(() => String(Number(defaultStart.toFixed(3))));
  const [eStr, setEStr] = useState(() => String(Number(defaultEnd.toFixed(3))));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSStr(String(Number(defaultStart.toFixed(3))));
    setEStr(String(Number(defaultEnd.toFixed(3))));
    setErr(null);
  }, [defaultStart, defaultEnd]);

  const apply = () => {
    const s = parseFloat(sStr.replace(",", "."));
    const e = parseFloat(eStr.replace(",", "."));
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
      setErr("Intervalo inválido.");
      return;
    }
    setErr(null);
    onAdd(label.trim() || "Nova secção", s, Math.max(s + 0.01, e));
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-lg border border-cifra-teal/35 bg-[#0c0c14] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-cifra-muted">Nova secção</p>
      <input
        value={label}
        onChange={(ev) => setLabel(ev.target.value)}
        className="w-full rounded border border-cifra-border bg-[#0c0c16] px-2 py-1.5 text-[12px] text-cifra-text outline-none focus:border-cifra-teal/40"
        placeholder="Rótulo"
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-cifra-muted">Início / fim (s)</span>
        <input
          value={sStr}
          onChange={(ev) => setSStr(ev.target.value)}
          inputMode="decimal"
          className="w-20 rounded border border-cifra-border bg-[#0c0c16] px-1.5 py-1 font-mono text-[11px]"
        />
        <input
          value={eStr}
          onChange={(ev) => setEStr(ev.target.value)}
          inputMode="decimal"
          className="w-20 rounded border border-cifra-border bg-[#0c0c16] px-1.5 py-1 font-mono text-[11px]"
        />
      </div>
      {err ? <p className="text-[10px] text-red-300/90">{err}</p> : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-cifra-border px-2 py-1 text-[10px] text-cifra-muted hover:border-cifra-teal/30"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={apply}
          className="rounded bg-cifra-teal px-3 py-1 text-[10px] font-semibold text-cifra-bg"
        >
          Adicionar secção
        </button>
      </div>
    </div>
  );
}

export type CifraTranscriptionEditorHandle = {
  getPayload: () => MusicAiDemoPayload;
};

export type CifraTranscriptionEditorProps = {
  initial: MusicAiDemoPayload;
  className?: string;
  /** Abre o leitor de pré-visualização com o payload atual (ex.: shell de edição). */
  onRequestPreview?: () => void;
  /** Rótulo da variante de letra (sidebar). */
  lyricsVariantLabel?: string;
};

type AddChordContext =
  | { kind: "slot"; slotId: string; defaultStart: number; defaultEnd: number }
  | { kind: "range"; sectionKey: string; defaultStart: number; defaultEnd: number };

/**
 * Edição de letra (duplo clique), acordes no painel à direita e arrasto entre palavras/secções;
 * tempos de secção editáveis quando `sections` existem no payload.
 */
export const CifraTranscriptionEditor = forwardRef<CifraTranscriptionEditorHandle, CifraTranscriptionEditorProps>(
  function CifraTranscriptionEditor({ initial, className, onRequestPreview, lyricsVariantLabel = "Letra" }, ref) {
    const [lyricsSegments, setLyricsSegments] = useState<MusicAiLyricSegment[]>(
      () => [...(initial.lyrics ?? [])],
    );
    const [slots, setSlots] = useState<LyricWordSlot[]>(() => buildWordSlots(initial.lyrics ?? []));
    const [chords, setChords] = useState<MusicAiChordEvent[]>(() => [...(initial.chords ?? [])]);
    const [sections, setSections] = useState<MusicAiSection[]>(() => initialSectionsState(initial.sections));
    const [editingId, setEditingId] = useState<string | null>(null);
    const [dragChordIdx, setDragChordIdx] = useState<number | null>(null);
    const [dragWordSlotId, setDragWordSlotId] = useState<string | null>(null);
    const [dropSlotId, setDropSlotId] = useState<string | null>(null);
    const [dropSectionKey, setDropSectionKey] = useState<string | null>(null);
    const [newWordContext, setNewWordContext] = useState<{
      groupKey: string;
      defaultStart: number;
      defaultEnd: number;
    } | null>(null);
    const [addChordContext, setAddChordContext] = useState<AddChordContext | null>(null);
    const [addSectionOpen, setAddSectionOpen] = useState(false);
    const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
    const [activeChordIndex, setActiveChordIndex] = useState<number | null>(null);
    const [guideOpen, setGuideOpen] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    const toggleSectionCollapsed = useCallback((key: string) => {
      setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleChordApply = useCallback((index: number, next: MusicAiChordEvent) => {
      setChords((prev) => prev.map((c, i) => (i === index ? next : c)));
    }, []);

    const handleChordRemove = useCallback((index: number) => {
      setChords((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleInspectChordRemove = useCallback(
      (index: number) => {
        handleChordRemove(index);
        setActiveChordIndex((curr) => {
          if (curr == null) return null;
          if (curr === index) return null;
          if (curr > index) return curr - 1;
          return curr;
        });
      },
      [handleChordRemove],
    );

    const finalizeSections = useCallback(
      (next: MusicAiSection[]) =>
        mergeConsecutiveDuplicateSectionLabels(
          sortSections(next.map((s) => ({ ...s, end: Math.max(s.start + 0.01, s.end) }))),
        ),
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        getPayload: () => ({
          ...initial,
          lyrics: rebuildLyricsFromSlots(lyricsSegments, slots),
          chords,
          sections: finalizeSections(sections),
        }),
      }),
      [initial, lyricsSegments, slots, chords, sections, finalizeSections],
    );

    const sectionGroups = useMemo(() => groupSlotsForEditorDisplay(slots, sections), [slots, sections]);

    const chordAnchors = useMemo(() => chordAnchorSlotIds(slots, chords), [slots, chords]);

    const referenceDurationSec = initial.meta?.duration_seconds;
    const contentTimelineEnd = useMemo(
      () => maxTimelineEndSec(slots, chords, sections),
      [slots, chords, sections],
    );
    const durationMismatch = useMemo(() => {
      const ref = referenceDurationSec;
      if (ref == null || !Number.isFinite(ref) || ref <= 0) return null;
      const delta = Math.abs(contentTimelineEnd - ref);
      if (delta <= 0.35) return null;
      return { ref, end: contentTimelineEnd, delta };
    }, [referenceDurationSec, contentTimelineEnd]);

    const defaultNewSectionRange = useMemo(() => {
      const ref = referenceDurationSec;
      const tail = sections.length ? Math.max(...sections.map((s) => s.end)) : 0;
      const hasRef = ref != null && Number.isFinite(ref) && ref > tail + 0.5;
      const endGuess = hasRef
        ? ref
        : tail + Math.max(8, Math.min(45, contentTimelineEnd - tail + 5));
      return { start: tail, end: Math.max(tail + 0.5, endGuess) };
    }, [sections, referenceDurationSec, contentTimelineEnd]);

    const commitAddWord = useCallback(
      (ctx: { groupKey: string; defaultStart: number; defaultEnd: number }, text: string, start: number, end: number) => {
        let segmentIndex = 0;
        if (ctx.groupKey !== "__bootstrap") {
          const g = sectionGroups.find((x) => x.key === ctx.groupKey);
          if (g) {
            segmentIndex =
              segmentIndexFromSegmentGroupKey(g.key) ?? pickSegmentIndexForEditorGroup(g.slots);
          }
        }
        setLyricsSegments((prev) => ensureLyricsSegmentCount(prev, segmentIndex + 1));
        setSlots((prev) => addWordSlot(prev, segmentIndex, text, start, end));
        setNewWordContext(null);
        setAddChordContext(null);
      },
      [sectionGroups],
    );

    const commitAddSection = useCallback(
      (label: string, start: number, end: number) => {
        setSections((prev) => finalizeSections([...prev, { label, start, end: Math.max(start + 0.01, end) }]));
        setAddSectionOpen(false);
      },
      [finalizeSections],
    );

    const commitAddChord = useCallback((symbol: string, start: number, end: number) => {
      let newIndex = 0;
      setChords((prev) => {
        newIndex = prev.length;
        return [...prev, createChordEvent(symbol, start, end)];
      });
      setAddChordContext(null);
      setActiveChordIndex(newIndex);
    }, []);

    const handleChordEndChange = useCallback(
      (index: number, nextEnd: number) => {
        setChords((prev) => {
          const c = prev[index];
          if (!c) return prev;
          const next = [...prev];
          next[index] = { ...c, end: nextEnd };
          return next;
        });
      },
      [],
    );

    const activeSlot = useMemo(() => slots.find((s) => s.id === activeSlotId) ?? null, [slots, activeSlotId]);
    const activeChord = activeChordIndex != null ? chords[activeChordIndex] ?? null : null;

    useEffect(() => {
      if (!activeSlotId) return;
      const slot = slots.find((s) => s.id === activeSlotId);
      if (!slot) {
        setActiveSlotId(null);
        setActiveChordIndex(null);
        return;
      }
      const idxs = chordIndicesAttachedToSlot(slots, chords, slot, chordAnchors);
      if (activeChordIndex != null && !idxs.includes(activeChordIndex)) {
        setActiveChordIndex(idxs[0] ?? null);
      }
    }, [activeSlotId, activeChordIndex, slots, chords, chordAnchors]);

    const applyBulkLine = useCallback(
      (line: string) => {
        const parts = line.trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return;
        let targetSlots: LyricWordSlot[] = [];
        if (activeSlotId) {
          const g = sectionGroups.find((sg) => sg.slots.some((s) => s.id === activeSlotId));
          if (g) targetSlots = g.slots;
        }
        if (!targetSlots.length && sectionGroups[0]) targetSlots = sectionGroups[0]!.slots;
        const n = Math.min(parts.length, targetSlots.length);
        if (!n) return;
        setSlots((prev) =>
          prev.map((s) => {
            const i = targetSlots.findIndex((t) => t.id === s.id);
            if (i < 0 || i >= n) return s;
            return { ...s, text: parts[i]! };
          }),
        );
      },
      [activeSlotId, sectionGroups],
    );

    const patchSectionTimes = useCallback(
      (sectionIdx: number, start: number, end: number) => {
        setSections((prev) => {
          const sorted = sortSections(prev);
          if (sectionIdx < 0 || sectionIdx >= sorted.length) return prev;
          const next = sorted.map((s, i) =>
            i === sectionIdx ? { ...s, start, end: Math.max(start + 0.01, end) } : s,
          );
          return finalizeSections(next);
        });
      },
      [finalizeSections],
    );

    const patchSectionBreakpoints = useCallback(
      (nextSections: MusicAiSection[]) => {
        setSections(() => finalizeSections(nextSections));
      },
      [finalizeSections],
    );

    const applyWordSlotEdit = useCallback(
      (slotId: string, text: string, start: number, end: number) => {
        const slotBefore = slots.find((s) => s.id === slotId);
        if (!slotBefore) {
          setEditingId(null);
          return;
        }
        const chordIdxs = chordIndicesAttachedToSlot(slots, chords, slotBefore, chordAnchors);
        const updatedSlot: LyricWordSlot = {
          ...slotBefore,
          text,
          start,
          end: Math.max(start + 0.02, end),
        };
        const nextSlots = slots.map((s) => (s.id === slotId ? updatedSlot : s));
        let nextChords = chords.map((c) => ({ ...c }));
        for (const ci of chordIdxs) {
          nextChords = moveChordToSlot(nextChords, ci, updatedSlot, sortedChordIndices(nextChords));
        }
        setSlots(nextSlots);
        setChords(nextChords);
        setEditingId(null);
      },
      [slots, chords, chordAnchors],
    );

    const isChordDrag = useCallback((e: React.DragEvent) => {
      return Array.from(e.dataTransfer.types).includes(CHORD_DRAG_MIME);
    }, []);

    const isWordDrag = useCallback((e: React.DragEvent) => {
      return Array.from(e.dataTransfer.types).includes(WORD_DRAG_MIME);
    }, []);

    const onDragOverWord = useCallback(
      (e: React.DragEvent) => {
        if (!isChordDrag(e) && !isWordDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      },
      [isChordDrag, isWordDrag],
    );

    const onDropWord = useCallback(
      (slot: LyricWordSlot, e: React.DragEvent) => {
        e.preventDefault();
        const chordRaw = e.dataTransfer.getData(CHORD_DRAG_MIME);
        if (chordRaw) {
          const idx = parseInt(chordRaw, 10);
          if (!Number.isFinite(idx) || idx < 0 || idx >= chords.length) {
            setDragChordIdx(null);
            return;
          }
          const order = sortedChordIndices(chords);
          setChords(moveChordToSlot(chords, idx, slot, order));
          setDragChordIdx(null);
          setDropSlotId(null);
          setDropSectionKey(null);
          return;
        }
        const wordRaw = e.dataTransfer.getData(WORD_DRAG_MIME);
        if (wordRaw && wordRaw !== slot.id) {
          const { slots: nextSlots, chords: nextChords } = applyWordSlotMoveToTarget(
            slots,
            chords,
            wordRaw,
            slot,
          );
          setSlots(nextSlots);
          setChords(nextChords);
        }
        setDragWordSlotId(null);
        setDropSlotId(null);
        setDropSectionKey(null);
      },
      [chords, slots],
    );

    /** Secção ou segmento sem palavras: largar acorde alinha ao intervalo temporal do bloco. */
    const onDropChordOnlyZone = useCallback(
      (rangeStart: number, rangeEnd: number, e: React.DragEvent) => {
        e.preventDefault();
        const chordRaw = e.dataTransfer.getData(CHORD_DRAG_MIME);
        if (chordRaw) {
          const idx = parseInt(chordRaw, 10);
          if (!Number.isFinite(idx) || idx < 0 || idx >= chords.length) {
            setDragChordIdx(null);
            return;
          }
          const order = sortedChordIndices(chords);
          setChords(moveChordToTimeRange(chords, idx, rangeStart, rangeEnd, order));
          setDragChordIdx(null);
          setDropSectionKey(null);
          return;
        }
        if (e.dataTransfer.getData(WORD_DRAG_MIME)) setDragWordSlotId(null);
      },
      [chords],
    );

    const dragActive = dragChordIdx !== null || dragWordSlotId !== null;

    const onPickDictionaryChord = useCallback(
      (symbol: string) => {
        if (!activeSlot) return;
        const idxs = chordIndicesAttachedToSlot(slots, chords, activeSlot, chordAnchors);
        if (idxs.length > 0 && activeChordIndex != null) {
          const c = chords[activeChordIndex];
          if (c) {
            handleChordApply(
              activeChordIndex,
              patchChordSymbolAndTimes(c, Number(c.start ?? 0), Number(c.end ?? c.start + 0.1), symbol),
            );
          }
          return;
        }
        const dt = defaultChordTimesOnWordSlot(slots, chords, activeSlot);
        const insertIdx = chords.length;
        setChords((prev) => [...prev, createChordEvent(symbol, dt.start, dt.end)]);
        setActiveChordIndex(insertIdx);
      },
      [activeSlot, activeChordIndex, chords, handleChordApply, slots, chordAnchors],
    );

    const metaPayload: MusicAiDemoPayload = {
      ...initial,
      lyrics: rebuildLyricsFromSlots(lyricsSegments, slots),
      chords,
      sections: finalizeSections(sections),
    };

    return (
      <div className={cn("flex min-h-0 flex-1 flex-col gap-4 lg:flex-row", className)}>
        <CifraEditMetaSidebar
          payload={metaPayload}
          lyricsVariantLabel={lyricsVariantLabel}
          onBulkApplyLine={applyBulkLine}
        />
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <section className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cifra-muted">
              Letra e acordes
            </h2>
            {onRequestPreview ? (
              <button
                type="button"
                onClick={onRequestPreview}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cifra-teal/40 bg-cifra-teal/10 px-2.5 py-1.5 text-[10px] font-semibold text-cifra-teal transition-colors hover:border-cifra-teal/55 hover:bg-cifra-teal/15"
              >
                <Eye className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                Pré-visualizar alterações
              </button>
            ) : null}
          </div>
          <div className="rounded-lg border border-cifra-border bg-cifra-surface/80 px-3 py-2">
            <button
              type="button"
              onClick={() => setGuideOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold text-cifra-text"
            >
              Guia rápido
              <span className="font-mono text-[10px] font-normal text-cifra-teal">{guideOpen ? "Recolher" : "Expandir"}</span>
            </button>
            {guideOpen ? (
              <p className="mt-2 text-[10px] leading-snug text-cifra-muted">
                Toque numa palavra para a selecionar (painel à direita). Duplo clique edita letra e tempos. «Acorde na
                palavra ativa» adiciona acorde à palavra selecionada. Arraste o símbolo do acorde ou a célula da palavra
                para mover. Dicionário e edição em massa ficam nas colunas laterais.
              </p>
            ) : (
              <p className="mt-1 text-[10px] leading-snug text-cifra-muted">
                O centro mostra só a leitura; detalhes e duração do acorde no painel à direita.
              </p>
            )}
          </div>
          {durationMismatch ? (
            <div
              className="rounded-lg border border-amber-500/40 bg-amber-500/12 px-3 py-2 text-[11px] leading-snug text-amber-100/95"
              role="status"
            >
              A duração da faixa em meta ({formatDurationSeconds(durationMismatch.ref)} s) não coincide com o fim do
              conteúdo atual (~{formatDurationSeconds(durationMismatch.end)} s; Δ ≈{" "}
              {formatDurationSeconds(durationMismatch.delta)}). Corrija se não for intencional.
            </div>
          ) : null}
          <div className="space-y-4">
            <div className="flex flex-wrap items-start gap-2">
              {!addSectionOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setAddChordContext(null);
                    setAddSectionOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-cifra-teal/35 bg-cifra-teal/5 px-2.5 py-1.5 text-[10px] font-semibold text-cifra-teal hover:bg-cifra-teal/10"
                >
                  <Plus className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  Nova secção
                </button>
              ) : (
                <AddSectionForm
                  defaultStart={defaultNewSectionRange.start}
                  defaultEnd={defaultNewSectionRange.end}
                  onAdd={commitAddSection}
                  onCancel={() => setAddSectionOpen(false)}
                />
              )}
              <button
                type="button"
                disabled={!activeSlot}
                onClick={() => {
                  if (!activeSlot) return;
                  setNewWordContext(null);
                  const dt = defaultChordTimesOnWordSlot(slots, chords, activeSlot);
                  setAddChordContext({
                    kind: "slot",
                    slotId: activeSlot.id,
                    defaultStart: dt.start,
                    defaultEnd: dt.end,
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cifra-teal/35 bg-cifra-teal/10 px-2.5 py-1.5 text-[10px] font-semibold text-cifra-teal hover:bg-cifra-teal/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                Acorde na palavra ativa
              </button>
            </div>
            {addChordContext?.kind === "slot" ? (
              <AddChordForm
                defaultStart={addChordContext.defaultStart}
                defaultEnd={addChordContext.defaultEnd}
                onApply={(sym, s, e) => commitAddChord(sym, s, e)}
                onCancel={() => setAddChordContext(null)}
              />
            ) : null}

            {sectionGroups.length === 0 ? (
              <div className="rounded-xl border border-cifra-border bg-cifra-surface px-4 py-4">
                <p className="mb-3 text-[11px] leading-snug text-cifra-muted">
                  Ainda não há palavras nesta vista. Adicione uma primeira palavra (letra no segmento 0) ou crie secções
                  e depois palavras em cada bloco.
                </p>
                <div className="flex flex-wrap gap-3">
                  {newWordContext?.groupKey === "__bootstrap" ? (
                    <AddWordForm
                      defaultStart={newWordContext.defaultStart}
                      defaultEnd={newWordContext.defaultEnd}
                      onApply={(text, s, e) => commitAddWord(newWordContext, text, s, e)}
                      onCancel={() => setNewWordContext(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddChordContext(null);
                        setNewWordContext({ groupKey: "__bootstrap", defaultStart: 0, defaultEnd: 1 });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-cifra-teal/35 px-2.5 py-1.5 text-[10px] font-semibold text-cifra-teal hover:bg-cifra-teal/10"
                    >
                      <Plus className="size-3.5 shrink-0" aria-hidden />
                      Primeira palavra
                    </button>
                  )}
                </div>
              </div>
            ) : (
            sectionGroups.map((group) => {
              const sec =
                group.sectionIdx !== undefined ? sections[group.sectionIdx] ?? null : null;
              const totalTimelineMax = Math.max(
                referenceDurationSec ?? 0,
                contentTimelineEnd,
                ...sections.map((s) => s.end),
                sec?.end ?? 0,
              );
              const sectionCollapsed = collapsedSections[group.key] === true;
              return (
                <div key={group.key} className="rounded-[14px] border border-cifra-border bg-cifra-surface p-[18px]">
                  <button
                    type="button"
                    onClick={() => toggleSectionCollapsed(group.key)}
                    className="flex w-full items-center justify-between gap-x-3 gap-y-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-cifra-teal/35 focus-visible:ring-offset-2 focus-visible:ring-offset-cifra-surface"
                    aria-expanded={!sectionCollapsed}
                    aria-controls={`cifra-section-body-${group.key}`}
                    id={`cifra-section-head-${group.key}`}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <ChevronDown
                        strokeWidth={2}
                        className={cn(
                          "size-4 shrink-0 text-cifra-muted transition-transform duration-200",
                          sectionCollapsed && "-rotate-90",
                        )}
                        aria-hidden
                      />
                      <span className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-cifra-teal">
                        {group.title}
                      </span>
                    </span>
                    <span className="shrink-0 text-right font-mono text-[10px] tabular-nums text-cifra-muted">
                      {formatSectionTime(group.start)} — {formatSectionTime(group.end)}
                    </span>
                  </button>

                  {!sectionCollapsed ? (
                    <div
                      id={`cifra-section-body-${group.key}`}
                      role="region"
                      aria-labelledby={`cifra-section-head-${group.key}`}
                      className="mt-2.5 flex flex-col gap-2.5"
                    >
                      {sec && group.sectionIdx !== undefined ? (
                        <div className="w-full min-w-0 border-b border-white/6 pb-2.5">
                          <SectionTimeInputs
                            sections={sections}
                            activeSectionIdx={group.sectionIdx!}
                            totalMax={totalTimelineMax}
                            step={0.05}
                            onCommitAll={patchSectionBreakpoints}
                          />
                        </div>
                      ) : null}

                      <div className="rounded-[10px] border border-white/5 bg-cifra-surface-2/80 px-[14px] py-[14px]">
                    {group.slots.length === 0 ? (
                      <div
                        role="region"
                        aria-label="Zona para largar acordes nesta secção sem letra"
                        className={cn(
                          "flex min-h-22 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
                          dragActive && "border-cifra-teal/45 bg-cifra-teal/6 ring-1 ring-dashed ring-cifra-teal/25",
                          dropSectionKey === group.key && "border-cifra-teal bg-cifra-teal/12 ring-2 ring-cifra-teal/40",
                          !dragActive && "border-white/12",
                        )}
                        onDragOver={onDragOverWord}
                        onDragEnter={(e) => {
                          if (!isChordDrag(e)) return;
                          setDropSectionKey(group.key);
                        }}
                        onDragLeave={() => {
                          setDropSectionKey((prev) => (prev === group.key ? null : prev));
                        }}
                        onDrop={(e) => onDropChordOnlyZone(group.start, group.end, e)}
                      >
                        <p className="text-[11px] text-cifra-muted/90">
                          Sem palavras (intro, instrumental…)
                        </p>
                        {(() => {
                          const instIdxs = chordIndicesInSectionWithoutWordAnchor(
                            slots,
                            chords,
                            group.start,
                            group.end,
                          );
                          if (!instIdxs.length) return null;
                          return (
                            <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
                              {instIdxs.map((ci) => {
                                const chord = chords[ci]!;
                                const label = chordDisplayLabel(chord);
                                return (
                                  <span
                                    key={`${group.key}-inst-${ci}`}
                                    data-cifra-chord-slot
                                    data-chord-index={ci}
                                    draggable
                                    aria-label={`Acorde ${label} nesta secção sem letra`}
                                    title="Arraste para outra secção ou palavra"
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      e.dataTransfer.setData(CHORD_DRAG_MIME, String(ci));
                                      e.dataTransfer.effectAllowed = "move";
                                      setDragChordIdx(ci);
                                    }}
                                    onDragEnd={() => {
                                      setDragChordIdx(null);
                                      setDropSlotId(null);
                                      setDropSectionKey(null);
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveSlotId(null);
                                      setActiveChordIndex(ci);
                                    }}
                                    className={cn(
                                      "cursor-grab touch-none rounded-md px-2 py-1 text-center font-mono text-[12px] font-semibold text-cifra-teal transition-colors hover:bg-cifra-teal/15 active:cursor-grabbing",
                                      activeChordIndex === ci &&
                                        activeSlotId === null &&
                                        "bg-cifra-teal/15 text-cifra-teal",
                                    )}
                                  >
                                    {label}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                        <p className="max-w-sm text-[10px] leading-snug text-cifra-muted/75">
                          Arraste o acorde para aqui: o início alinha ao início desta secção (
                          {formatSectionTime(group.start)}).
                        </p>
                        {addChordContext?.kind === "range" && addChordContext.sectionKey === group.key ? (
                          <AddChordForm
                            defaultStart={addChordContext.defaultStart}
                            defaultEnd={addChordContext.defaultEnd}
                            onApply={(sym, s, e) => commitAddChord(sym, s, e)}
                            onCancel={() => setAddChordContext(null)}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setNewWordContext(null);
                              const dt = defaultChordTimesOnTimeRange(chords, group.start, group.end);
                              setAddChordContext({
                                kind: "range",
                                sectionKey: group.key,
                                defaultStart: dt.start,
                                defaultEnd: dt.end,
                              });
                            }}
                            className="mt-1 inline-flex items-center gap-1 rounded-md border border-dashed border-cifra-teal/35 px-2 py-1 text-[10px] font-semibold text-cifra-teal hover:bg-cifra-teal/10"
                          >
                            <Plus className="size-3 shrink-0" strokeWidth={2} aria-hidden />
                            Acorde
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {clusterSlotsByLyricSegment(group.slots).map((phraseSlots, phraseIdx) => (
                          <div
                            key={`${group.key}-phrase-${phraseSlots[0]?.segmentIndex ?? phraseIdx}`}
                            className="flex w-full flex-wrap items-end gap-x-2 gap-y-2 border-b border-white/6 pb-3 last:border-b-0 last:pb-0"
                          >
                            {phraseSlots.map((slot) => {
                              const chordIdxs = chordIndicesAttachedToSlot(slots, chords, slot, chordAnchors);
                              const hasChord = chordIdxs.length > 0;
                              return (
                                <div
                                  key={slot.id}
                                  role="group"
                                  aria-label={`Célula: ${slot.text}`}
                                  tabIndex={editingId === slot.id ? -1 : 0}
                                  draggable={editingId !== slot.id}
                                  className={cn(
                                    "flex min-h-[3.5rem] min-w-10 flex-col items-stretch justify-end gap-1 rounded-lg px-2 py-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cifra-teal/35",
                                    editingId === slot.id ? "max-w-56" : "max-w-[11rem]",
                                    hasChord && "border border-cifra-teal/40 bg-[#0FD2C112]",
                                    !hasChord && "border border-transparent",
                                    activeSlotId === slot.id && "bg-cifra-teal/8",
                                    editingId !== slot.id && "cursor-grab active:cursor-grabbing",
                                    dragActive && "bg-cifra-teal/6 ring-1 ring-dashed ring-cifra-teal/25",
                                    dropSlotId === slot.id && "bg-cifra-teal/14 ring-2 ring-cifra-teal/40",
                                  )}
                                  onDragStart={(e) => {
                                    if (editingId === slot.id) return;
                                    e.dataTransfer.setData(WORD_DRAG_MIME, slot.id);
                                    e.dataTransfer.effectAllowed = "move";
                                    setDragWordSlotId(slot.id);
                                  }}
                                  onDragEnd={() => setDragWordSlotId(null)}
                                  onDragOver={onDragOverWord}
                                  onDragEnter={(e) => {
                                    if (!isChordDrag(e) && !isWordDrag(e)) return;
                                    setDropSlotId(slot.id);
                                  }}
                                  onDragLeave={() => {
                                    setDropSlotId((prev) => (prev === slot.id ? null : prev));
                                  }}
                                  onDrop={(e) => onDropWord(slot, e)}
                                  onClick={(e) => {
                                    const root = e.currentTarget;
                                    const t = e.target;
                                    if (!(t instanceof Node) || !root.contains(t)) return;
                                    const el = t instanceof Element ? t : t.parentElement;
                                    const chordEl = el?.closest("[data-cifra-chord-slot]");
                                    if (chordEl && root.contains(chordEl)) {
                                      const raw = chordEl.getAttribute("data-chord-index");
                                      const idx = raw != null ? parseInt(raw, 10) : NaN;
                                      if (Number.isFinite(idx)) {
                                        setActiveSlotId(slot.id);
                                        setActiveChordIndex(idx);
                                        return;
                                      }
                                    }
                                    setActiveSlotId(slot.id);
                                    const idxs = chordIndicesAttachedToSlot(slots, chords, slot, chordAnchors);
                                    setActiveChordIndex(idxs[0] ?? null);
                                  }}
                                  onDoubleClick={(e) => {
                                    if ((e.target as HTMLElement).closest("[data-cifra-chord-slot]")) return;
                                    setAddChordContext((prev) =>
                                      prev?.kind === "slot" && prev.slotId === slot.id ? null : prev,
                                    );
                                    setEditingId(slot.id);
                                  }}
                                  onKeyDown={(e) => {
                                    if (editingId === slot.id) return;
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setActiveSlotId(slot.id);
                                      const idxs = chordIndicesAttachedToSlot(slots, chords, slot, chordAnchors);
                                      setActiveChordIndex(idxs[0] ?? null);
                                    }
                                  }}
                                >
                                  <div className="flex min-h-[22px] w-full flex-1 flex-row flex-wrap content-end items-end justify-center gap-x-1.5 gap-y-0.5">
                                    {chordIdxs.length === 0 ? (
                                      <span
                                        className="pointer-events-none flex min-h-[18px] min-w-[1ch] select-none items-center justify-center font-mono text-[10px] text-cifra-muted/85"
                                        aria-hidden
                                      >
                                        ·
                                      </span>
                                    ) : (
                                      [...chordIdxs]
                                        .sort((a, b) => chords[a]!.start - chords[b]!.start)
                                        .map((ci) => {
                                          const chord = chords[ci]!;
                                          const label = chordDisplayLabel(chord);
                                          return (
                                            <span
                                              key={`${slot.id}-${ci}`}
                                              data-cifra-chord-slot
                                              data-chord-index={ci}
                                              draggable
                                              aria-label={`Acorde ${label}. Arraste para mover; clique na célula para editar no painel.`}
                                              title="Arraste para outra palavra ou zona instrumental"
                                              onDragStart={(e) => {
                                                e.stopPropagation();
                                                e.dataTransfer.setData(CHORD_DRAG_MIME, String(ci));
                                                e.dataTransfer.effectAllowed = "move";
                                                setDragChordIdx(ci);
                                              }}
                                              onDragEnd={() => {
                                                setDragChordIdx(null);
                                                setDropSlotId(null);
                                                setDropSectionKey(null);
                                              }}
                                              className={cn(
                                                "cursor-grab touch-none rounded-md px-1.5 py-0.5 text-center font-mono text-[12px] font-semibold text-cifra-teal transition-colors hover:bg-cifra-teal/12 active:cursor-grabbing",
                                                activeSlotId === slot.id &&
                                                  activeChordIndex === ci &&
                                                  "bg-cifra-teal/15 text-cifra-teal",
                                              )}
                                            >
                                              {label}
                                            </span>
                                          );
                                        })
                                    )}
                                  </div>
                                  {editingId === slot.id ? (
                                    <WordSlotInlineEditor
                                      key={slot.id}
                                      slot={slot}
                                      onApply={(text, start, end) => applyWordSlotEdit(slot.id, text, start, end)}
                                      onCancel={() => setEditingId(null)}
                                    />
                                  ) : (
                                    <span
                                      data-cifra-word
                                      className={cn(
                                        "pointer-events-none block w-full min-w-0 select-none px-1 py-0.5 text-center text-[14px] font-medium leading-tight tracking-tight text-cifra-text",
                                        activeSlotId === slot.id && "font-semibold text-cifra-teal",
                                      )}
                                    >
                                      {slot.text}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 border-t border-white/6 pt-3">
                      {newWordContext?.groupKey === group.key ? (
                        <AddWordForm
                          defaultStart={newWordContext.defaultStart}
                          defaultEnd={newWordContext.defaultEnd}
                          onApply={(text, s, e) => commitAddWord(newWordContext, text, s, e)}
                          onCancel={() => setNewWordContext(null)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAddChordContext(null);
                            const d = defaultTimesForNewWordInGroup(group);
                            setNewWordContext({
                              groupKey: group.key,
                              defaultStart: d.start,
                              defaultEnd: d.end,
                            });
                          }}
                          className="inline-flex items-center gap-2 font-mono text-[10px] font-normal text-cifra-teal hover:text-cifra-teal/90"
                        >
                          <Plus className="size-3 shrink-0" strokeWidth={2} aria-hidden />
                          Palavra no fim da linha
                        </button>
                      )}
                    </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
            )}
          </div>
        </section>
        </div>
        <CifraEditInspectorPanel
          activeSlot={activeSlot}
          activeChord={activeChord}
          activeChordIndex={activeChordIndex}
          onChordApply={handleChordApply}
          onChordRemove={handleInspectChordRemove}
          onChordEndChange={handleChordEndChange}
          onPickDictionaryChord={onPickDictionaryChord}
        />
      </div>
    );
  },
);

CifraTranscriptionEditor.displayName = "CifraTranscriptionEditor";
