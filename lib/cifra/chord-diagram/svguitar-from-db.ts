import { tokenize } from "@tonaljs/chord";
import type { ChordSettings } from "svguitar";
import {
  SVGuitarChord,
  OPEN,
  Orientation,
  ChordStyle,
  SILENT,
  type Barre,
  type Chord,
  BarreChordStyle,
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
  /** Trastes com pestana (formato @tombatossals/chords-db); pode ser um único número noutras exportações. */
  barres?: number[] | number;
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
    style: ChordStyle.handdrawn,
    strings: 6,
    frets: 5,
    position: baseFret,
    tuning: ["E", "A", "D", "G", "B", "E"],
    showFretMarkers: false,
    fixedDiagramPosition: true,
    /** Sem título no SVG — o rótulo fica no HTML (tooltip / diálogo), evita duplicar “desenho”. */
    title: "",
    fingerSize: 0.58,
    fingerColor: "#0fd2c1",
    fingerTextColor: "#080810",
    fingerStrokeColor: "#0fd2c1",
    fingerStrokeWidth: 1,
    fingerTextSize: 15,
    barreChordStrokeColor: "#0fd2c1",
    barreChordStrokeWidth: 3,
    barreChordStyle: BarreChordStyle.RECTANGLE,
    stringColor: "rgba(237, 237, 246, 0.58)",
    fretColor: "rgba(237, 237, 246, 0.4)",
    fretLabelColor: "rgba(245, 245, 252, 0.92)",
    tuningsColor: "rgba(200, 200, 220, 0.95)",
    titleColor: "#0000",
    titleFontSize: 26,
    titleBottomMargin: 6,
    strokeWidth: 1.35,
    nutWidth: 7,
    backgroundColor: "none",
    color: "#e8e8f0",
    fretSize: 1.35,
    sidePadding: 0.18,
    fretLabelFontSize: 26,
    tuningsFontSize: 20,
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

/** Ordenação por heurística: posições mais confortáveis / abertas primeiro. */
function rankedChordPositions(positions: DbPosition[]): DbPosition[] {
  if (!positions?.length) return [];
  return [...positions].sort((a, b) => scorePosition(a) - scorePosition(b));
}

type LookupChordResult = {
  entry: GuitarChordEntry;
  displayLabel: string;
};

/** Lookup na base chords-db (mesma lógica que `resolveChordDiagram`). */
function lookupGuitarChordEntry(labelRaw: string): LookupChordResult | null {
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

  const displayLabel = label.replace(/\s+/g, " ");
  return { entry, displayLabel };
}

function scorePosition(p: DbPosition): number {
  const muted = p.frets.filter((f) => f < 0).length;
  const capoPenalty = p.capo ? 40 : 0;
  const bf = Number.isFinite(p.baseFret) ? p.baseFret : 1;
  const pressed = p.frets.filter((f) => f > 0);
  const height = pressed.length ? Math.max(...pressed) : 0;
  return bf * 3 + height * 0.15 + muted * 2 + capoPenalty;
}

/** Normaliza `barres` da base (array ou número único). */
function normalizeChordDbBarres(barres: DbPosition["barres"]): number[] {
  if (barres == null) return [];
  const raw = typeof barres === "number" ? [barres] : barres;
  const uniq = [...new Set(raw.filter((b) => typeof b === "number" && Number.isFinite(b) && b > 0))];
  uniq.sort((a, b) => a - b);
  return uniq;
}

/**
 * Converte índice de corda na base (0 = Mi grave … 5 = Mi agudo) para numeração do svguitar (1 = agudo … 6 = grave).
 * @see https://omnibrain.github.io/svguitar/docs/ — `Barre.fromString` / `toString`
 */
function dbStringIndexToSvguitarString(dbIdx: number): number {
  return 6 - dbIdx;
}

/**
 * Strings svguitar (1–6) onde existe pestana neste traste.
 * 1.º passo: cordas com dedo 1 no traste da pestana (índice típico na chords-db).
 * 2.º passo: todas as cordas com esse traste (ex.: pestana dupla com dedos 4).
 */
function svguitarStringsAtBarreFret(pos: DbPosition, barreFret: number): number[] {
  const frets = pos.frets;
  const fingers = pos.fingers ?? [];

  const collect = (requireIndexFinger: boolean): number[] => {
    const out: number[] = [];
    for (let idx = 0; idx < 6; idx++) {
      const fr = frets[idx];
      const fn = fingers[idx] ?? 0;
      if (fr < 0 || fr !== barreFret) continue;
      if (requireIndexFinger && fn !== 1) continue;
      out.push(dbStringIndexToSvguitarString(idx));
    }
    return out;
  };

  const primary = collect(true);
  if (primary.length) return primary;
  return collect(false);
}

/** Número do dedo na pestana (primeira corda encontrada neste traste). */
function barreFingerLabel(pos: DbPosition, barreFret: number): string | undefined {
  const frets = pos.frets;
  const fingers = pos.fingers ?? [];
  for (let idx = 0; idx < 6; idx++) {
    if (frets[idx] !== barreFret || frets[idx] < 0) continue;
    const fn = fingers[idx];
    if (typeof fn === "number" && fn > 0) return String(fn);
  }
  return undefined;
}

/**
 * Pestanas no formato {@link Barre} do svguitar a partir de `positions.barres` da chords-db.
 * @see https://omnibrain.github.io/svguitar/docs/ — `chord.barres`
 */
function dbBarresToSvguitar(pos: DbPosition): Barre[] {
  const barreFrets = normalizeChordDbBarres(pos.barres);
  if (!barreFrets.length) return [];

  const out: Barre[] = [];

  for (const fret of barreFrets) {
    const strings = svguitarStringsAtBarreFret(pos, fret);
    if (!strings.length) continue;

    const fromString = Math.max(...strings);
    const toString = Math.min(...strings);

    const text = barreFingerLabel(pos, fret);
    out.push({
      fromString,
      toString,
      fret,
      ...(text !== undefined ? { text } : {}),
      style: BarreChordStyle.RECTANGLE,
    });
  }

  return out;
}

/** Corda coberta pela geometria da pestana (trastes locais iguais ao dedo). */
function svgStringCoveredByBarreAtFret(barres: Barre[], svgStringNum: number, fret: number): boolean {
  for (const b of barres) {
    if (b.fret !== fret) continue;
    const lo = Math.min(b.fromString, b.toString);
    const hi = Math.max(b.fromString, b.toString);
    if (svgStringNum >= lo && svgStringNum <= hi) return true;
  }
  return false;
}

function dbPositionToSvgChord(pos: DbPosition): Chord {
  const barres = dbBarresToSvguitar(pos);
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
    /** Na corda/traste da pestana só desenhamos a barra (svguitar pinta dedos por cima da pestana). */
    if (svgStringCoveredByBarreAtFret(barres, svgStringNum, fr)) continue;

    const label = fn > 0 ? String(fn) : undefined;
    if (label) fingers.push([svgStringNum, fr, label]);
    else fingers.push([svgStringNum, fr]);
  }

  return {
    fingers,
    barres,
    position: pos.baseFret > 0 ? pos.baseFret : 1,
  };
}

export type ResolvedSvguitarChord = {
  chordData: Chord;
  configure: Partial<ChordSettings>;
  /** Rótulo ao lado do diagrama (sem título duplicado dentro do SVG). */
  displayLabel: string;
};

/** Número de variações (posições) disponíveis na base para o símbolo. */
export function getChordDiagramVariationCount(labelRaw: string): number {
  const looked = lookupGuitarChordEntry(labelRaw);
  return looked ? looked.entry.positions.length : 0;
}

/**
 * Resolve uma variação do acorde; `variationIndex` 0 = mesma escolha que {@link resolveChordDiagram}.
 */
export function resolveChordDiagramVariation(
  labelRaw: string,
  variationIndex: number,
): ResolvedSvguitarChord | null {
  const looked = lookupGuitarChordEntry(labelRaw);
  if (!looked) return null;

  const ranked = rankedChordPositions(looked.entry.positions);
  if (!ranked.length) return null;

  const idx = Math.max(0, Math.min(ranked.length - 1, Math.floor(variationIndex)));
  const picked = ranked[idx]!;

  const chordData = dbPositionToSvgChord(picked);
  const configure = cifraSvguitarConfigure(picked.baseFret > 0 ? picked.baseFret : 1);

  return {
    chordData,
    configure,
    displayLabel: looked.displayLabel,
  };
}

/** Resolve rótulo de acorde (ex.: Am7, G/B → G) para geometria svguitar + tema. */
export function resolveChordDiagram(labelRaw: string): ResolvedSvguitarChord | null {
  return resolveChordDiagramVariation(labelRaw, 0);
}

/** Desenha no elemento host (client-only). Devolve dims para opcionalmente ajustar layout. */
export function drawChordIntoElement(el: HTMLElement, resolved: ResolvedSvguitarChord): {
  width: number;
  height: number;
} {
  el.replaceChildren();
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
    /* ignore */
  }
  el.replaceChildren();
}
