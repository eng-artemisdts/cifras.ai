// @ts-nocheck
/**
 * Motor de acordes: resolve evento ativo por tempo (segundos).
 * Opcional chordTimeOffsetSec corrige desvio decode vs análise Music.AI (POC).
 *
 * @module chord-timeline
 */


/**
 * Music.AI usa `N` em vários campos para «sem acorde» / fim da análise.
 *
 * @param {import('./musicai-types.ts').MusicAiChordEvent|null|undefined} c
 * @returns {boolean}
 */
export function isNoChordEvent(c) {
  if (!c || typeof c !== 'object') return false;
  /** @type {(unknown)[]} */
  const fields = [
    c.chord_simple_pop,
    c.chord_basic_pop,
    c.chord_majmin,
    c.chord_simple_jazz,
    c.chord_basic_jazz,
    c.chord_complex_pop,
    c.chord_complex_nashville,
    c.chord_simple_nashville,
    c.chord_basic_nashville
  ];
  for (let i = 0; i < fields.length; i++) {
    const v = fields[i];
    if (v == null) continue;
    const u = String(v).trim().toUpperCase();
    if (u === 'N' || u === 'NC' || u.startsWith('N:')) return true;
  }
  return false;
}

/**
 * @param {import('./musicai-types.ts').MusicAiChordEvent|null|undefined} c
 * @returns {string}
 */
export function formatChordLabel(c) {
  if (!c) return '—';
  if (isNoChordEvent(c)) return '-';
  let s = c.chord_simple_pop || c.chord_basic_pop || '';
  if (c.bass) s += `/${c.bass}`;
  return s || '—';
}

/**
 * Remove cauda final de eventos sem acorde (N/NC) e estende o último acorde real até ao fim.
 * Mantém eventos "N" internos intactos.
 *
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @returns {import('./musicai-types.ts').MusicAiChordEvent[]}
 */
export function collapseTrailingNoChordEvents(chords) {
  const out = Array.isArray(chords) ? chords.map((c) => ({ ...c })) : [];
  if (!out.length) return out;

  let iLastPlayed = -1;
  for (let i = out.length - 1; i >= 0; i--) {
    if (!isNoChordEvent(out[i])) {
      iLastPlayed = i;
      break;
    }
  }

  if (iLastPlayed >= 0 && iLastPlayed < out.length - 1) {
    const tailEnd = Number(out[out.length - 1].end);
    const lastPlayedEnd = Number(out[iLastPlayed].end);
    if (Number.isFinite(tailEnd) && Number.isFinite(lastPlayedEnd) && tailEnd > lastPlayedEnd) {
      out[iLastPlayed].end = tailEnd;
    }
    out.length = iLastPlayed + 1;
  }
  return out;
}

/**
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {{ offsetSec?: number }} [options]
 * @returns {{
 *   gridStartChordTime: number,
 *   gridStartAudioTime: number,
 *   lastEndChordTime: number,
 *   lastChordEndAudioTime: number,
 *   atAudioTime: (tAudio: number) => import('./musicai-types.ts').MusicAiChordEvent|null,
 *   labelAtAudioTime: (tAudio: number) => string,
 *   labelAtChordTime: (tChord: number) => string
 * }}
 */
export function createChordTimeline(chords, options = {}) {
  const offsetSec = Number.isFinite(options.offsetSec) ? options.offsetSec : 0;
  const normalizedChords = collapseTrailingNoChordEvents(chords);

  const gridStartChordTime = normalizedChords.length ? normalizedChords[0].start : 0;
  /** Primeiro acorde no mesmo relógio que o player / letra. */
  const gridStartAudioTime = normalizedChords.length ? gridStartChordTime + offsetSec : 0;
  const lastEndChordTime = normalizedChords.length ? normalizedChords[normalizedChords.length - 1].end : 0;
  const lastChordEndAudioTime = normalizedChords.length ? lastEndChordTime + offsetSec : 0;

  /**
   * Converte tempo do player para linha do tempo dos acordes do JSON.
   * @param {number} tAudio
   */
  function toChordTime(tAudio) {
    return tAudio - offsetSec;
  }

  /**
   * @param {number} tChord — segundos no mesmo referencial que chords[].start
   */
  function atChordTime(tChord) {
    for (let i = 0; i < normalizedChords.length; i++) {
      const c = normalizedChords[i];
      if (tChord >= c.start && tChord < c.end) return c;
    }
    if (normalizedChords.length && tChord < normalizedChords[0].start) return null;
    return normalizedChords.length ? normalizedChords[normalizedChords.length - 1] : null;
  }

  function atAudioTime(tAudio) {
    return atChordTime(toChordTime(tAudio));
  }

  return {
    gridStartChordTime,
    gridStartAudioTime,
    lastEndChordTime,
    lastChordEndAudioTime,
    atAudioTime,
    labelAtAudioTime(tAudio) {
      return formatChordLabel(atAudioTime(tAudio));
    },
    labelAtChordTime(tChord) {
      return formatChordLabel(atChordTime(tChord));
    }
  };
}

/**
 * Índice do evento na lista normalizada (igual a `createChordTimeline` / «ACORDE NO TEMPO»).
 *
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} tAudio — relógio do player
 * @param {number} [offsetSec=0]
 * @returns {number} -1 antes do 1.º acorde; senão índice em `collapseTrailingNoChordEvents(chords)`
 */
export function chordEventIndexAtAudioTime(chords, tAudio, offsetSec = 0) {
  const off = Number.isFinite(offsetSec) ? offsetSec : 0;
  const normalized = collapseTrailingNoChordEvents(Array.isArray(chords) ? chords : []);
  if (!normalized.length) return -1;
  const tChord = tAudio - off;
  if (normalized.length && tChord < normalized[0].start) return -1;
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (tChord >= c.start && tChord < c.end) return i;
  }
  return normalized.length - 1;
}

/**
 * Segmentos de acorde no relógio do áudio, recortados a [tWin0, tWin1), para grelha instrumental.
 *
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} tWin0
 * @param {number} tWin1
 * @param {number} [offsetSec=0]
 * @param {{ formatChord?: (c: import('./musicai-types.ts').MusicAiChordEvent) => string }} [options]
 * @returns {{ a0: number, a1: number, label: string, chordIdx: number }[]}
 */
export function chordSegmentsInAudioWindow(chords, tWin0, tWin1, offsetSec = 0, options = {}) {
  const fmt = typeof options.formatChord === 'function' ? options.formatChord : formatChordLabel;
  const off = Number.isFinite(offsetSec) ? offsetSec : 0;
  const normalizedChords = collapseTrailingNoChordEvents(chords);
  /** @type {{ a0: number, a1: number, label: string, chordIdx: number }[]} */
  const out = [];
  for (let i = 0; i < normalizedChords.length; i++) {
    const c = normalizedChords[i];
    const cA0 = c.start + off;
    const cA1 = c.end + off;
    if (cA1 <= tWin0 || cA0 >= tWin1) continue;
    const a0 = Math.max(tWin0, cA0);
    const a1 = Math.min(tWin1, cA1);
    if (a1 > a0 + 1e-6) {
      out.push({ a0, a1, label: fmt(c), chordIdx: i });
    }
  }
  out.sort((x, y) => x.a0 - y.a0);
  return out;
}

/**
 * Colapsa segmentos com o mesmo rótulo consecutivos (ordem temporal).
 *
 * @param {{ a0: number, a1: number, label: string, chordIdx?: number }[]} segs
 * @returns {{ a0: number, a1: number, label: string, chordIdx?: number }[]}
 */
export function collapseSequentialChordSegments(segs) {
  /** @type {{ a0: number, a1: number, label: string, chordIdx?: number }[]} */
  const out = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const last = out[out.length - 1];
    if (last && last.label === s.label) {
      last.a1 = Math.max(last.a1, s.a1);
      continue;
    }
    out.push({
      label: s.label,
      a0: s.a0,
      a1: s.a1,
      chordIdx: s.chordIdx
    });
  }
  return out;
}

/**
 * Em secções vocais «normais» (não Intro/Instrumental na letra, não anacruse): remove segmentos cujo
 * evento começou antes de `sectionStartAudio`, para não repetir na secção seguinte um acorde que só
 * começou na anterior (ex. G 9.73–12.85 com Intro 0.4–11.85 e Verso 11.85–…).
 *
 * @param {{ a0: number, a1: number, label: string, chordIdx?: number }[]} segs
 * @param {boolean} apply
 * @returns {{ a0: number, a1: number, label: string, chordIdx?: number }[]}
 */
export function dropChordSegmentsOriginatingBeforeSection(segs, chords, chordTimeOffsetSec, sectionStartAudio, apply) {
  if (!apply || !Array.isArray(segs) || !segs.length || !Number.isFinite(sectionStartAudio)) return segs;
  const off = Number.isFinite(chordTimeOffsetSec) ? chordTimeOffsetSec : 0;
  const normalized = collapseTrailingNoChordEvents(chords);
  const sec0 = Number(sectionStartAudio);
  const filtered = segs.filter((seg) => {
    if (!Number.isFinite(seg.chordIdx)) return true;
    const c = normalized[seg.chordIdx];
    if (!c) return false;
    const onset = Number(c.start) + off;
    return !Number.isFinite(onset) || onset >= sec0 - 1e-3;
  });
  return collapseSequentialChordSegments(filtered);
}
