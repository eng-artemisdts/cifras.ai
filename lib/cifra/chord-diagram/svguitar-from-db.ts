import { tokenize } from "@tonaljs/chord";
import type { ChordSettings } from "svguitar";
import {
  SVGuitarChord,
  OPEN,
  Orientation,
  ChordStyle,
  SILENT,
  type Chord,
} from "svguitar";
import { note } from "@tonaljs/pitch-note";

import guitarDb from "@/lib/cifra/data/guitar-chords.json";

type GuitarChordEntry = {
  key: string;
  suffix: string;
  positions: DbPosition[];
};

type DbPosition = {
  frets: number[];
  fingers: number[];
  baseFret: number;
  barres?: number[];
  capo?: boolean;
};

/** Raiz como chave do `guitar-chords.json` (Csharp / Fsharp, não C#). */
const CHROMA_TO_DB_ROOT: Record<number, keyof typeof guitarDb.chords> = {
  0: "C",
  1: "Csharp",
  2: "D",
  3: "Eb",
  4: "E",
  5: "F",
  6: "Fsharp",
  7: "G",
  8: "Ab",
  9: "A",
  10: "Bb",
  11: "B",
};

const SUFFIX_NORMALIZE: Record<string, string> = {
  "": "major",
  m: "minor",
};

/** Cores alinhadas a `app/globals.css` (--cifra-*). */
export function cifraSvguitarConfigure(baseFret: number): Partial<ChordSettings> {
  return {
    orientation: Orientation.vertical,
    style: ChordStyle.normal,
    strings: 6,
    frets: 4,
    position: baseFret,
    tuning: ["E", "A", "D", "G", "B", "E"],
    showFretMarkers: false,
    fixedDiagramPosition: true,
    fingerSize: 0.58,
    fingerColor: "#0fd2c1",
    fingerTextColor: "#080810",
    fingerStrokeColor: "#0fd2c1",
    fingerStrokeWidth: 0,
    fingerTextSize: 15,
    barreChordStrokeColor: "#0fd2c1",
    barreChordStrokeWidth: 0,
    stringColor: "rgba(237, 237, 246, 0.58)",
    fretColor: "rgba(237, 237, 246, 0.4)",
    fretLabelColor: "rgba(245, 245, 252, 0.92)",
    tuningsColor: "rgba(200, 200, 220, 0.95)",
    titleColor: "#e8e8f0",
    titleFontSize: 26,
    titleBottomMargin: 6,
    strokeWidth: 1.35,
    nutWidth: 7,
    backgroundColor: "none",
    color: "#e8e8f0",
    fretSize: 1.35,
    sidePadding: 0.18,
    fretLabelFontSize: 26,
    tuningsFontSize: 18,
    emptyStringIndicatorSize: 0.52,
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    watermark: "",
  };
}

function normalizeSuffix(typeToken: string): string {
  const s = typeToken.trim();
  if (SUFFIX_NORMALIZE[s] !== undefined) return SUFFIX_NORMALIZE[s]!;
  return s;
}

function pickPosition(positions: DbPosition[]): DbPosition | null {
  if (!positions?.length) return null;
  const ranked = [...positions].sort((a, b) => scorePosition(a) - scorePosition(b));
  return ranked[0] ?? null;
}

function scorePosition(p: DbPosition): number {
  const muted = p.frets.filter((f) => f < 0).length;
  const capoPenalty = p.capo ? 40 : 0;
  const bf = Number.isFinite(p.baseFret) ? p.baseFret : 1;
  const pressed = p.frets.filter((f) => f > 0);
  const height = pressed.length ? Math.max(...pressed) : 0;
  return bf * 3 + height * 0.15 + muted * 2 + capoPenalty;
}

function dbPositionToSvgChord(pos: DbPosition): Chord {
  const fingers: Chord["fingers"] = [];
  const frets = pos.frets;
  const fing = pos.fingers ?? [];

  for (let idx = 0; idx < 6; idx++) {
    const svgStringNum = 6 - idx;
    const fr = frets[idx];
    const fn = fing[idx] ?? 0;

    if (fr < 0 || fr === -1) {
      fingers.push([svgStringNum, SILENT]);
      continue;
    }
    if (fr === 0) {
      fingers.push([svgStringNum, OPEN]);
      continue;
    }
    const label = fn > 0 ? String(fn) : undefined;
    if (label) fingers.push([svgStringNum, fr, label]);
    else fingers.push([svgStringNum, fr]);
  }

  return {
    fingers,
    barres: [],
    position: pos.baseFret > 0 ? pos.baseFret : 1,
  };
}

export type ResolvedSvguitarChord = {
  chordData: Chord;
  configure: Partial<ChordSettings>;
  /** Rótulo ao lado do diagrama (sem título duplicado dentro do SVG). */
  displayLabel: string;
};

/** Resolve rótulo de acorde (ex.: Am7, G/B → G) para geometria svguitar + tema. */
export function resolveChordDiagram(labelRaw: string): ResolvedSvguitarChord | null {
  const label = labelRaw.trim();
  if (!label || label === "—" || label === "-" || /^n\.?c\.?$/i.test(label)) return null;

  const [tonic, typeTok] = tokenize(label);
  if (!tonic || typeof tonic !== "string") return null;

  const suffix = normalizeSuffix(typeof typeTok === "string" ? typeTok : "");
  if (!guitarDb.suffixes.includes(suffix)) return null;

  const n = note(tonic);
  if (n.empty || typeof n.chroma !== "number") return null;

  const rootKey = CHROMA_TO_DB_ROOT[n.chroma];
  if (!rootKey) return null;

  const list = guitarDb.chords[rootKey] as unknown as GuitarChordEntry[] | undefined;
  if (!Array.isArray(list)) return null;

  const entry = list.find((c) => c.suffix === suffix);
  if (!entry?.positions?.length) return null;

  const picked = pickPosition(entry.positions);
  if (!picked) return null;

  const displayLabel = label.replace(/\s+/g, " ");
  const chordData = dbPositionToSvgChord(picked);

  const configure = cifraSvguitarConfigure(picked.baseFret > 0 ? picked.baseFret : 1);

  return { chordData, configure, displayLabel };
}

/** Desenha no elemento host (client-only). Devolve dims para opcionalmente ajustar layout. */
export function drawChordIntoElement(el: HTMLElement, resolved: ResolvedSvguitarChord): {
  width: number;
  height: number;
} {
  const chart = new SVGuitarChord(el);
  chart.clear?.();
  const out = chart.configure(resolved.configure).chord(resolved.chordData).draw();
  return out;
}

export function clearChordElement(el: HTMLElement) {
  try {
    const chart = new SVGuitarChord(el);
    chart.clear();
  } catch {
    el.innerHTML = "";
  }
}
