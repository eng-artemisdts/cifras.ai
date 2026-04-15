"use client";

import { Eye, GripVertical, Plus } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useMemo, useState, forwardRef } from "react";

import { CifraChordEditPopover } from "@/components/cifra/cifra-chord-edit-popover";
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
  chordIndicesAttachedToSlot,
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

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function initialSectionsState(raw: MusicAiSection[] | undefined | null): MusicAiSection[] {
  const filtered = (raw ?? []).filter(
    (sec) => Number.isFinite(sec.start) && Number.isFinite(sec.end) && sec.end > sec.start,
  );
  return mergeConsecutiveDuplicateSectionLabels(sortSections(filtered));
}

function SectionTimeInputs({
  start,
  end,
  onCommit,
}: {
  start: number;
  end: number;
  onCommit: (start: number, end: number) => void;
}) {
  const [sStr, setSStr] = useState(() => String(Number(start.toFixed(3))));
  const [eStr, setEStr] = useState(() => String(Number(end.toFixed(3))));

  useEffect(() => {
    setSStr(String(Number(start.toFixed(3))));
    setEStr(String(Number(end.toFixed(3))));
  }, [start, end]);

  const commit = () => {
    const s = parseFloat(sStr.replace(",", "."));
    const e = parseFloat(eStr.replace(",", "."));
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return;
    onCommit(s, e);
  };

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 font-mono text-[9px] text-cifra-muted">
      <span className="shrink-0">Início (s)</span>
      <input
        value={sStr}
        onChange={(ev) => setSStr(ev.target.value)}
        onBlur={commit}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
        }}
        inputMode="decimal"
        className="w-14 shrink-0 rounded border border-cifra-border bg-[#0c0c16] px-1 py-0.5 text-[10px] text-cifra-text outline-none focus:border-cifra-teal/40"
        aria-label="Início da secção em segundos"
      />
      <span className="shrink-0">Fim (s)</span>
      <input
        value={eStr}
        onChange={(ev) => setEStr(ev.target.value)}
        onBlur={commit}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
        }}
        inputMode="decimal"
        className="w-14 shrink-0 rounded border border-cifra-border bg-[#0c0c16] px-1 py-0.5 text-[10px] text-cifra-text outline-none focus:border-cifra-teal/40"
        aria-label="Fim da secção em segundos"
      />
      <span className="ml-1 shrink-0 tabular-nums text-cifra-muted/90">
        {formatSectionTime(start)} — {formatSectionTime(end)}
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
};

type AddChordContext =
  | { kind: "slot"; slotId: string; defaultStart: number; defaultEnd: number }
  | { kind: "range"; sectionKey: string; defaultStart: number; defaultEnd: number };

/**
 * Edição de letra (duplo clique), acordes (popover) e arrasto entre palavras/secções;
 * tempos de secção editáveis quando `sections` existem no payload.
 */
export const CifraTranscriptionEditor = forwardRef<CifraTranscriptionEditorHandle, CifraTranscriptionEditorProps>(
  function CifraTranscriptionEditor({ initial, className, onRequestPreview }, ref) {
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

    const handleChordApply = useCallback((index: number, next: MusicAiChordEvent) => {
      setChords((prev) => prev.map((c, i) => (i === index ? next : c)));
    }, []);

    const handleChordRemove = useCallback((index: number) => {
      setChords((prev) => prev.filter((_, i) => i !== index));
    }, []);

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
      setChords((prev) => [...prev, createChordEvent(symbol, start, end)]);
      setAddChordContext(null);
    }, []);

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

    const applyWordSlotEdit = useCallback(
      (slotId: string, text: string, start: number, end: number) => {
        const slotBefore = slots.find((s) => s.id === slotId);
        if (!slotBefore) {
          setEditingId(null);
          return;
        }
        const chordIdxs = chordIndicesAttachedToSlot(slots, chords, slotBefore);
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
      [slots, chords],
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

    return (
      <div className={cn("flex flex-col gap-6", className)}>
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
          <p className="text-[11px] leading-snug text-cifra-muted">
            Duplo clique numa palavra para editar texto e tempos. Use «+ Palavra» ou «Nova secção» para acrescentar
            conteúdo. Em cada palavra (ou na zona instrumental), use «+ Acorde» para inserir um acorde novo; depois pode
            afinar no popover. Clique no símbolo do acorde para editar. Ao arrastar um acorde para uma palavra, o início
            passa para o início dessa palavra automaticamente. Arraste o grip do acorde ou da palavra para alinhar ao
            tempo de outra célula. Em intros ou instrumentais sem palavras, pode largar um acorde existente na área
            tracejada ou adicionar um novo com «+ Acorde». Com secções definidas, ajuste início/fim (s) no cabeçalho de
            cada bloco.
          </p>
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
            </div>

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
              return (
                <div key={group.key}>
                  <div className="mb-2.5 flex flex-wrap items-center gap-2 gap-y-2">
                    <GripVertical className="size-4 shrink-0 text-[#7a7a98]" strokeWidth={1.5} aria-hidden />
                    <div className="rounded-lg border border-[#F0B42955] px-2.5 py-1.5">
                      <p className="font-mono text-[10px] font-normal uppercase tracking-[1.1px] text-cifra-gold">
                        {group.title}
                      </p>
                    </div>
                    {sec && group.sectionIdx !== undefined ? (
                      <div className="ml-auto w-full min-w-0 sm:max-w-[min(100%,22rem)]">
                        <SectionTimeInputs
                          start={sec.start}
                          end={sec.end}
                          onCommit={(s, e) => patchSectionTimes(group.sectionIdx!, s, e)}
                        />
                      </div>
                    ) : (
                      <p className="ml-auto font-mono text-[9px] text-cifra-muted">
                        {formatSectionTime(group.start)} — {formatSectionTime(group.end)}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-cifra-border bg-cifra-surface px-3.5 py-3 md:px-4">
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
                        <p className="max-w-sm text-[10px] leading-snug text-cifra-muted/75">
                          Arraste o grip do acorde para aqui: o início alinha ao início desta secção (
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
                      <div className="flex flex-wrap items-end gap-x-1.5 gap-y-2">
                        {group.slots.map((slot) => {
                          const chordIdxs = chordIndicesAttachedToSlot(slots, chords, slot);
                          return (
                            <div
                              key={slot.id}
                              className={cn(
                                "flex min-w-10 flex-col items-center gap-1 rounded-md px-0.5 pb-0.5 transition-colors",
                                editingId === slot.id ? "max-w-56" : "max-w-40",
                                dragActive && "bg-cifra-teal/6 ring-1 ring-dashed ring-cifra-teal/25",
                                dropSlotId === slot.id && "bg-cifra-teal/14 ring-2 ring-cifra-teal/40",
                              )}
                              onDragOver={onDragOverWord}
                              onDragEnter={(e) => {
                                if (!isChordDrag(e) && !isWordDrag(e)) return;
                                setDropSlotId(slot.id);
                              }}
                              onDragLeave={() => {
                                setDropSlotId((prev) => (prev === slot.id ? null : prev));
                              }}
                              onDrop={(e) => onDropWord(slot, e)}
                            >
                              <div className="flex min-h-[28px] w-full flex-wrap content-end items-end justify-center gap-0.5">
                                {chordIdxs.length === 0 ? (
                                  <span
                                    className="pointer-events-none inline-block min-h-[26px] min-w-9 select-none"
                                    aria-hidden
                                  />
                                ) : (
                                  chordIdxs.map((ci) => (
                                    (() => {
                                      const chord = chords[ci]!;
                                      const chordDur = Math.max(0.05, chord.end - chord.start);
                                      const slotSpan = Math.max(0.05, slot.end - slot.start);
                                      const rel = clamp01(chordDur / slotSpan);
                                      const chipWidth = `${Math.round(58 + rel * 54)}px`;
                                      return (
                                        <div
                                          key={`${slot.id}-${ci}`}
                                          className="group flex flex-col items-center gap-0.5 rounded-md px-0.5 py-0.5"
                                          style={{ width: chipWidth }}
                                          title={`Início ${chord.start.toFixed(2)}s · fim ${chord.end.toFixed(2)}s · duração ${chordDur.toFixed(2)}s`}
                                        >
                                          <CifraChordEditPopover
                                            chord={chord}
                                            chordIndex={ci}
                                            triggerClassName="w-full justify-center"
                                            onApply={handleChordApply}
                                            onRemove={handleChordRemove}
                                            onChordDragStart={setDragChordIdx}
                                            onChordDragEnd={() => {
                                              setDragChordIdx(null);
                                              setDropSlotId(null);
                                              setDropSectionKey(null);
                                            }}
                                          />
                                          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                                            <div
                                              className="h-full rounded-full bg-linear-to-r from-cifra-teal/85 to-cifra-gold/75 transition-all"
                                              style={{ width: `${Math.max(12, Math.round(rel * 100))}%` }}
                                            />
                                          </div>
                                          <span className="font-mono text-[9px] text-cifra-muted/80 group-hover:text-cifra-text">
                                            {chordDur.toFixed(2)}s
                                          </span>
                                        </div>
                                      );
                                    })()
                                  ))
                                )}
                              </div>
                              {addChordContext?.kind === "slot" && addChordContext.slotId === slot.id ? (
                                <AddChordForm
                                  defaultStart={addChordContext.defaultStart}
                                  defaultEnd={addChordContext.defaultEnd}
                                  onApply={(sym, s, e) => commitAddChord(sym, s, e)}
                                  onCancel={() => setAddChordContext(null)}
                                />
                              ) : editingId !== slot.id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewWordContext(null);
                                    const dt = defaultChordTimesOnWordSlot(slots, chords, slot);
                                    setAddChordContext({
                                      kind: "slot",
                                      slotId: slot.id,
                                      defaultStart: dt.start,
                                      defaultEnd: dt.end,
                                    });
                                  }}
                                  className="mb-0.5 inline-flex items-center gap-0.5 rounded border border-dashed border-cifra-teal/25 px-1 py-0.5 text-[9px] font-semibold text-cifra-teal/95 hover:border-cifra-teal/40 hover:bg-cifra-teal/8"
                                >
                                  <Plus className="size-2.5 shrink-0" strokeWidth={2.5} aria-hidden />
                                  Acorde
                                </button>
                              ) : null}
                              {editingId === slot.id ? (
                                <WordSlotInlineEditor
                                  key={slot.id}
                                  slot={slot}
                                  onApply={(text, start, end) => applyWordSlotEdit(slot.id, text, start, end)}
                                  onCancel={() => setEditingId(null)}
                                />
                              ) : (
                                <div className="flex w-full items-center justify-center gap-0.5">
                                  <span
                                    draggable
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Arrastar palavra para outra célula — move o tempo e os acordes dessa palavra"
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData(WORD_DRAG_MIME, slot.id);
                                      e.dataTransfer.effectAllowed = "move";
                                      setDragWordSlotId(slot.id);
                                    }}
                                    onDragEnd={() => setDragWordSlotId(null)}
                                    className="flex shrink-0 cursor-grab touch-none select-none items-center rounded border border-transparent px-0.5 text-[#7a7a98] hover:border-white/15 hover:bg-white/[0.04] active:cursor-grabbing"
                                  >
                                    <GripVertical className="size-3" strokeWidth={1.75} aria-hidden />
                                  </span>
                                  <button
                                    type="button"
                                    onDoubleClick={() => {
                                      setAddChordContext((prev) =>
                                        prev?.kind === "slot" && prev.slotId === slot.id ? null : prev,
                                      );
                                      setEditingId(slot.id);
                                    }}
                                    className="min-w-0 flex-1 rounded-md border border-transparent px-1.5 py-1 text-center text-[12px] text-cifra-text transition-colors hover:border-cifra-teal/25 hover:bg-white/4"
                                  >
                                    {slot.text}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-2 border-t border-white/[0.06] pt-2">
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
                          className="inline-flex items-center gap-1 rounded-md border border-dashed border-cifra-teal/30 px-2 py-1 text-[10px] font-semibold text-cifra-teal hover:bg-cifra-teal/10"
                        >
                          <Plus className="size-3 shrink-0" strokeWidth={2} aria-hidden />
                          Palavra
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
            )}
          </div>
        </section>
      </div>
    );
  },
);

CifraTranscriptionEditor.displayName = "CifraTranscriptionEditor";
