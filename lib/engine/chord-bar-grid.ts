// @ts-nocheck
/**
 * Grelha musical nos eventos de acorde (export Music.AI / chords.json).
 *
 * Posicionamento na letra usa **start_bar/start_beat** e **end_bar/end_beat** como janela em **beats absolutos**
 * (ver `toAbsoluteBeat` / `tryNormalizeChordPosition`). O fim do intervalo é **exclusivo** em beats, como na referência:
 * 17:1 → 19:1 em 4/4 são 8 beats (dois compassos completos).
 *
 * A letra só traz `start`/`end` em segundos; para mapear sílaba → beat constrói-se uma recta por troço entre
 * `(t em s, beat absoluto)` a partir dos próprios acordes com metadados completos — não se usa comparação
 * «palavra começa depois de chord.start» para escolher a âncora.
 *
 * @module chord-bar-grid
 */

/** @typedef {import('./musicai-types.ts').TimedWord} TimedWord */

/** @typedef {{ beatsPerBar?: number }} BeatGridOptions */

/**
 * @typedef {object} ChordSegment
 * @property {number} bar
 * @property {number} startBeatInBar
 * @property {number} endBeatInBarExclusive
 * @property {number} beatLength
 * @property {number} x
 * @property {number} width
 */

/**
 * @typedef {object} NormalizedChordPosition
 * @property {string} chordLabel
 * @property {number} absoluteStartBeat
 * @property {number} absoluteEndBeat
 * @property {number} totalBeatLength
 * @property {number} startBar
 * @property {number} endBarExclusive
 * @property {ChordSegment[]} segments
 * @property {number} startTime
 * @property {number} endTime
 * @property {number} durationSeconds
 */

/**
 * @param {number} bar — 1-based
 * @param {number} beat — 1-based dentro do compasso (início); fim exclusivo pode usar `beatsPerBar + 1` na API de referência
 * @param {number} beatsPerBar
 * @returns {number} índice 0-based do beat na linha do tempo global
 */
export function toAbsoluteBeat(bar, beat, beatsPerBar) {
  const bpb = Number(beatsPerBar);
  if (!Number.isFinite(bpb) || bpb < 1) throw new Error(`beatsPerBar inválido: ${beatsPerBar}`);
  if (!Number.isFinite(bar) || bar < 1) throw new Error(`bar inválido: ${bar}`);
  if (!Number.isFinite(beat) || beat < 1 || beat > bpb + 1) {
    throw new Error(`beat inválido: ${beat} (1..${bpb + 1})`);
  }
  return (bar - 1) * bpb + (beat - 1);
}

/**
 * @param {import('./musicai-types.ts').MusicAiChordEvent} chord
 * @returns {boolean}
 */
export function chordHasFullBarBeatMetadata(chord) {
  if (!chord || typeof chord !== 'object') return false;
  const sb = Number(chord.start_bar);
  const sbt = Number(chord.start_beat);
  const eb = Number(chord.end_bar);
  const ebt = Number(chord.end_beat);
  return [sb, sbt, eb, ebt].every(Number.isFinite);
}

/**
 * @param {import('./musicai-types.ts').MusicAiChordEvent} chord
 * @param {BeatGridOptions} [options]
 * @returns {NormalizedChordPosition|null}
 */
export function tryNormalizeChordPosition(chord, options = {}) {
  const beatsPerBar = Number.isFinite(options.beatsPerBar) ? options.beatsPerBar : 4;
  if (!chordHasFullBarBeatMetadata(chord)) return null;
  const st = Number(chord.start);
  const en = Number(chord.end);
  if (!Number.isFinite(st) || !Number.isFinite(en) || en <= st + 1e-9) return null;

  let absoluteStartBeat;
  let absoluteEndBeat;
  try {
    absoluteStartBeat = toAbsoluteBeat(Number(chord.start_bar), Number(chord.start_beat), beatsPerBar);
    absoluteEndBeat = toAbsoluteBeat(Number(chord.end_bar), Number(chord.end_beat), beatsPerBar);
  } catch {
    return null;
  }

  if (absoluteEndBeat <= absoluteStartBeat) return null;

  const totalBeatLength = absoluteEndBeat - absoluteStartBeat;
  /** @type {ChordSegment[]} */
  const segments = [];
  let currentBeat = absoluteStartBeat;

  while (currentBeat < absoluteEndBeat) {
    const currentBar = Math.floor(currentBeat / beatsPerBar) + 1;
    const barStartAbs = (currentBar - 1) * beatsPerBar;
    const barEndAbs = barStartAbs + beatsPerBar;

    const segmentStartAbs = currentBeat;
    const segmentEndAbs = Math.min(absoluteEndBeat, barEndAbs);

    const startBeatInBar = segmentStartAbs - barStartAbs + 1;
    const endBeatInBarExclusive = segmentEndAbs - barStartAbs + 1;
    const beatLength = segmentEndAbs - segmentStartAbs;

    segments.push({
      bar: currentBar,
      startBeatInBar,
      endBeatInBarExclusive,
      beatLength,
      x: (startBeatInBar - 1) / beatsPerBar,
      width: beatLength / beatsPerBar
    });

    currentBeat = segmentEndAbs;
  }

  const chordLabel =
    String(chord.chord_simple_pop || chord.chord_basic_pop || chord.chord_majmin || '').trim() || '—';

  return {
    chordLabel,
    absoluteStartBeat,
    absoluteEndBeat,
    totalBeatLength,
    startBar: Number(chord.start_bar),
    endBarExclusive: Number(chord.end_bar),
    segments,
    startTime: st,
    endTime: en,
    durationSeconds: en - st
  };
}

/**
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {BeatGridOptions} [options]
 * @returns {NormalizedChordPosition[]}
 */
export function normalizeChordList(chords, options = {}) {
  const list = Array.isArray(chords) ? chords : [];
  /** @type {NormalizedChordPosition[]} */
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const n = tryNormalizeChordPosition(list[i], options);
    if (n) out.push(n);
  }
  return out;
}

/**
 * Pontos (tempo áudio, beat absoluto) nos vértices dos eventos com grelha completa, para interpolação linear.
 *
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} offsetSec
 * @param {number} beatsPerBar
 * @returns {{ t: number, b: number }[]}
 */
function buildBeatTimelinePoints(chords, offsetSec, beatsPerBar) {
  const off = Number.isFinite(offsetSec) ? offsetSec : 0;
  const list = Array.isArray(chords) ? chords : [];
  /** @type {{ t: number, b: number }[]} */
  const raw = [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const n = tryNormalizeChordPosition(c, { beatsPerBar });
    if (!n) continue;
    const t0 = Number(c.start) + off;
    const t1 = Number(c.end) + off;
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) continue;
    raw.push({ t: t0, b: n.absoluteStartBeat });
    raw.push({ t: t1, b: n.absoluteEndBeat });
  }
  raw.sort((a, z) => a.t - z.t);
  if (!raw.length) return [];
  /** @type {{ t: number, b: number }[]} */
  const merged = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.t - p.t) < 1e-6) {
      last.b = (last.b + p.b) / 2;
    } else {
      merged.push({ t: p.t, b: p.b });
    }
  }
  return merged;
}

/**
 * Beat absoluto (fraccionário) correspondente a um instante de áudio, via interpolação entre nós da grelha.
 *
 * @param {number} tAudio
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} offsetSec
 * @param {number} beatsPerBar
 * @returns {number|null}
 */
export function inferAbsoluteBeatAtAudioTime(tAudio, chords, offsetSec, beatsPerBar) {
  if (!Number.isFinite(tAudio)) return null;
  const bpb = Number.isFinite(beatsPerBar) ? beatsPerBar : 4;
  const pts = buildBeatTimelinePoints(chords, offsetSec, bpb);
  if (pts.length < 2) return null;
  const t = tAudio;

  const extrap = (t, p0, p1) => {
    const dt = p1.t - p0.t;
    if (Math.abs(dt) < 1e-9) return p0.b;
    return p0.b + ((t - p0.t) / dt) * (p1.b - p0.b);
  };

  if (t <= pts[0].t) {
    return extrap(t, pts[0], pts[1]);
  }
  if (t >= pts[pts.length - 1].t) {
    const n = pts.length;
    return extrap(t, pts[n - 2], pts[n - 1]);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (t >= pts[i].t && t <= pts[i + 1].t) {
      return extrap(t, pts[i], pts[i + 1]);
    }
  }
  return null;
}

const ONSET_MATCH_SEC = 0.12;

/**
 * Índice do evento cujo `start+offset` coincide com o onset do segmento em áudio (p.ex. `segs[0].a0`).
 * Usado na cifra para alinhar supressão ao mesmo evento que o rótulo harmónico (evita confundir com o
 * acorde «anterior» em beat quando a sílaba cai no pickup).
 *
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} segmentAudioOnset
 * @param {number} offsetSec
 * @returns {number} -1 se nenhum match
 */
export function chordEventIndexForSegmentOnset(chords, segmentAudioOnset, offsetSec = 0) {
  const off = Number.isFinite(offsetSec) ? offsetSec : 0;
  if (!Number.isFinite(segmentAudioOnset)) return -1;
  const list = Array.isArray(chords) ? chords : [];
  let best = -1;
  let bestD = ONSET_MATCH_SEC + 1;
  for (let i = 0; i < list.length; i++) {
    const t = Number(list[i]?.start) + off;
    if (!Number.isFinite(t)) continue;
    const d = Math.abs(t - segmentAudioOnset);
    if (d < bestD && d <= ONSET_MATCH_SEC) {
      bestD = d;
      best = i;
    }
  }
  if (best >= 0) return best;
  return chordEventIndexContainingAudioTime(segmentAudioOnset, chords, offsetSec);
}

/**
 * Evento ativo no relógio de áudio (intervalo [start,end) com offset).
 *
 * @param {number} tAudio
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} offsetSec
 * @returns {number} -1 se nenhum
 */
export function chordEventIndexContainingAudioTime(tAudio, chords, offsetSec = 0) {
  const off = Number.isFinite(offsetSec) ? offsetSec : 0;
  if (!Number.isFinite(tAudio)) return -1;
  const eps = 1e-4;
  const list = Array.isArray(chords) ? chords : [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const t0 = Number(c.start) + off;
    const t1 = Number(c.end) + off;
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) continue;
    if (tAudio >= t0 - eps && tAudio < t1 - eps) {
      return i;
    }
  }
  return -1;
}

/**
 * Índice do evento cuja janela **em beats** [absoluteStartBeat, absoluteEndBeat) contém `absBeat`.
 *
 * @param {number} absBeat
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} beatsPerBar
 * @returns {number} -1 se nenhum
 */
export function chordEventIndexContainingBeat(absBeat, chords, beatsPerBar) {
  if (!Number.isFinite(absBeat)) return -1;
  const bpb = Number.isFinite(beatsPerBar) ? beatsPerBar : 4;
  const tol = 1e-7;
  const list = Array.isArray(chords) ? chords : [];
  for (let i = 0; i < list.length; i++) {
    const n = tryNormalizeChordPosition(list[i], { beatsPerBar: bpb });
    if (!n) continue;
    if (absBeat + tol >= n.absoluteStartBeat && absBeat < n.absoluteEndBeat - tol) {
      return i;
    }
  }
  return -1;
}

/**
 * Limites temporais da linha vocal em segundos (filtro de quais acordes entram na linha).
 *
 * @param {TimedWord[]} lineWords
 * @returns {{ t0: number, t1: number }|null}
 */
export function lineAudioBounds(lineWords) {
  let t0 = Infinity;
  let t1 = -Infinity;
  for (let i = 0; i < lineWords.length; i++) {
    const w = lineWords[i];
    if (w.start != null && Number.isFinite(w.start)) {
      t0 = Math.min(t0, w.start);
      t1 = Math.max(t1, w.start);
    }
    if (w.end != null && Number.isFinite(w.end)) t1 = Math.max(t1, w.end);
  }
  if (!Number.isFinite(t0)) return null;
  return { t0, t1 };
}

/**
 * Folga em **beats absolutos** só para `start_beat === 1` (downbeat): a letra pode começar na última
 * fração do compasso anterior no mapa tempo→beat (ex. G#→Fm em 19.53s com «Everybody» a 19.21s → beat
 * inferido < absStart do Fm). Sem isto o rótulo saltava para a segunda sílaba.
 */
const DOWNBEAT_ANCHOR_BEAT_SLACK = 1 - 1e-6;

/**
 * Acorde com `start_beat === 1` cujo onset (em áudio, com offset) cai **estritamente dentro** de ]t0,t1[
 * (típico: novo compasso a meio da sílaba; a letra começa antes do `start` em segundos do JSON).
 *
 * @param {number} t0
 * @param {number} t1
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} offsetSec
 * @param {number} beatsPerBar
 * @returns {{ chordIndex: number, onsetAudio: number } | null}
 */
export function downbeatChordStartingInsideWordWindow(t0, t1, chords, offsetSec, beatsPerBar = 4) {
  const off = Number.isFinite(offsetSec) ? offsetSec : 0;
  const bpb = Number.isFinite(beatsPerBar) ? beatsPerBar : 4;
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0 + 1e-4) return null;
  const list = Array.isArray(chords) ? chords : [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (Number(c.start_beat) !== 1) continue;
    if (!tryNormalizeChordPosition(c, { beatsPerBar: bpb })) continue;
    const cs = Number(c.start) + off;
    if (!Number.isFinite(cs)) continue;
    if (cs > t0 + 1e-4 && cs < t1 - 1e-4) {
      return { chordIndex: i, onsetAudio: cs };
    }
  }
  return null;
}

/**
 * Para cada acorde com grelha completa que cruza a linha no tempo: primeira palavra cuja sílaba,
 * em beat absoluto inferido, já «entrou» no acorde. Para downbeat (`start_beat === 1`), aceita-se até
 * **1 batida** antes de `absoluteStartBeat` (pickup métrico na grelha, não threshold em segundos).
 *
 * @param {TimedWord[]} lineWords
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} offsetSec
 * @param {number} beatsPerBar
 * @returns {Map<number, number>} chordIndex → wordIndex
 */
export function buildChordBarAnchorsForLine(lineWords, chords, offsetSec, beatsPerBar = 4) {
  /** @type {Map<number, number>} */
  const map = new Map();
  const off = Number.isFinite(offsetSec) ? offsetSec : 0;
  const bpb = Number.isFinite(beatsPerBar) ? beatsPerBar : 4;
  const bounds = lineAudioBounds(lineWords);
  if (!bounds || !lineWords.length) return map;

  const list = Array.isArray(chords) ? chords : [];
  const eps = 1e-3;

  for (let ci = 0; ci < list.length; ci++) {
    const c = list[ci];
    const norm = tryNormalizeChordPosition(c, { beatsPerBar: bpb });
    if (!norm) continue;
    const tOnset = Number(c.start) + off;
    const tEnd = Number(c.end) + off;
    if (!Number.isFinite(tOnset) || !Number.isFinite(tEnd)) continue;
    if (tEnd <= bounds.t0 - eps || tOnset >= bounds.t1 + eps) continue;

    const absStart = norm.absoluteStartBeat;
    const isDownbeat = Number(c.start_beat) === 1;
    /** Folga só após o 1.º compasso global (`absStart > 0`), senão «pickup» antes do 1:1 confundia o 1.º acorde. */
    const threshold =
      isDownbeat && absStart > 0 ? absStart - DOWNBEAT_ANCHOR_BEAT_SLACK : absStart;

    let bestIdx = -1;
    for (let wi = 0; wi < lineWords.length; wi++) {
      const w = lineWords[wi];
      if (w.start == null || !Number.isFinite(w.start)) continue;
      const b = inferAbsoluteBeatAtAudioTime(w.start, chords, off, bpb);
      if (b == null) continue;
      if (b + 1e-6 >= threshold) {
        bestIdx = wi;
        break;
      }
    }
    if (bestIdx >= 0) map.set(ci, bestIdx);
  }

  return map;
}

/**
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @returns {boolean}
 */
export function chordsHaveBeatGridMetadata(chords) {
  const list = Array.isArray(chords) ? chords : [];
  for (let i = 0; i < list.length; i++) {
    if (chordHasFullBarBeatMetadata(list[i])) return true;
  }
  return false;
}

