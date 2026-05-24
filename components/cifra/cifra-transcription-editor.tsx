"use client";

import { ChevronDown, Eye, Plus } from "lucide-react";
import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { ChordDiagramTooltip } from "@/components/cifra/chord-diagram-tooltip";
import { CifraChordInspectorDialog } from "@/components/cifra/cifra-chord-inspector-dialog";
import { CifraEditMetaSidebar } from "@/components/cifra/cifra-edit-meta-sidebar";
import { CifraWordSlotInlineEditor } from "@/components/cifra/cifra-word-slot-inline-editor";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Slider } from "@/components/ui/slider";
import type {
  MusicAiChordEvent,
  MusicAiDemoPayload,
  MusicAiLyricSegment,
  MusicAiSection,
  TimedWord,
} from "@/lib/cifra/musicai-types";
import { mergeConsecutiveDuplicateSectionLabels, sortSections } from "@/lib/cifra/lyric-expand-clamp";
import { formatChordLabel } from "@/lib/cifra/chord-timeline";
import { buildLyricModel } from "@/lib/engine/lyric-timeline";
import {
  buildCifraRenderPlan,
  computeChordOnlyInstrumentalBlocks,
  instrumentalChordStripCellsForZone,
  renumberGlobalWordIndices,
} from "@/lib/engine/section-layout";
import {
  addWordSlot,
  applyWordSlotMoveToTarget,
  buildWordSlots,
  chordDisplayLabel,
  chordAnchorSlotIds,
  chordIndicesAttachedToSlot,
  clusterSlotsByLyricSegment,
  createChordEvent,
  defaultChordTimesOnTimeRange,
  defaultChordTimesOnWordSlot,
  defaultTimesForNewWordInGroup,
  ensureLyricsSegmentCount,
  groupSlotsForEditorDisplay,
  maxTimelineEndSec,
  moveChordToSlot,
  moveChordToTime,
  moveChordToTimeRange,
  pickSegmentIndexForEditorGroup,
  rebuildLyricsFromSlots,
  sortedChordIndices,
  type LyricWordSlot,
} from "@/lib/cifra/transcription-editor-model";
import { cn } from "@/lib/utils";

const CHORD_DRAG_MIME = "application/x-cifra-chord-index";
const WORD_DRAG_MIME = "application/x-cifra-word-slot-id";
const CHORD_DRAG_PLAIN_PREFIX = "cifra-ci:";
const WORD_DRAG_PLAIN_PREFIX = "cifra-ws:";

function setChordDragTransfer(dt: DataTransfer, chordIdx: number) {
  dt.setData(CHORD_DRAG_MIME, String(chordIdx));
  dt.setData("text/plain", `${CHORD_DRAG_PLAIN_PREFIX}${chordIdx}`);
}

function readChordDragIndexRaw(dt: DataTransfer): string {
  const custom = dt.getData(CHORD_DRAG_MIME);
  if (custom) return custom;
  const plain = dt.getData("text/plain");
  if (plain.startsWith(CHORD_DRAG_PLAIN_PREFIX)) return plain.slice(CHORD_DRAG_PLAIN_PREFIX.length);
  return "";
}

function setWordDragTransfer(dt: DataTransfer, slotId: string) {
  dt.setData(WORD_DRAG_MIME, slotId);
  dt.setData("text/plain", `${WORD_DRAG_PLAIN_PREFIX}${slotId}`);
}

function readWordDragIdRaw(dt: DataTransfer): string {
  const custom = dt.getData(WORD_DRAG_MIME);
  if (custom) return custom;
  const plain = dt.getData("text/plain");
  if (plain.startsWith(WORD_DRAG_PLAIN_PREFIX)) return plain.slice(WORD_DRAG_PLAIN_PREFIX.length);
  return "";
}

/** Eventos do mesmo plano que o preview (#cifra), limitados ao envelope da secção na edição. */
function planEventsOverlappingSection(
  plan: ReturnType<typeof buildCifraRenderPlan>,
  secStart: number,
  secEnd: number,
) {
  const eps = 1e-3;
  const a = Math.min(secStart, secEnd);
  const b = Math.max(secStart, secEnd);
  const filtered = plan.filter((ev) => {
    if (ev.kind === "instrumental") {
      const iv = ev.iv;
      return iv.end > a - eps && iv.start < b + eps;
    }
    const line = ev.line;
    if (!line.length) return false;
    const lo = line[0]?.start ?? ev.sortT ?? 0;
    const hi = line[line.length - 1]?.end ?? lo;
    const t0 = typeof lo === "number" && Number.isFinite(lo) ? lo : 0;
    const t1 = typeof hi === "number" && Number.isFinite(hi) ? hi : t0;
    return t1 > a - eps && t0 < b + eps;
  });
  filtered.sort((x, y) => {
    const tx =
      x.kind === "instrumental" ? x.iv.start : (x.line[0]?.start ?? x.sortT ?? 0);
    const ty =
      y.kind === "instrumental" ? y.iv.start : (y.line[0]?.start ?? y.sortT ?? 0);
    return (tx as number) - (ty as number);
  });
  return filtered;
}

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
  /** Durante o arrasto do slider: atualiza só o valor local; `sections` só em `onValueCommit` (sem saltar UI). */
  const [sliderDraft, setSliderDraft] = useState<number[] | null>(null);

  const min = 0;
  const max = Math.max(0.1, totalMax);
  const sliderStep = step ?? 0.05;
  const minDistance = Math.max(0.05, sliderStep);

  useEffect(() => {
    setSliderDraft(null);
  }, [sections]);

  const breakpoints = useMemo(() => {
    const out = new Set<number>();
    for (const sec of sections) {
      out.add(Math.max(min, Math.min(max, Number(sec.start))));
      out.add(Math.max(min, Math.min(max, Number(sec.end))));
    }
    return Array.from(out).sort((a, b) => a - b);
  }, [sections, min, max]);

  const sliderValue = sliderDraft ?? breakpoints;

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
    return sliderValue.map((bp, idx) => {
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
  }, [sliderValue, sections, min, max]);

  const active = sections[activeSectionIdx];
  const activeStart = active ? active.start : 0;
  const activeEnd = active ? active.end : 0;

  const ai = sections.length ? Math.min(Math.max(0, activeSectionIdx), sections.length - 1) : 0;
  const previewStartIdx = sections.length ? (startIdxBySection[ai] ?? 0) : 0;
  const previewEndIdx = sections.length ? (endIdxBySection[ai] ?? 0) : 0;
  const previewStart =
    sections.length && previewStartIdx < sliderValue.length
      ? sliderValue[previewStartIdx]!
      : activeStart;
  const previewEnd =
    sections.length && previewEndIdx < sliderValue.length ? sliderValue[previewEndIdx]! : activeEnd;

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

  const commitFromSlider = useCallback(
    (next: number[]) => {
      commitBreakpoints(next);
      setSliderDraft(null);
    },
    [commitBreakpoints],
  );

  const thumbHighlightActiveSection = useCallback(
    (thumbIndex: number) => {
      if (!sections.length) return false;
      const ai = Math.min(Math.max(0, activeSectionIdx), sections.length - 1);
      const sIdx = startIdxBySection[ai];
      const eIdx = endIdxBySection[ai];
      return thumbIndex === sIdx || thumbIndex === eIdx;
    },
    [sections.length, activeSectionIdx, startIdxBySection, endIdxBySection],
  );

  return (
    <div className="flex max-w-full flex-col gap-1.5 font-mono text-[9px] text-cifra-muted">
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0">Início/Fim (todas as secções)</span>
        <span className="shrink-0">Breakpoints globais</span>
      </div>
      <Slider
        value={sliderValue}
        min={min}
        max={max}
        step={sliderStep}
        thumbLabels={breakpointLabels}
        thumbHighlight={thumbHighlightActiveSection}
        minStepsBetweenThumbs={Math.max(1, Math.round(minDistance / Math.max(0.001, step ?? 0.05)))}
        onValueChange={(next) => setSliderDraft(next)}
        onValueCommit={commitFromSlider}
      />
      <span
        className={cn(
          "shrink-0 text-right tabular-nums transition-colors",
          sliderDraft !== null ? "text-cifra-teal" : "text-cifra-muted/90",
        )}
      >
        Secção atual: {formatSectionTime(previewStart)} — {formatSectionTime(previewEnd)}
        {sliderDraft !== null ? (
          <span className="ml-1 font-normal text-cifra-muted">· a arrastar</span>
        ) : null}
      </span>
    </div>
  );
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

function clampFloatingChordFormPosition(left: number, top: number) {
  if (typeof window === "undefined") return { left, top };
  const pad = 8;
  const estW = 200;
  const estH = 240;
  const maxLeft = Math.max(pad, window.innerWidth - estW - pad);
  const maxTop = Math.max(pad, window.innerHeight - estH - pad);
  return {
    left: Math.min(Math.max(pad, left), maxLeft),
    top: Math.min(Math.max(pad, top), maxTop),
  };
}

/** Retângulo do popup do menu contextual (para posicionar o formulário de acorde). */
type MenuAnchorRect = Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">;

type AddChordContext =
  | {
    kind: "slot";
    slotId: string;
    defaultStart: number;
    defaultEnd: number;
    menuAnchor?: MenuAnchorRect;
  }
  | { kind: "range"; sectionKey: string; defaultStart: number; defaultEnd: number };

/**
 * Duplo clique na palavra edita letra/tempos na própria célula; duplo clique no símbolo do acorde abre o diálogo de acorde.
 * Arrasto entre palavras/secções; tempos de secção editáveis quando `sections` existem no payload.
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
    const [chordInspectorOpen, setChordInspectorOpen] = useState(false);
    const chordInspectorAnchorRef = useRef<HTMLElement | null>(null);
    /** Reflete arrasto iniciado aqui (alguns browsers não expõem MIME custom em dragOver). */
    const internalDnDRef = useRef<"chord" | "word" | null>(null);
    const [dragChordIdx, setDragChordIdx] = useState<number | null>(null);
    const [dragWordSlotId, setDragWordSlotId] = useState<string | null>(null);
    const [dropSlotId, setDropSlotId] = useState<string | null>(null);
    const [dropSectionKey, setDropSectionKey] = useState<string | null>(null);
    const [dropInstrumentalCellKey, setDropInstrumentalCellKey] = useState<string | null>(null);
    const [newWordContext, setNewWordContext] = useState<{
      groupKey: string;
      defaultStart: number;
      defaultEnd: number;
    } | null>(null);
    const [addChordContext, setAddChordContext] = useState<AddChordContext | null>(null);
    const floatingAddChordFormRef = useRef<HTMLDivElement | null>(null);
    const [addSectionOpen, setAddSectionOpen] = useState(false);
    const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
    const [activeChordIndex, setActiveChordIndex] = useState<number | null>(null);
    const [guideOpen, setGuideOpen] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    const toggleSectionCollapsed = useCallback((key: string) => {
      setCollapsedSections((prev) => ({
        ...prev,
        [key]: prev[key] === false ? true : false,
      }));
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

    const chordTimeOffsetSec = Number.isFinite(initial.chordTimeOffsetSec)
      ? Number(initial.chordTimeOffsetSec)
      : 0;

    const cifraLayout = useMemo(() => {
      const lyricsPayload = rebuildLyricsFromSlots(lyricsSegments, slots);
      const { timedLines } = buildLyricModel(lyricsPayload);
      const vocalTimedLines = renumberGlobalWordIndices(timedLines);
      const sectionsSorted = finalizeSections(sections);
      const durationHintSec = Math.max(
        maxTimelineEndSec(slots, chords, sections),
        typeof initial.meta?.duration_seconds === "number" ? initial.meta.duration_seconds : 0,
      );
      const chordOnlyInstrumentalBlocks = computeChordOnlyInstrumentalBlocks({
        timedLines,
        chords,
        sectionsSorted,
        chordTimeOffsetSec,
        durationHintSec,
        formatChord: formatChordLabel,
      });
      const cifraRenderPlan = buildCifraRenderPlan(chordOnlyInstrumentalBlocks, vocalTimedLines);
      return { chordOnlyInstrumentalBlocks, vocalTimedLines, cifraRenderPlan };
    }, [
      lyricsSegments,
      slots,
      chords,
      sections,
      finalizeSections,
      chordTimeOffsetSec,
      initial.meta?.duration_seconds,
    ]);

    const { chordOnlyInstrumentalBlocks, vocalTimedLines, cifraRenderPlan } = cifraLayout;

    const chordAnchors = useMemo(() => chordAnchorSlotIds(slots, chords), [slots, chords]);

    const referenceDurationSec = initial.meta?.duration_seconds;
    const contentTimelineEnd = useMemo(
      () => maxTimelineEndSec(slots, chords, sections),
      [slots, chords, sections],
    );

    const defaultNewSectionRange = useMemo(() => {
      const ref = referenceDurationSec;
      const tail = sections.length ? Math.max(...sections.map((s) => s.end)) : 0;
      const hasRef = ref != null && Number.isFinite(ref) && ref > tail + 0.5;
      const endGuess = hasRef
        ? ref
        : tail + Math.max(8, Math.min(45, contentTimelineEnd - tail + 5));
      return { start: tail, end: Math.max(tail + 0.5, endGuess) };
    }, [sections, referenceDurationSec, contentTimelineEnd]);

    useEffect(() => {
      const ctx = addChordContext;
      if (ctx?.kind !== "slot" || !ctx.menuAnchor) return;
      const onPointerDown = (ev: PointerEvent) => {
        const formEl = floatingAddChordFormRef.current;
        const t = ev.target;
        if (formEl && t instanceof Node && formEl.contains(t)) return;
        setAddChordContext(null);
      };
      document.addEventListener("pointerdown", onPointerDown, true);
      return () => document.removeEventListener("pointerdown", onPointerDown, true);
    }, [addChordContext]);

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
      if (!chordInspectorOpen || activeChordIndex == null) return;
      if (!chords[activeChordIndex]) {
        setChordInspectorOpen(false);
        chordInspectorAnchorRef.current = null;
      }
    }, [chordInspectorOpen, activeChordIndex, chords]);

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
          setChordInspectorOpen(false);
          chordInspectorAnchorRef.current = null;
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
          nextChords = moveChordToSlot(
            nextChords,
            ci,
            updatedSlot,
            sortedChordIndices(nextChords),
            sections,
          );
        }
        setSlots(nextSlots);
        setChords(nextChords);
        setEditingId(null);
      },
      [slots, chords, chordAnchors, sections],
    );

    const isChordDrag = useCallback((e: React.DragEvent) => {
      return Array.from(e.dataTransfer.types).includes(CHORD_DRAG_MIME);
    }, []);

    const isWordDrag = useCallback((e: React.DragEvent) => {
      return Array.from(e.dataTransfer.types).includes(WORD_DRAG_MIME);
    }, []);

    const finishChordDnD = useCallback(() => {
      internalDnDRef.current = null;
      setDragChordIdx(null);
      setDropSlotId(null);
      setDropSectionKey(null);
      setDropInstrumentalCellKey(null);
    }, []);

    const finishWordDnD = useCallback(() => {
      internalDnDRef.current = null;
      setDragWordSlotId(null);
      setDropSlotId(null);
      setDropSectionKey(null);
      setDropInstrumentalCellKey(null);
    }, []);

    const onDragOverWord = useCallback(
      (e: React.DragEvent) => {
        const internal = internalDnDRef.current === "chord" || internalDnDRef.current === "word";
        if (!internal && !isChordDrag(e) && !isWordDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      },
      [isChordDrag, isWordDrag],
    );

    const onDropWord = useCallback(
      (slot: LyricWordSlot, e: React.DragEvent) => {
        e.preventDefault();
        const chordRaw = readChordDragIndexRaw(e.dataTransfer);
        if (chordRaw) {
          const idx = parseInt(chordRaw, 10);
          if (!Number.isFinite(idx) || idx < 0 || idx >= chords.length) {
            finishChordDnD();
            return;
          }
          const order = sortedChordIndices(chords);
          setChords(moveChordToSlot(chords, idx, slot, order, sections));
          finishChordDnD();
          return;
        }
        const wordRaw = readWordDragIdRaw(e.dataTransfer);
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
        finishWordDnD();
      },
      [chords, slots, sections, finishChordDnD, finishWordDnD],
    );

    /** Secção ou segmento sem palavras: largar acorde alinha ao intervalo temporal do bloco. */
    const onDropChordOnlyZone = useCallback(
      (rangeStart: number, rangeEnd: number, e: React.DragEvent) => {
        e.preventDefault();
        const chordRaw = readChordDragIndexRaw(e.dataTransfer);
        if (chordRaw) {
          const idx = parseInt(chordRaw, 10);
          if (!Number.isFinite(idx) || idx < 0 || idx >= chords.length) {
            finishChordDnD();
            return;
          }
          const order = sortedChordIndices(chords);
          setChords(moveChordToTimeRange(chords, idx, rangeStart, rangeEnd, order, sections));
          finishChordDnD();
          return;
        }
        if (readWordDragIdRaw(e.dataTransfer)) finishWordDnD();
      },
      [chords, sections, finishChordDnD, finishWordDnD],
    );

    /** Drop numa célula específica da faixa só-instrumento: alinha o `start` ao tempo da célula. */
    const onDropInstrumentalCell = useCallback(
      (targetStart: number, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const chordRaw = readChordDragIndexRaw(e.dataTransfer);
        if (!chordRaw) {
          if (readWordDragIdRaw(e.dataTransfer)) finishWordDnD();
          return;
        }
        const idx = parseInt(chordRaw, 10);
        if (!Number.isFinite(idx) || idx < 0 || idx >= chords.length) {
          finishChordDnD();
          return;
        }
        setChords(moveChordToTime(chords, idx, targetStart, sections));
        finishChordDnD();
      },
      [chords, sections, finishChordDnD, finishWordDnD],
    );

    const dragActive = dragChordIdx !== null || dragWordSlotId !== null;

    const metaPayload: MusicAiDemoPayload = {
      ...initial,
      lyrics: rebuildLyricsFromSlots(lyricsSegments, slots),
      chords,
      sections: finalizeSections(sections),
    };

    const onChordInspectorOpenChange = useCallback((open: boolean) => {
      setChordInspectorOpen(open);
      if (!open) chordInspectorAnchorRef.current = null;
    }, []);

    return (
      <>
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
                    Toque numa palavra para a selecionar. Duplo clique na palavra edita letra e tempos na célula. Duplo
                    clique no símbolo do acorde abre a edição completa do acorde numa janela. Botão direito na célula
                    abre um menu para adicionar, alterar ou remover acordes. «Acorde na palavra ativa» adiciona acorde à
                    palavra selecionada. Arraste o símbolo ou a célula para mover. Edição em massa à esquerda.
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] leading-snug text-cifra-muted">
                    Duplo clique na palavra para editar na grelha; duplo clique no acorde abre o diálogo de edição; botão
                    direito na palavra para o menu de acordes.
                  </p>
                )}
              </div>
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
                {addChordContext?.kind === "slot" && !addChordContext.menuAnchor ? (
                  <AddChordForm
                    defaultStart={addChordContext.defaultStart}
                    defaultEnd={addChordContext.defaultEnd}
                    onApply={(sym, s, e) => commitAddChord(sym, s, e)}
                    onCancel={() => setAddChordContext(null)}
                  />
                ) : null}
                {addChordContext?.kind === "slot" &&
                  addChordContext.menuAnchor &&
                  typeof document !== "undefined"
                  ? createPortal(
                    <div
                      ref={floatingAddChordFormRef}
                      className="pointer-events-auto fixed z-[240]"
                      style={clampFloatingChordFormPosition(
                        addChordContext.menuAnchor.left,
                        addChordContext.menuAnchor.top,
                      )}
                    >
                      <AddChordForm
                        defaultStart={addChordContext.defaultStart}
                        defaultEnd={addChordContext.defaultEnd}
                        onApply={(sym, s, e) => commitAddChord(sym, s, e)}
                        onCancel={() => setAddChordContext(null)}
                      />
                    </div>,
                    document.body,
                  )
                  : null}

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
                    const sectionCollapsed = collapsedSections[group.key] !== false;
                    /** Acordes que transpassam secções aparecem só na secção onde o `start` cai (a primeira). */
                    const chordStartsInSection = (ci: number): boolean => {
                      const c = chords[ci];
                      if (!c) return false;
                      const eps = 1e-3;
                      return c.start >= group.start - eps && c.start < group.end - eps;
                    };
                    return (
                      <div key={group.key} className="rounded-[14px] border border-cifra-border bg-cifra-surface p-[18px]">
                        <button
                          type="button"
                          onClick={() => toggleSectionCollapsed(group.key)}
                          className="flex w-full cursor-pointer items-center justify-between gap-x-3 gap-y-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-cifra-teal/35 focus-visible:ring-offset-2 focus-visible:ring-offset-cifra-surface"
                          aria-expanded={!sectionCollapsed}
                          aria-controls={`cifra-section-body-${group.key}`}
                          id={`cifra-section-head-${group.key}`}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <span
                              className={cn(
                                "-ml-0.5 inline-flex shrink-0 cursor-pointer rounded-md p-1 text-cifra-muted transition-colors",
                                "hover:bg-cifra-teal/15 hover:text-cifra-teal",
                              )}
                              aria-hidden
                            >
                              <ChevronDown
                                strokeWidth={2}
                                className={cn(
                                  "size-4 shrink-0 transition-transform duration-200",
                                  sectionCollapsed && "-rotate-90",
                                )}
                                aria-hidden
                              />
                            </span>
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
                              <div className="flex flex-col gap-3">
                                {(() => {
                                  let pendingInstrumentalToLyricCarryChordIdx: number | null = null;
                                  return planEventsOverlappingSection(cifraRenderPlan, group.start, group.end).map((ev, evIdx) => {
                                  if (ev.kind === "instrumental") {
                                    const gLo = Math.min(group.start, group.end);
                                    const gHi = Math.max(group.start, group.end);
                                    const zs = Math.max(gLo, ev.iv.start);
                                    const ze = Math.min(gHi, ev.iv.end);
                                    const stripCells = instrumentalChordStripCellsForZone(
                                      chordOnlyInstrumentalBlocks,
                                      chords,
                                      chordTimeOffsetSec,
                                      zs,
                                      ze,
                                      formatChordLabel,
                                    ).filter((cell) => chordStartsInSection(cell.chordIdx));
                                    pendingInstrumentalToLyricCarryChordIdx =
                                      stripCells.length > 0
                                        ? stripCells[stripCells.length - 1]?.chordIdx ?? null
                                        : null;
                                    if (!stripCells.length) return null;
                                    return (
                                      <div
                                        key={`${group.key}-plan-i-${ev.iv.start}-${evIdx}`}
                                        className="flex w-full flex-wrap items-end gap-x-3 gap-y-2 border-b border-white/6 pb-3 last:border-b-0"
                                      >
                                        {stripCells.map((cell, idx) => {
                                          const showLabel = idx === 0 || stripCells[idx - 1]!.label !== cell.label;
                                          const ci = cell.chordIdx;
                                          const cellKey = `${group.key}-inst-${ci}-${idx}`;
                                          return (
                                            <ChordDiagramTooltip key={`${group.key}-plan-inst-${ci}-${idx}`} label={cell.label}>
                                              <span
                                                data-cifra-chord-slot
                                                data-chord-index={ci}
                                                draggable
                                                aria-label={`Acorde ${cell.label} nesta zona só instrumento`}
                                                title="Arraste para mover; largue noutra célula para reposicionar"
                                                onDragStart={(e) => {
                                                  e.stopPropagation();
                                                  internalDnDRef.current = "chord";
                                                  setChordDragTransfer(e.dataTransfer, ci);
                                                  e.dataTransfer.effectAllowed = "move";
                                                  setDragChordIdx(ci);
                                                }}
                                                onDragEnd={() => finishChordDnD()}
                                                onDragOver={onDragOverWord}
                                                onDragEnter={(e) => {
                                                  if (
                                                    internalDnDRef.current !== "chord" &&
                                                    !isChordDrag(e)
                                                  ) {
                                                    return;
                                                  }
                                                  setDropInstrumentalCellKey(cellKey);
                                                }}
                                                onDragLeave={(e) => {
                                                  const rt = e.relatedTarget;
                                                  if (rt instanceof Node && e.currentTarget.contains(rt)) return;
                                                  setDropInstrumentalCellKey((prev) =>
                                                    prev === cellKey ? null : prev,
                                                  );
                                                }}
                                                onDrop={(e) => onDropInstrumentalCell(cell.a0, e)}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setActiveSlotId(null);
                                                  setActiveChordIndex(ci);
                                                }}
                                                onDoubleClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setActiveSlotId(null);
                                                  setActiveChordIndex(ci);
                                                  chordInspectorAnchorRef.current = e.currentTarget;
                                                  setChordInspectorOpen(true);
                                                }}
                                                className={cn(
                                                  "inline-flex cursor-grab touch-none flex-col items-start gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-cifra-teal/10 active:cursor-grabbing",
                                                  activeChordIndex === ci &&
                                                  activeSlotId === null &&
                                                  "bg-cifra-teal/15 text-cifra-teal",
                                                  dragActive && "ring-1 ring-dashed ring-cifra-teal/25",
                                                  dropInstrumentalCellKey === cellKey &&
                                                  "bg-cifra-teal/15 ring-2 ring-cifra-teal/40",
                                                )}
                                              >
                                                <span className="cifra-chord__symbol inline-flex min-h-[1.125rem] items-end font-mono text-xs font-semibold text-cifra-teal sm:text-sm">
                                                  {showLabel ? cell.label : "\u00A0"}
                                                </span>
                                                <span className="min-h-[1.25rem] text-cifra-text">{"\u00A0"}</span>
                                              </span>
                                            </ChordDiagramTooltip>
                                          );
                                        })}
                                      </div>
                                    );
                                  }
                                  const segIdx = vocalTimedLines.findIndex((ln: TimedWord[]) => ln === ev.line);
                                  if (segIdx < 0) return null;
                                  let phraseSlots = group.slots.filter((s) => s.segmentIndex === segIdx);
                                  if (!phraseSlots.length) {
                                    phraseSlots = slots.filter((s) => s.segmentIndex === segIdx);
                                  }
                                  if (!phraseSlots.length) return null;
                                  const carryChordIdxForLine = pendingInstrumentalToLyricCarryChordIdx;
                                  pendingInstrumentalToLyricCarryChordIdx = null;
                                  let carryConsumedInLine = false;
                                  return (
                                    <Fragment key={`${group.key}-plan-l-${segIdx}-${evIdx}`}>
                                      {clusterSlotsByLyricSegment(phraseSlots).map((phraseSlots, phraseIdx) => (
                                        <div
                                          key={`${group.key}-phrase-${phraseSlots[0]?.segmentIndex ?? phraseIdx}`}
                                          className="flex w-full flex-wrap items-end gap-x-2 gap-y-2 border-b border-white/6 pb-3 last:border-b-0 last:pb-0"
                                        >
                                          {phraseSlots.map((slot) => {
                                            const chordIdxs = chordIndicesAttachedToSlot(slots, chords, slot, chordAnchors)
                                              .filter(chordStartsInSection);
                                            const hasChord = chordIdxs.length > 0;
                                            const sortedChordIdxs = [...chordIdxs].sort(
                                              (a, b) => chords[a]!.start - chords[b]!.start,
                                            );
                                            const shouldHideCarryHere =
                                              !carryConsumedInLine &&
                                              carryChordIdxForLine != null &&
                                              sortedChordIdxs.includes(carryChordIdxForLine);
                                            const visibleChordIdxs = shouldHideCarryHere
                                              ? sortedChordIdxs.filter((ci) => ci !== carryChordIdxForLine)
                                              : sortedChordIdxs;
                                            if (shouldHideCarryHere) {
                                              carryConsumedInLine = true;
                                            }
                                            const sortedMenuChordIdxs = [...sortedChordIdxs];
                                            const primaryChordForMenu =
                                              sortedMenuChordIdxs.length === 0
                                                ? null
                                                : activeSlotId === slot.id &&
                                                  activeChordIndex != null &&
                                                  sortedMenuChordIdxs.includes(activeChordIndex)
                                                  ? activeChordIndex
                                                  : sortedMenuChordIdxs[0]!;
                                            return (
                                              <ContextMenu key={slot.id}>
                                                <ContextMenuTrigger
                                                  data-cifra-word-cell={slot.id}
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
                                                    internalDnDRef.current = "word";
                                                    setWordDragTransfer(e.dataTransfer, slot.id);
                                                    e.dataTransfer.effectAllowed = "move";
                                                    setDragWordSlotId(slot.id);
                                                  }}
                                                  onDragEnd={() => finishWordDnD()}
                                                  onDragOver={onDragOverWord}
                                                  onDragEnter={(e) => {
                                                    if (
                                                      internalDnDRef.current !== "chord" &&
                                                      internalDnDRef.current !== "word" &&
                                                      !isChordDrag(e) &&
                                                      !isWordDrag(e)
                                                    ) {
                                                      return;
                                                    }
                                                    setDropSlotId(slot.id);
                                                  }}
                                                  onDragLeave={(e) => {
                                                    const rt = e.relatedTarget;
                                                    if (rt instanceof Node && e.currentTarget.contains(rt)) return;
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
                                                    const idxs = chordIndicesAttachedToSlot(slots, chords, slot, chordAnchors)
                                                      .filter(chordStartsInSection);
                                                    setActiveChordIndex(idxs[0] ?? null);
                                                  }}
                                                  onDoubleClick={(e) => {
                                                    if ((e.target as HTMLElement).closest("[data-cifra-chord-slot]")) return;
                                                    e.preventDefault();
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
                                                      const idxs = chordIndicesAttachedToSlot(slots, chords, slot, chordAnchors)
                                                        .filter(chordStartsInSection);
                                                      setActiveChordIndex(idxs[0] ?? null);
                                                    }
                                                  }}
                                                >
                                                  <div className="flex min-h-[22px] w-full flex-1 flex-row flex-wrap content-end items-end justify-center gap-x-1.5 gap-y-0.5">
                                                    {visibleChordIdxs.length === 0 ? (
                                                      <span
                                                        className="pointer-events-none flex min-h-[18px] min-w-[1ch] shrink-0 select-none items-center justify-center"
                                                        aria-hidden
                                                      />
                                                    ) : (
                                                      [...visibleChordIdxs]
                                                        .map((ci) => {
                                                          const chord = chords[ci]!;
                                                          const label = chordDisplayLabel(chord);
                                                          return (
                                                            <ChordDiagramTooltip key={`${slot.id}-${ci}`} label={label}>
                                                              <span
                                                                data-cifra-chord-slot
                                                                data-chord-index={ci}
                                                                draggable
                                                                aria-label={`Acorde ${label}. Arraste para mover; clique na célula para editar no painel.`}
                                                                title="Arraste para outra palavra ou zona instrumental"
                                                                onDragStart={(e) => {
                                                                  e.stopPropagation();
                                                                  internalDnDRef.current = "chord";
                                                                  setChordDragTransfer(e.dataTransfer, ci);
                                                                  e.dataTransfer.effectAllowed = "move";
                                                                  setDragChordIdx(ci);
                                                                }}
                                                                onDragEnd={() => finishChordDnD()}
                                                                onDoubleClick={(e) => {
                                                                  e.preventDefault();
                                                                  e.stopPropagation();
                                                                  setActiveSlotId(slot.id);
                                                                  setActiveChordIndex(ci);
                                                                  chordInspectorAnchorRef.current = e.currentTarget;
                                                                  setChordInspectorOpen(true);
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
                                                            </ChordDiagramTooltip>
                                                          );
                                                        })
                                                    )}
                                                  </div>
                                                  {editingId === slot.id ? (
                                                    <CifraWordSlotInlineEditor
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
                                                </ContextMenuTrigger>
                                                <ContextMenuContent>
                                                  <ContextMenuItem
                                                    onClick={(e) => {
                                                      setNewWordContext(null);
                                                      setChordInspectorOpen(false);
                                                      chordInspectorAnchorRef.current = null;
                                                      const dt = defaultChordTimesOnWordSlot(slots, chords, slot);
                                                      const popup = (e.currentTarget as HTMLElement).closest(
                                                        "[data-slot=\"context-menu-content\"]",
                                                      );
                                                      const r = popup?.getBoundingClientRect();
                                                      const menuAnchor = r
                                                        ? {
                                                          left: r.left,
                                                          top: r.top,
                                                          width: r.width,
                                                          height: r.height,
                                                        }
                                                        : {
                                                          left: e.clientX,
                                                          top: e.clientY,
                                                          width: 0,
                                                          height: 0,
                                                        };
                                                      setAddChordContext({
                                                        kind: "slot",
                                                        slotId: slot.id,
                                                        defaultStart: dt.start,
                                                        defaultEnd: dt.end,
                                                        ...(menuAnchor ? { menuAnchor } : {}),
                                                      });
                                                      setActiveSlotId(slot.id);
                                                      setActiveChordIndex(sortedMenuChordIdxs[0] ?? null);
                                                    }}
                                                  >
                                                    Adicionar acorde…
                                                  </ContextMenuItem>
                                                  <ContextMenuSeparator />
                                                  <ContextMenuItem
                                                    disabled={!hasChord}
                                                    onClick={() => {
                                                      if (primaryChordForMenu == null) return;
                                                      setActiveSlotId(slot.id);
                                                      setActiveChordIndex(primaryChordForMenu);
                                                      queueMicrotask(() => {
                                                        const root = document.querySelector(
                                                          `[data-cifra-word-cell="${CSS.escape(slot.id)}"]`,
                                                        );
                                                        const sym = root?.querySelector(
                                                          `[data-chord-index="${primaryChordForMenu}"]`,
                                                        ) as HTMLElement | null;
                                                        chordInspectorAnchorRef.current =
                                                          sym ?? (root instanceof HTMLElement ? root : null);
                                                        setChordInspectorOpen(true);
                                                      });
                                                    }}
                                                  >
                                                    Alterar acorde…
                                                  </ContextMenuItem>
                                                  <ContextMenuItem
                                                    variant="destructive"
                                                    disabled={!hasChord}
                                                    onClick={() => {
                                                      if (primaryChordForMenu == null) return;
                                                      setActiveSlotId(slot.id);
                                                      handleInspectChordRemove(primaryChordForMenu);
                                                    }}
                                                  >
                                                    Remover acorde
                                                  </ContextMenuItem>
                                                </ContextMenuContent>
                                              </ContextMenu>
                                            );
                                          })}
                                        </div>
                                      ))}
                                    </Fragment>
                                  );
                                });
                                })()}
                              </div>

                              {group.slots.length === 0 ? (
                                <div
                                  role="region"
                                  aria-label="Zona para largar acordes nesta secção sem letra"
                                  className={cn(
                                    "mt-3 flex min-h-22 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
                                    dragActive && "border-cifra-teal/45 bg-cifra-teal/6 ring-1 ring-dashed ring-cifra-teal/25",
                                    dropSectionKey === group.key && "border-cifra-teal bg-cifra-teal/12 ring-2 ring-cifra-teal/40",
                                    !dragActive && "border-white/12",
                                  )}
                                  onDragOver={onDragOverWord}
                                  onDragEnter={(e) => {
                                    if (internalDnDRef.current !== "chord" && !isChordDrag(e)) return;
                                    setDropSectionKey(group.key);
                                  }}
                                  onDragLeave={(e) => {
                                    const rt = e.relatedTarget;
                                    if (rt instanceof Node && e.currentTarget.contains(rt)) return;
                                    setDropSectionKey((prev) => (prev === group.key ? null : prev));
                                  }}
                                  onDrop={(e) => onDropChordOnlyZone(group.start, group.end, e)}
                                >
                                  <p className="text-[11px] text-cifra-muted/90">
                                    Sem palavras (intro, instrumental…)
                                  </p>
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
                              ) : null}
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
        </div>

        {activeChord != null && activeChordIndex != null ? (
          <CifraChordInspectorDialog
            open={chordInspectorOpen}
            onOpenChange={onChordInspectorOpenChange}
            anchorRef={chordInspectorAnchorRef}
            activeSlot={activeSlot}
            activeChord={activeChord}
            activeChordIndex={activeChordIndex}
            onChordApply={handleChordApply}
            onChordRemove={handleInspectChordRemove}
            onChordEndChange={handleChordEndChange}
          />
        ) : null}
      </>
    );
  },
);

CifraTranscriptionEditor.displayName = "CifraTranscriptionEditor";
